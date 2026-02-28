const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const { MusicDatabase } = require('./database');
const { TrendingFetcher } = require('./trending');
const { MusicPlayer } = require('./player');
const { MusicQueue } = require('./queue');
const { Logger } = require('./utils/logger');
const config = require('../config.json');
const path = require('path');
const fs = require('fs');

class MusicBot {
    constructor() {
        this.config = config;
        this.logger = new Logger();
        this.client = null;
        this.db = null;
        this.trending = null;
        this.player = null;
        this.queue = null;
        this.commands = new Collection();
    }

    async initialize() {
        // Initialize database
        this.db = new MusicDatabase();

        // Initialize queue
        this.queue = new MusicQueue(this.db, this.config);

        // Initialize trending fetcher
        this.trending = new TrendingFetcher(this.db, this.config);

        // Initialize Discord client
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ],
            failIfNotExists: false
        });

        // Initialize player
        this.player = new MusicPlayer(
            this.client, this.db, this.queue,
            this.trending, this.config
        );

        // Load commands
        await this.loadCommands();

        // Setup events
        this.setupEvents();

        // Login
        await this.client.login(this.config.token);
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(commandsPath)) return;

        const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && f !== 'deploy.js');

        for (const file of commandFiles) {
            try {
                const command = require(path.join(commandsPath, file));
                if (command.data && command.execute) {
                    this.commands.set(command.data.name, command);
                    this.logger.info(`📦 Loaded command: ${command.data.name}`);
                }
            } catch (error) {
                this.logger.error(`Failed to load command ${file}:`, error.message);
            }
        }
    }

    setupEvents() {
        // Ready event
        this.client.once(Events.ClientReady, async (client) => {
            this.logger.info(`✅ Logged in as ${client.user.tag}`);
            this.logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);

            // Set presence
            client.user.setPresence({
                activities: [{ name: '🎵 TikTok Trending 24/7', type: 2 }],
                status: 'online'
            });

            // Initialize for the configured guild
            const guild = client.guilds.cache.get(this.config.guildId);
            if (guild) {
                this.player.initialize(guild.id);

                // Start trending fetcher
                await this.trending.start();

                // Auto-join and play
                if (this.config.autoplay.enabled) {
                    setTimeout(async () => {
                        await this.player.autoJoinAndPlay();

                        // Send welcome embed
                        try {
                            const textChannel = await client.channels.fetch(
                                this.player.textChannelId || this.config.defaultTextChannel
                            );
                            if (textChannel) {
                                const { createWelcomeEmbed } = require('./embeds/welcome');
                                const embed = createWelcomeEmbed(this, guild);
                                await textChannel.send({ embeds: [embed] });
                            }
                        } catch (e) {
                            this.logger.error('Failed to send welcome:', e.message);
                        }
                    }, 3000);
                }
            }
        });

        // Interaction event (slash commands + buttons)
        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (interaction.isChatInputCommand()) {
                    const command = this.commands.get(interaction.commandName);
                    if (!command) return;

                    await command.execute(interaction, this);
                } else if (interaction.isButton()) {
                    await this.handleButton(interaction);
                }
            } catch (error) {
                this.logger.error('Interaction error:', error.message);
                const reply = { content: '❌ An error occurred while processing your request.', ephemeral: true };
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply);
                    } else {
                        await interaction.reply(reply);
                    }
                } catch { }
            }
        });

        // Voice state update (detect when bot is disconnected)
        this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
            // If the bot was disconnected from voice
            if (oldState.member?.id === this.client.user.id && !newState.channelId) {
                this.logger.warn('⚠️ Bot was disconnected from voice channel');
                if (this.config.autoplay.enabled) {
                    setTimeout(() => this.player.autoJoinAndPlay(), this.config.autoplay.retryDelay);
                }
            }
        });

        // Error handling
        this.client.on('error', (error) => {
            this.logger.error('Client error:', error.message);
        });

        this.client.on('warn', (warning) => {
            this.logger.warn('Client warning:', warning);
        });
    }

    async handleButton(interaction) {
        const customId = interaction.customId;

        switch (customId) {
            case 'btn_previous':
                await interaction.deferUpdate();
                await this.player.previous();
                break;

            case 'btn_pause_resume': {
                await interaction.deferUpdate();
                const result = this.player.togglePause();
                break;
            }

            case 'btn_skip':
                await interaction.deferUpdate();
                await this.player.skip();
                break;

            case 'btn_shuffle':
                await interaction.deferUpdate();
                this.queue.toggleShuffle();
                break;

            case 'btn_favorite': {
                const song = this.queue.getCurrentSong();
                if (song) {
                    const added = this.db.addFavorite(interaction.user.id, song);
                    await interaction.reply({
                        content: added ? `❤️ Added **${song.title}** to your favorites!` : '💔 Already in your favorites!',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({ content: '❌ No song is playing!', ephemeral: true });
                }
                break;
            }

            case 'btn_queue_prev':
            case 'btn_queue_next': {
                await interaction.deferUpdate();
                // Queue pagination handled in queue command
                break;
            }

            case 'btn_trending_refresh': {
                await interaction.deferUpdate();
                await interaction.followUp({ content: '🔄 Refreshing trending list...', ephemeral: true });
                await this.trending.fetchAll();
                await interaction.followUp({ content: '✅ Trending list updated!', ephemeral: true });
                break;
            }

            case 'btn_trending_playall': {
                await interaction.deferUpdate();
                const songs = this.trending.getCachedSongs();
                if (songs.length > 0) {
                    this.queue.addSongs(songs, true);
                    await interaction.followUp({
                        content: `▶️ Added ${songs.length} trending songs to queue!`,
                        ephemeral: true
                    });
                }
                break;
            }

            default:
                if (customId.startsWith('btn_queue_page_')) {
                    await interaction.deferUpdate();
                }
                break;
        }
    }

    destroy() {
        this.logger.info('🔌 Shutting down...');
        if (this.player) this.player.disconnect();
        if (this.trending) this.trending.stop();
        if (this.db) this.db.close();
        if (this.client) this.client.destroy();
    }
}

module.exports = { MusicBot };