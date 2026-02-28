const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    NoSubscriberBehavior,
    getVoiceConnection,
    StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const { Logger } = require('./utils/logger');
const { ProgressTracker } = require('./utils/progress');
const { PassThrough } = require('stream');

class MusicPlayer {
    constructor(client, database, queue, trendingFetcher, config) {
        this.client = client;
        this.db = database;
        this.queue = queue;
        this.trending = trendingFetcher;
        this.config = config;
        this.logger = new Logger();

        this.audioPlayer = null;
        this.connection = null;
        this.guildId = null;
        this.voiceChannelId = null;
        this.textChannelId = null;

        this.volume = config.player.defaultVolume / 100;
        this.eqMode = config.player.defaultEQ;
        this.isPaused = false;
        this.isPlaying = false;
        this.progress = new ProgressTracker();

        this.retryCount = 0;
        this.maxRetries = config.autoplay.maxRetries;
        this.retryDelay = config.autoplay.retryDelay;

        this.nowPlayingMessage = null;
        this.nowPlayingInterval = null;

        this.currentProcess = null;
        this.preloadedStream = null;
    }

    initialize(guildId) {
        this.guildId = guildId;
        this.queue.setGuildId(guildId);

        const settings = this.db.getSettings(guildId);
        this.volume = (settings.volume || 50) / 100;
        this.eqMode = settings.eq_mode || 'normal';
        this.voiceChannelId = settings.voice_channel_id || this.config.defaultVoiceChannel;
        this.textChannelId = settings.text_channel_id || this.config.defaultTextChannel;

        this.createAudioPlayer();
    }

    createAudioPlayer() {
        this.audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
                maxMissedFrames: 250
            }
        });

        this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
            this.logger.player('⏹️ Player is idle. Playing next...');
            this.isPlaying = false;
            await this.playNext();
        });

        this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.retryCount = 0;
        });

        this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
            this.isPaused = true;
        });

        this.audioPlayer.on('error', async (error) => {
            this.logger.error('🔴 Audio player error:', error.message);
            this.isPlaying = false;
            await this.handleError();
        });
    }

    async autoJoinAndPlay() {
        try {
            const channel = await this.client.channels.fetch(this.voiceChannelId);
            if (!channel) {
                this.logger.error('❌ Voice channel not found:', this.voiceChannelId);
                return;
            }

            await this.joinChannel(channel);

            if (this.queue.isEmpty()) {
                await this.loadTrendingPlaylist();
            }

            if (!this.isPlaying) {
                await this.playNext();
            }
        } catch (error) {
            this.logger.error('❌ Auto join and play failed:', error.message);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                this.logger.info(`🔄 Retrying in ${this.retryDelay / 1000}s... (${this.retryCount}/${this.maxRetries})`);
                setTimeout(() => this.autoJoinAndPlay(), this.retryDelay);
            }
        }
    }

    async joinChannel(channel) {
        try {
            this.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });

            this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
                this.logger.warn('⚠️ Voice connection disconnected');
                try {
                    await Promise.race([
                        entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000)
                    ]);
                    // Seems to be reconnecting to a new channel
                } catch {
                    // Seems to be a real disconnect
                    this.logger.warn('🔄 Real disconnect. Attempting reconnect...');
                    this.connection.destroy();
                    setTimeout(() => this.autoJoinAndPlay(), this.retryDelay);
                }
            });

            this.connection.on(VoiceConnectionStatus.Destroyed, () => {
                this.logger.warn('💔 Voice connection destroyed');
                this.isPlaying = false;
            });

            this.connection.on('error', (error) => {
                this.logger.error('🔴 Connection error:', error.message);
            });

            // Wait for ready
            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
            this.connection.subscribe(this.audioPlayer);

            this.logger.player(`🔊 Joined voice channel: ${channel.name}`);
            return true;
        } catch (error) {
            this.logger.error('❌ Failed to join channel:', error.message);
            throw error;
        }
    }

    async loadTrendingPlaylist() {
        let songs = this.trending.getCachedSongs();

        if (songs.length === 0) {
            songs = this.trending.getHardcodedTrending();
            // Enrich with YouTube data
            for (const song of songs.slice(0, 20)) {
                try {
                    const yt = await this.trending.searchYouTube(`${song.title} ${song.artist}`);
                    if (yt) {
                        song.youtube_url = yt.url;
                        song.youtube_id = yt.id;
                        song.thumbnail = yt.thumbnail;
                        song.duration = yt.duration;
                    }
                } catch (e) { /* skip */ }
            }
        }

        const validSongs = songs.filter(s => s.youtube_url || s.youtube_id);
        this.queue.addSongs(validSongs, this.queue.isShuffled());
        this.logger.player(`📋 Loaded ${validSongs.length} songs into queue`);
    }

    async playNext() {
        let song = this.queue.getNext();

        if (!song) {
            this.logger.player('📋 Queue empty. Reloading trending playlist...');
            await this.loadTrendingPlaylist();
            song = this.queue.getNext();
        }

        if (!song) {
            this.logger.error('❌ No songs available to play');
            return;
        }

        // If no YouTube URL, search for it
        if (!song.youtube_url && !song.youtube_id) {
            const yt = await this.trending.searchYouTube(`${song.title} ${song.artist}`);
            if (yt) {
                song.youtube_url = yt.url;
                song.youtube_id = yt.id;
                song.thumbnail = yt.thumbnail;
                song.duration = yt.duration;
            } else {
                this.logger.warn(`⏭️ Skipping "${song.title}" - no YouTube result`);
                return this.playNext();
            }
        }

        await this.playSong(song);
    }

    async playSong(song) {
        try {
            const url = song.youtube_url || `https://www.youtube.com/watch?v=${song.youtube_id}`;
            this.logger.player(`🎵 Playing: ${song.title} - ${song.artist}`);

            // Kill previous process
            if (this.currentProcess) {
                try { this.currentProcess.kill('SIGTERM'); } catch { }
            }

            const stream = await this.createStream(url);
            if (!stream) {
                this.logger.warn(`⏭️ Stream creation failed for "${song.title}". Skipping...`);
                return this.playNext();
            }

            const resource = createAudioResource(stream, {
                inputType: StreamType.OggOpus,
                inlineVolume: true
            });

            if (resource.volume) {
                resource.volume.setVolume(this.volume);
            }

            this.audioPlayer.play(resource);
            this.currentResource = resource;

            // Update progress tracker
            this.progress.start(song.duration || 0);

            // Add to history
            if (this.guildId) {
                this.db.addToHistory(this.guildId, song);
                this.db.incrementStats(this.guildId, 'songs_played');
            }

            // Send now playing notification
            await this.sendNowPlayingNotification(song);

            // Preload next song
            if (this.config.player.preloadNext) {
                setTimeout(() => this.preloadNextSong(), 5000);
            }

        } catch (error) {
            this.logger.error(`❌ Failed to play "${song.title}":`, error.message);
            await this.handleError();
        }
    }

    createStream(url) {
        return new Promise((resolve, reject) => {
            const ffmpegFilters = this.getEQFilters();

            const args = [
                '--no-playlist',
                '-f', 'bestaudio[acodec=opus]/bestaudio/best',
                '--no-check-certificates',
                '--prefer-free-formats',
                '--no-warnings',
                '--quiet',
                '-o', '-',
                url
            ];

            const ytdlp = spawn('yt-dlp', args, {
                stdio: ['ignore', 'pipe', 'ignore']
            });

            const ffmpegArgs = [
                '-i', 'pipe:0',
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-acodec', 'libopus',
                '-f', 'opus',
                '-ar', '48000',
                '-ac', '2',
                ...(ffmpegFilters.length > 0 ? ['-af', ffmpegFilters.join(',')] : []),
                'pipe:1'
            ];

            const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'ignore']
            });

            ytdlp.stdout.pipe(ffmpeg.stdin);
            this.currentProcess = ytdlp;

            ytdlp.on('error', (err) => {
                this.logger.error('yt-dlp error:', err.message);
                reject(err);
            });

            ffmpeg.on('error', (err) => {
                this.logger.error('ffmpeg error:', err.message);
                reject(err);
            });

            ytdlp.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    ffmpeg.stdin.end();
                }
            });

            // Timeout to detect if stream is actually working
            const timeout = setTimeout(() => {
                resolve(ffmpeg.stdout);
            }, 2000);

            ffmpeg.stdout.once('data', () => {
                clearTimeout(timeout);
                resolve(ffmpeg.stdout);
            });

            ffmpeg.on('close', () => {
                clearTimeout(timeout);
            });

            // Safety timeout
            setTimeout(() => {
                clearTimeout(timeout);
                if (!ffmpeg.stdout.destroyed) {
                    resolve(ffmpeg.stdout);
                } else {
                    reject(new Error('Stream timeout'));
                }
            }, 10000);
        });
    }

    getEQFilters() {
        const eqPresets = {
            normal: [],
            bassboost: [
                'bass=g=10:f=110:w=0.6',
                'equalizer=f=40:width_type=h:width=50:g=6',
                'equalizer=f=80:width_type=h:width=50:g=4'
            ],
            vocal: [
                'equalizer=f=300:width_type=h:width=100:g=4',
                'equalizer=f=1000:width_type=h:width=200:g=3',
                'equalizer=f=3000:width_type=h:width=200:g=2'
            ],
            nightcore: [
                'asetrate=48000*1.25',
                'atempo=0.8',
                'equalizer=f=5000:width_type=h:width=200:g=3'
            ]
        };

        return eqPresets[this.eqMode] || [];
    }

    async preloadNextSong() {
        const nextSongs = this.queue.peek(1);
        if (nextSongs.length === 0) return;

        const next = nextSongs[0];
        if (!next.youtube_url && !next.youtube_id) {
            try {
                const yt = await this.trending.searchYouTube(`${next.title} ${next.artist}`);
                if (yt) {
                    next.youtube_url = yt.url;
                    next.youtube_id = yt.id;
                    next.thumbnail = yt.thumbnail;
                    next.duration = yt.duration;
                }
            } catch (e) { /* skip */ }
        }
    }

    // Player Controls
    pause() {
        if (this.audioPlayer && this.isPlaying) {
            this.audioPlayer.pause();
            this.progress.pause();
            this.isPaused = true;
            return true;
        }
        return false;
    }

    resume() {
        if (this.audioPlayer && this.isPaused) {
            this.audioPlayer.unpause();
            this.progress.resume();
            this.isPaused = false;
            return true;
        }
        return false;
    }

    togglePause() {
        if (this.isPaused) {
            return { action: 'resumed', result: this.resume() };
        } else {
            return { action: 'paused', result: this.pause() };
        }
    }

    async skip() {
        this.audioPlayer.stop();
        // playNext will be called by the Idle event handler
        return true;
    }

    async previous() {
        const prev = this.queue.getPrevious();
        if (prev) {
            this.audioPlayer.stop();
            await this.playSong(prev);
            return true;
        }
        return false;
    }

    setVolume(percent) {
        this.volume = Math.max(0, Math.min(percent, this.config.player.maxVolume)) / 100;
        if (this.currentResource && this.currentResource.volume) {
            this.currentResource.volume.setVolume(this.volume);
        }
        if (this.guildId) {
            this.db.updateSettings(this.guildId, 'volume', Math.round(this.volume * 100));
        }
        return Math.round(this.volume * 100);
    }

    getVolume() {
        return Math.round(this.volume * 100);
    }

    setEQ(mode) {
        const validModes = ['normal', 'bassboost', 'vocal', 'nightcore'];
        if (!validModes.includes(mode)) return false;

        this.eqMode = mode;
        if (this.guildId) {
            this.db.updateSettings(this.guildId, 'eq_mode', mode);
        }

        // Restart current song with new EQ
        const current = this.queue.getCurrentSong();
        if (current && this.isPlaying) {
            this.playSong(current);
        }

        return true;
    }

    getEQ() {
        return this.eqMode;
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.queue.clearQueue();
        if (this.audioPlayer) this.audioPlayer.stop(true);
        if (this.currentProcess) {
            try { this.currentProcess.kill('SIGTERM'); } catch { }
        }
        this.stopNowPlayingUpdate();
    }

    disconnect() {
        this.stop();
        if (this.connection) {
            this.connection.destroy();
            this.connection = null;
        }
    }

    getConnection() {
        return this.connection;
    }

    // Error handling
    async handleError() {
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.logger.warn(`🔄 Error retry ${this.retryCount}/${this.maxRetries}`);
            await new Promise(r => setTimeout(r, this.retryDelay));
            await this.playNext();
        } else {
            this.logger.error('❌ Max retries reached. Waiting 30 seconds...');
            this.retryCount = 0;
            await new Promise(r => setTimeout(r, 30000));
            await this.playNext();
        }
    }

    // Now Playing Message
    async sendNowPlayingNotification(song) {
        try {
            if (!this.textChannelId) return;

            const channel = await this.client.channels.fetch(this.textChannelId);
            if (!channel) return;

            const { createNowPlayingEmbed, createPlayerButtons } = require('./embeds/nowplaying');
            const nextSongs = this.queue.peek(1);
            const nextSong = nextSongs.length > 0 ? nextSongs[0] : null;

            const embed = createNowPlayingEmbed(song, this, nextSong, this.config);
            const buttons = createPlayerButtons(this);

            // Delete old now playing message
            if (this.nowPlayingMessage) {
                try { await this.nowPlayingMessage.delete(); } catch { }
            }

            this.nowPlayingMessage = await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            // Start auto-update
            this.startNowPlayingUpdate(song);

        } catch (error) {
            this.logger.error('Failed to send now playing notification:', error.message);
        }
    }

    startNowPlayingUpdate(song) {
        this.stopNowPlayingUpdate();

        this.nowPlayingInterval = setInterval(async () => {
            try {
                if (!this.nowPlayingMessage || !this.isPlaying) {
                    this.stopNowPlayingUpdate();
                    return;
                }

                const { createNowPlayingEmbed, createPlayerButtons } = require('./embeds/nowplaying');
                const nextSongs = this.queue.peek(1);
                const nextSong = nextSongs.length > 0 ? nextSongs[0] : null;

                const embed = createNowPlayingEmbed(song, this, nextSong, this.config);
                const buttons = createPlayerButtons(this);

                await this.nowPlayingMessage.edit({
                    embeds: [embed],
                    components: [buttons]
                });
            } catch (error) {
                // Message might have been deleted
                this.stopNowPlayingUpdate();
            }
        }, this.config.embed.updateInterval);
    }

    stopNowPlayingUpdate() {
        if (this.nowPlayingInterval) {
            clearInterval(this.nowPlayingInterval);
            this.nowPlayingInterval = null;
        }
    }
}

module.exports = { MusicPlayer };