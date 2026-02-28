const fs = require('fs');
const path = require('path');

class MusicDatabase {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/database.json');
        this.data = {
            trending: [],
            history: [],
            favorites: [],
            settings: {},
            stats: []
        };
        this.init();
    }

    init() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(this.dbPath)) {
            try {
                const fileData = fs.readFileSync(this.dbPath, 'utf-8');
                this.data = JSON.parse(fileData);
                // Ensure structure
                if (!this.data.trending) this.data.trending = [];
                if (!this.data.history) this.data.history = [];
                if (!this.data.favorites) this.data.favorites = [];
                if (!this.data.settings) this.data.settings = {};
                if (!this.data.stats) this.data.stats = [];
            } catch (e) {
                console.error('Database corrupted, resetting...', e);
                this.save();
            }
        } else {
            this.save();
        }
        console.log('📦 JSON Database initialized');
    }

    save() {
        fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    }

    // --- TRENDING ---
    saveTrendingSongs(songs, source) {
        const fetchDate = new Date().toISOString().split('T')[0];
        // Remove old trending for this source/date
        this.data.trending = this.data.trending.filter(s => !(s.fetch_date === fetchDate && s.source === source));
        
        // Add new
        songs.forEach(s => {
            this.data.trending.push({
                ...s,
                fetch_date: fetchDate,
                source: source
            });
        });
        
        // Limit total size to prevent lag (keep last 500)
        if (this.data.trending.length > 500) {
            this.data.trending = this.data.trending.slice(-500);
        }
        this.save();
    }

    getTrendingSongs(limit = 50) {
        return this.data.trending
            .sort((a, b) => new Date(b.fetch_date) - new Date(a.fetch_date) || a.rank - b.rank)
            .slice(0, limit);
    }

    getLatestTrendingSongs(limit = 50) {
        if (this.data.trending.length === 0) return [];
        // Sort by date desc
        const sorted = [...this.data.trending].sort((a, b) => new Date(b.fetch_date) - new Date(a.fetch_date));
        const latestDate = sorted[0].fetch_date;
        
        return sorted
            .filter(s => s.fetch_date === latestDate)
            .sort((a, b) => a.rank - b.rank)
            .slice(0, limit);
    }

    getCachedSongs() {
        return this.getLatestTrendingSongs();
    }

    // --- HISTORY ---
    addToHistory(guildId, song) {
        this.data.history.unshift({
            guild_id: guildId,
            title: song.title,
            artist: song.artist,
            youtube_id: song.youtube_id,
            played_at: new Date().toISOString()
        });
        if (this.data.history.length > 200) this.data.history.pop(); // Keep small
        this.save();
    }

    isRecentlyPlayed(guildId, youtubeId, hours = 2) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).getTime();
        return this.data.history.some(h => 
            h.guild_id === guildId && 
            h.youtube_id === youtubeId && 
            new Date(h.played_at).getTime() > cutoff
        );
    }

    // --- FAVORITES ---
    addFavorite(userId, song) {
        const exists = this.isFavorite(userId, song.youtube_id);
        if (exists) return false;

        this.data.favorites.push({
            user_id: userId,
            title: song.title,
            artist: song.artist || 'Unknown',
            youtube_url: song.youtube_url,
            youtube_id: song.youtube_id,
            added_at: new Date().toISOString()
        });
        this.save();
        return true;
    }

    removeFavorite(userId, youtubeId) {
        const initLen = this.data.favorites.length;
        this.data.favorites = this.data.favorites.filter(f => !(f.user_id === userId && f.youtube_id === youtubeId));
        const changed = this.data.favorites.length !== initLen;
        if (changed) this.save();
        return changed;
    }

    getFavorites(userId) {
        return this.data.favorites.filter(f => f.user_id === userId);
    }

    isFavorite(userId, youtubeId) {
        return this.data.favorites.some(f => f.user_id === userId && f.youtube_id === youtubeId);
    }

    // --- SETTINGS ---
    getSettings(guildId) {
        if (!this.data.settings[guildId]) {
            this.data.settings[guildId] = {
                guild_id: guildId,
                volume: 50,
                shuffle_mode: 1,
                eq_mode: 'normal',
                autoplay: 1
            };
            this.save();
        }
        return this.data.settings[guildId];
    }

    updateSettings(guildId, key, value) {
        if (!this.data.settings[guildId]) this.getSettings(guildId);
        this.data.settings[guildId][key] = value;
        this.save();
        return true;
    }

    // --- STATS ---
    incrementStats(guildId, field) {
        const date = new Date().toISOString().split('T')[0];
        let stat = this.data.stats.find(s => s.guild_id === guildId && s.date === date);
        
        if (!stat) {
            stat = { guild_id: guildId, date: date, songs_played: 0, total_listen_time: 0 };
            this.data.stats.push(stat);
        }
        
        if (field === 'songs_played') stat.songs_played++;
        this.save();
    }

    getTotalStats(guildId) {
        const guildStats = this.data.stats.filter(s => s.guild_id === guildId);
        return {
            total_songs: guildStats.reduce((a, b) => a + (b.songs_played || 0), 0),
            active_days: guildStats.length
        };
    }

    getStats(guildId, days = 7) {
        return this.data.stats
            .filter(s => s.guild_id === guildId)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, days);
    }

    close() {
        this.save();
    }
}

module.exports = { MusicDatabase };