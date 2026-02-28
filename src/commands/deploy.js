const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or add it to queue')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name or YouTube URL')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear queue'),

    new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume playback'),

    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current queue')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)),

    new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song'),

    new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)),

    new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Toggle shuffle mode'),

    new SlashCommandBuilder()
        .setName('equalizer')
        .setDescription('Set equalizer preset')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('EQ preset')
                .setRequired(true)
                .addChoices(
                    { name: '🎵 Normal', value: 'normal' },
                    { name: '🔊 Bass Boost', value: 'bassboost' },
                    { name: '🎤 Vocal', value: 'vocal' },
                    { name: '🌙 Nightcore', value: 'nightcore' }
                )),

    new SlashCommandBuilder()
        .setName('trending')
        .setDescription('View TikTok trending songs')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)),

    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup bot channels')
        .addChannelOption(option =>
            option.setName('voice')
                .setDescription('Voice channel for music')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('text')
                .setDescription('Text channel for notifications')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('favorite')
        .setDescription('Manage your favorite songs')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add current song to favorites'))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View your favorite songs'))
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play your favorites playlist'))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a song from favorites')
                .addIntegerOption(option =>
                    option.setName('index')
                        .setDescription('Song number to remove')
                        .setRequired(true)
                        .setMinValue(1))),

    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics'),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands')
].map(cmd => cmd.toJSON());

async function deploy() {
    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
        console.log('🔄 Deploying slash commands...');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log(`✅ Successfully deployed ${commands.length} commands!`);
    } catch (error) {
        console.error('❌ Failed to deploy commands:', error);
    }
}

deploy();