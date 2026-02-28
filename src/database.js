const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { Logger } = require('./utils/logger');

class MusicDatabase {
    constructor() {
        this.logger = new Logger();
        const dbDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

        this.db = new Database(path.join(dbDir, 'music.db'));
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('busy_timeout = 5000');
        this.initialize();
    }

    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS trending_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                artist TEXT DEFAULT 'Unknown',
                youtube_url TEXT,
                youtube_id TEXT,
                thumbnail TEXT,
                duration INTEGER DEFAULT 0,
                rank INTEGER DEFAULT 0,
                genre TEXT DEFAULT 'pop',
                source TEXT DEFAULT 'unknown',
                fetch_date TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS play_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT DEFAULT 'Unknown',
                youtube_url TEXT,
                youtube_id TEXT,
                requested_by TEXT,
                played_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT DEFAULT 'Unknown',
                youtube_url TEXT,
                youtube_id TEXT,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, youtube_id)
            );

            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                voice_channel_id TEXT,
                text_channel_id TEXT,
                volume INTEGER DEFAULT 50,
                shuffle_mode INTEGER DEFAULT 1,
                eq_mode TEXT DEFAULT 'normal',
                autoplay INTEGER DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS bot_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                songs_played INTEGER DEFAULT 0,
                total_listen_time INTEGER DEFAULT 0,
                unique_listeners INTEGER DEFAULT 0,
                date TEXT NOT NULL,
                UNIQUE(guild_id, date)
            );

            CREATE INDEX IF NOT EXISTS idx_trending_date ON trending_songs(fetch_date);
            CREATE INDEX IF NOT EXISTS idx_history_guild ON play_history(guild_id, played_at);
            CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
        `);

        this.logger.info('📦 Database initialized successfully');
    }

    // Trending Songs
    saveTrendingSongs(songs, source) {
        const fetchDate = new Date().toISOString().split('T')[0];
        const deleteStmt = this.db.prepare('DELETE FROM trending_songs WHERE fetch_date = ? AND source = ?');
        const insertStmt = this.db.prepare(`
            INSERT INTO trending_songs (title, artist, youtube_url, youtube_id, thumbnail, duration, rank, genre, source, fetch_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = this.db.transaction((songs) => {
            deleteStmt.run(fetchDate, source);
            for (const song of songs) {
                insertStmt.run(
                    song.title, song.artist, song.youtube_url || '',
                    song.youtube_id || '', song.thumbnail || '',
                    song.duration || 0, song.rank || 0,
                    song.genre || 'pop', source, fetchDate
                );
            }
        });

        transaction(songs);
        this.logger.info(`📦 Saved ${songs.length} trending songs from ${source}`);
    }

    getTrendingSongs(limit = 50) {
        return this.db.prepare(`
            SELECT * FROM trending_songs
            ORDER BY fetch_date DESC, rank ASC
            LIMIT ?
        `).all(limit);
    }

    getLatestTrendingSongs(limit = 50) {
        const latestDate = this.db.prepare(
            'SELECT fetch_date FROM trending_songs ORDER BY fetch_date DESC LIMIT 1'
        ).get();

        if (!latestDate) return [];

        return this.db.prepare(`
            SELECT * FROM trending_songs
            WHERE fetch_date = ?
            ORDER BY rank ASC
            LIMIT ?
        `).all(latestDate.fetch_date, limit);
    }

    // Play History
    addToHistory(guildId, song) {
        this.db.prepare(`
            INSERT INTO play_history (guild_id, title, artist, youtube_url, youtube_id, requested_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(guildId, song.title, song.artist || 'Unknown',
            song.youtube_url || '', song.youtube_id || '',
            song.requested_by || 'Auto');
    }

    getRecentHistory(guildId, hours = 2) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        return this.db.prepare(`
            SELECT * FROM play_history
            WHERE guild_id = ? AND played_at > ?
            ORDER BY played_at DESC
        `).all(guildId, since);
    }

    isRecentlyPlayed(guildId, youtubeId, hours = 2) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const result = this.db.prepare(`
            SELECT COUNT(*) as count FROM play_history
            WHERE guild_id = ? AND youtube_id = ? AND played_at > ?
        `).get(guildId, youtubeId, since);
        return result.count > 0;
    }

    // User Favorites
    addFavorite(userId, song) {
        try {
            this.db.prepare(`
                INSERT OR IGNORE INTO user_favorites (user_id, title, artist, youtube_url, youtube_id)
                VALUES (?, ?, ?, ?, ?)
            `).run(userId, song.title, song.artist || 'Unknown',
                song.youtube_url || '', song.youtube_id || '');
            return true;
        } catch {
            return false;
        }
    }

    removeFavorite(userId, youtubeId) {
        const result = this.db.prepare(
            'DELETE FROM user_favorites WHERE user_id = ? AND youtube_id = ?'
        ).run(userId, youtubeId);
        return result.changes > 0;
    }

    getFavorites(userId) {
        return this.db.prepare(
            'SELECT * FROM user_favorites WHERE user_id = ? ORDER BY added_at DESC'
        ).all(userId);
    }

    isFavorite(userId, youtubeId) {
        const result = this.db.prepare(
            'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ? AND youtube_id = ?'
        ).get(userId, youtubeId);
        return result.count > 0;
    }

    // Guild Settings
    getSettings(guildId) {
        let settings = this.db.prepare(
            'SELECT * FROM guild_settings WHERE guild_id = ?'
        ).get(guildId);

        if (!settings) {
            this.db.prepare(`
                INSERT INTO guild_settings (guild_id) VALUES (?)
            `).run(guildId);
            settings = this.db.prepare(
                'SELECT * FROM guild_settings WHERE guild_id = ?'
            ).get(guildId);
        }

        return settings;
    }

    updateSettings(guildId, key, value) {
        const allowed = ['voice_channel_id', 'text_channel_id', 'volume', 'shuffle_mode', 'eq_mode', 'autoplay'];
        if (!allowed.includes(key)) return false;

        this.getSettings(guildId); // Ensure exists
        this.db.prepare(`
            UPDATE guild_settings SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?
        `).run(value, guildId);
        return true;
    }

    // Stats
    incrementStats(guildId, field) {
        const date = new Date().toISOString().split('T')[0];
        this.db.prepare(`
            INSERT INTO bot_stats (guild_id, date, ${field})
            VALUES (?, ?, 1)
            ON CONFLICT(guild_id, date)
            DO UPDATE SET ${field} = ${field} + 1
        `).run(guildId, date);
    }

    getStats(guildId, days = 7) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return this.db.prepare(`
            SELECT * FROM bot_stats
            WHERE guild_id = ? AND date >= ?
            ORDER BY date DESC
        `).all(guildId, since);
    }

    getTotalStats(guildId) {
        return this.db.prepare(`
            SELECT
                COALESCE(SUM(songs_played), 0) as total_songs,
                COALESCE(SUM(total_listen_time), 0) as total_time,
                COUNT(DISTINCT date) as active_days
            FROM bot_stats WHERE guild_id = ?
        `).get(guildId);
    }

    close() {
        this.db.close();
    }
}

module.exports = { MusicDatabase };