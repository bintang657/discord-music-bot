const axios = require('axios');
const cheerio = require('cheerio');
const { execSync, exec } = require('child_process');
const { Logger } = require('./utils/logger');

class TrendingFetcher {
    constructor(database, config) {
        this.db = database;
        this.config = config;
        this.logger = new Logger();
        this.lastFetch = null;
        this.fetchInterval = null;
        this.cache = [];
    }

    async start() {
        this.logger.trending('🔥 Starting TikTok Trending fetcher...');
        await this.fetchAll();
        this.fetchInterval = setInterval(() => this.fetchAll(), this.config.trending.fetchInterval);
    }

    stop() {
        if (this.fetchInterval) clearInterval(this.fetchInterval);
    }

    async fetchAll() {
        this.logger.trending('🔄 Fetching trending songs...');
        let songs = [];

        // Try multiple sources
        for (const source of this.config.trending.sources) {
            try {
                let result = [];
                switch (source) {
                    case 'tokboard':
                        result = await this.fetchFromTokboard();
                        break;
                    case 'tokchart':
                        result = await this.fetchFromTokchart();
                        break;
                    case 'fallback':
                        result = await this.fetchFallbackTrending();
                        break;
                }

                if (result.length > 0) {
                    songs = result;
                    this.logger.trending(`✅ Fetched ${result.length} songs from ${source}`);
                    break;
                }
            } catch (error) {
                this.logger.error(`❌ Failed to fetch from ${source}:`, error.message);
            }
        }

        if (songs.length === 0) {
            songs = this.getHardcodedTrending();
            this.logger.trending('📋 Using hardcoded trending list as fallback');
        }

        // Search YouTube URLs for each song
        const enrichedSongs = [];
        for (let i = 0; i < songs.length; i++) {
            try {
                const song = songs[i];
                if (!song.youtube_url || !song.youtube_id) {
                    const ytResult = await this.searchYouTube(`${song.title} ${song.artist}`);
                    if (ytResult) {
                        song.youtube_url = ytResult.url;
                        song.youtube_id = ytResult.id;
                        song.thumbnail = ytResult.thumbnail;
                        song.duration = ytResult.duration;
                    }
                }
                song.rank = i + 1;
                enrichedSongs.push(song);

                // Small delay to avoid rate limiting
                if (i % 5 === 0 && i > 0) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (error) {
                this.logger.error(`Failed to enrich song ${songs[i].title}:`, error.message);
            }
        }

        if (enrichedSongs.length > 0) {
            this.db.saveTrendingSongs(enrichedSongs, 'combined');
            this.cache = enrichedSongs;
            this.lastFetch = new Date();
        }

        return enrichedSongs;
    }

    async fetchFromTokboard() {
        const { data } = await axios.get('https://tokboard.com/trending/songs', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);
        const songs = [];

        $('tr, .song-row, .track-item, [class*="song"], [class*="track"]').each((i, el) => {
            const $el = $(el);
            const title = $el.find('td:nth-child(2), .song-title, .track-name, [class*="title"]').first().text().trim();
            const artist = $el.find('td:nth-child(3), .song-artist, .artist-name, [class*="artist"]').first().text().trim();

            if (title && title.length > 1 && !title.toLowerCase().includes('song name')) {
                songs.push({
                    title: title.substring(0, 200),
                    artist: artist.substring(0, 200) || 'Unknown',
                    rank: songs.length + 1,
                    genre: 'pop',
                    source: 'tokboard'
                });
            }
        });

        return songs.slice(0, this.config.trending.maxSongs);
    }

    async fetchFromTokchart() {
        const { data } = await axios.get('https://tokchart.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        });

        const $ = cheerio.load(data);
        const songs = [];

        $('.chart-item, .song-item, tr, [class*="track"], [class*="chart"]').each((i, el) => {
            const $el = $(el);
            const textContent = $el.text().trim();
            const title = $el.find('.title, .name, .song-name, td:nth-child(2)').first().text().trim();
            const artist = $el.find('.artist, .singer, td:nth-child(3)').first().text().trim();

            if (title && title.length > 1) {
                songs.push({
                    title: title.substring(0, 200),
                    artist: artist.substring(0, 200) || 'Unknown',
                    rank: songs.length + 1,
                    genre: 'pop',
                    source: 'tokchart'
                });
            }
        });

        return songs.slice(0, this.config.trending.maxSongs);
    }

    async fetchFallbackTrending() {
        // Use YouTube trending music as fallback
        try {
            const searches = [
                'TikTok trending songs 2024',
                'TikTok viral songs this week',
                'most popular TikTok sounds 2024'
            ];

            const songs = [];
            for (const query of searches) {
                try {
                    const result = execSync(
                        `yt-dlp --flat-playlist --dump-json "ytsearch20:${query}" 2>/dev/null`,
                        { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
                    );

                    const lines = result.trim().split('\n');
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.title && !songs.find(s => s.title === data.title)) {
                                songs.push({
                                    title: data.title,
                                    artist: data.uploader || data.channel || 'Unknown',
                                    youtube_url: `https://www.youtube.com/watch?v=${data.id}`,
                                    youtube_id: data.id,
                                    thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
                                    duration: data.duration || 0,
                                    rank: songs.length + 1,
                                    genre: 'pop',
                                    source: 'youtube_search'
                                });
                            }
                        } catch (e) { /* skip malformed lines */ }
                    }
                } catch (e) {
                    this.logger.warn(`Search failed for "${query}":`, e.message);
                }
            }

            return songs.slice(0, this.config.trending.maxSongs);
        } catch (error) {
            this.logger.error('Fallback fetch failed:', error.message);
            return [];
        }
    }

    getHardcodedTrending() {
        return [
            { title: "Paint The Town Red", artist: "Doja Cat", genre: "hiphop" },
            { title: "Cruel Summer", artist: "Taylor Swift", genre: "pop" },
            { title: "Snooze", artist: "SZA", genre: "rnb" },
            { title: "Vampire", artist: "Olivia Rodrigo", genre: "pop" },
            { title: "Last Night", artist: "Morgan Wallen", genre: "pop" },
            { title: "Kill Bill", artist: "SZA", genre: "rnb" },
            { title: "Flowers", artist: "Miley Cyrus", genre: "pop" },
            { title: "As It Was", artist: "Harry Styles", genre: "pop" },
            { title: "Anti-Hero", artist: "Taylor Swift", genre: "pop" },
            { title: "Unholy", artist: "Sam Smith", genre: "pop" },
            { title: "About Damn Time", artist: "Lizzo", genre: "pop" },
            { title: "Heat Waves", artist: "Glass Animals", genre: "alternative" },
            { title: "Bad Habit", artist: "Steve Lacy", genre: "rnb" },
            { title: "Calm Down", artist: "Rema & Selena Gomez", genre: "pop" },
            { title: "Cupid", artist: "Fifty Fifty", genre: "pop" },
            { title: "Creepin'", artist: "Metro Boomin ft. The Weeknd & 21 Savage", genre: "hiphop" },
            { title: "Boy's a Liar Pt 2", artist: "PinkPantheress & Ice Spice", genre: "pop" },
            { title: "Die For You", artist: "The Weeknd & Ariana Grande", genre: "pop" },
            { title: "Fukumean", artist: "Gunna", genre: "hiphop" },
            { title: "Daylight", artist: "David Kushner", genre: "pop" },
            { title: "All My Life", artist: "Lil Durk ft. J. Cole", genre: "hiphop" },
            { title: "Fast Car", artist: "Luke Combs", genre: "pop" },
            { title: "Escapism", artist: "RAYE ft. 070 Shake", genre: "pop" },
            { title: "Thinkin' Bout Me", artist: "Morgan Wallen", genre: "pop" },
            { title: "Need a Favor", artist: "Jelly Roll", genre: "pop" },
            { title: "Dance The Night", artist: "Dua Lipa", genre: "pop" },
            { title: "Karma", artist: "Taylor Swift ft. Ice Spice", genre: "pop" },
            { title: "Rich Flex", artist: "Drake & 21 Savage", genre: "hiphop" },
            { title: "Sprinter", artist: "Dave & Central Cee", genre: "hiphop" },
            { title: "Greedy", artist: "Tate McRae", genre: "pop" },
            { title: "Used To Be Young", artist: "Miley Cyrus", genre: "pop" },
            { title: "Water", artist: "Tyla", genre: "pop" },
            { title: "Stick Season", artist: "Noah Kahan", genre: "alternative" },
            { title: "Strangers", artist: "Kenya Grace", genre: "electronic" },
            { title: "Standing Next To You", artist: "Jung Kook", genre: "pop" },
            { title: "Seven", artist: "Jung Kook ft. Latto", genre: "pop" },
            { title: "What Was I Made For?", artist: "Billie Eilish", genre: "pop" },
            { title: "Lil Boo Thang", artist: "Paul Russell", genre: "pop" },
            { title: "Popular", artist: "The Weeknd & Playboi Carti", genre: "hiphop" },
            { title: "Trustfall", artist: "P!nk", genre: "pop" },
            { title: "Eyes Closed", artist: "Ed Sheeran", genre: "pop" },
            { title: "Tattoo", artist: "Loreen", genre: "pop" },
            { title: "I Wanna Be Yours", artist: "Arctic Monkeys", genre: "rock" },
            { title: "Super Shy", artist: "NewJeans", genre: "pop" },
            { title: "OMG", artist: "NewJeans", genre: "pop" },
            { title: "Hype Boy", artist: "NewJeans", genre: "pop" },
            { title: "MONTERO", artist: "Lil Nas X", genre: "pop" },
            { title: "Physical", artist: "Dua Lipa", genre: "pop" },
            { title: "Levitating", artist: "Dua Lipa", genre: "pop" },
            { title: "Blinding Lights", artist: "The Weeknd", genre: "pop" }
        ].map((s, i) => ({ ...s, rank: i + 1, source: 'hardcoded' }));
    }

    async searchYouTube(query) {
        try {
            const result = execSync(
                `yt-dlp --dump-json --no-playlist "ytsearch1:${query.replace(/"/g, '\\"')} official audio" 2>/dev/null`,
                { encoding: 'utf-8', timeout: 20000, maxBuffer: 5 * 1024 * 1024 }
            );

            const data = JSON.parse(result.trim());
            return {
                url: `https://www.youtube.com/watch?v=${data.id}`,
                id: data.id,
                title: data.title,
                thumbnail: data.thumbnail || '',
                duration: data.duration || 0,
                uploader: data.uploader || data.channel || ''
            };
        } catch (error) {
            this.logger.warn(`YouTube search failed for "${query}":`, error.message);
            return null;
        }
    }

    getCachedSongs() {
        if (this.cache.length > 0) return this.cache;
        return this.db.getLatestTrendingSongs(this.config.trending.maxSongs);
    }

    getLastFetchTime() {
        return this.lastFetch;
    }
}

module.exports = { TrendingFetcher };