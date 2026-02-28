const { shuffleArray } = require('./utils/helpers');
const { Logger } = require('./utils/logger');

class MusicQueue {
    constructor(database, config) {
        this.db = database;
        this.config = config;
        this.logger = new Logger();

        this.queue = [];
        this.currentSong = null;
        this.currentIndex = -1;
        this.history = [];
        this.shuffleMode = config.autoplay.shuffleDefault;
        this.repeatMode = 'none'; // none, one, all
        this.guildId = null;
    }

    setGuildId(guildId) {
        this.guildId = guildId;
        const settings = this.db.getSettings(guildId);
        this.shuffleMode = settings.shuffle_mode === 1;
    }

    addSong(song, priority = false) {
        const queueSong = {
            ...song,
            addedAt: Date.now(),
            isManualRequest: priority,
            id: `${song.youtube_id || ''}_${Date.now()}`
        };

        if (priority) {
            // Find position after current manual requests
            let insertIndex = 0;
            for (let i = 0; i < this.queue.length; i++) {
                if (this.queue[i].isManualRequest) {
                    insertIndex = i + 1;
                } else {
                    break;
                }
            }
            this.queue.splice(insertIndex, 0, queueSong);
        } else {
            this.queue.push(queueSong);
        }

        return queueSong;
    }

    addSongs(songs, shuffle = false) {
        const toAdd = shuffle ? shuffleArray(songs) : songs;
        for (const song of toAdd) {
            this.addSong(song, false);
        }
    }

    getNext() {
        // Filter out recently played songs
        while (this.queue.length > 0) {
            const nextSong = this.queue.shift();

            if (nextSong.youtube_id && this.guildId &&
                this.db.isRecentlyPlayed(this.guildId, nextSong.youtube_id, 2) &&
                !nextSong.isManualRequest) {
                continue;
            }

            // Add current to history
            if (this.currentSong) {
                this.history.unshift(this.currentSong);
                if (this.history.length > 50) this.history.pop();
            }

            this.currentSong = nextSong;
            return nextSong;
        }

        return null;
    }

    getPrevious() {
        if (this.history.length === 0) return null;

        if (this.currentSong) {
            this.queue.unshift(this.currentSong);
        }

        this.currentSong = this.history.shift();
        return this.currentSong;
    }

    getCurrentSong() {
        return this.currentSong;
    }

    getQueue() {
        return [...this.queue];
    }

    getHistory() {
        return [...this.history];
    }

    getQueueLength() {
        return this.queue.length;
    }

    getTotalDuration() {
        return this.queue.reduce((total, song) => total + (song.duration || 0), 0);
    }

    removeSong(index) {
        if (index >= 0 && index < this.queue.length) {
            return this.queue.splice(index, 1)[0];
        }
        return null;
    }

    clearQueue() {
        this.queue = [];
    }

    shuffle() {
        const manualRequests = this.queue.filter(s => s.isManualRequest);
        const autoSongs = this.queue.filter(s => !s.isManualRequest);
        this.queue = [...manualRequests, ...shuffleArray(autoSongs)];
    }

    toggleShuffle() {
        this.shuffleMode = !this.shuffleMode;
        if (this.shuffleMode) this.shuffle();
        if (this.guildId) {
            this.db.updateSettings(this.guildId, 'shuffle_mode', this.shuffleMode ? 1 : 0);
        }
        return this.shuffleMode;
    }

    isShuffled() {
        return this.shuffleMode;
    }

    isEmpty() {
        return this.queue.length === 0;
    }

    peek(count = 5) {
        return this.queue.slice(0, count);
    }
}

module.exports = { MusicQueue };