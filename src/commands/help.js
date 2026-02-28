const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),

    async execute(interaction, bot) {
        const embed = new EmbedBuilder()
            .setColor(bot.config.embed.colors.info)
            .setTitle('🎵 Music Bot 24/7 - Help')
            .setDescription('All available commands for the TikTok Trending Music Bot')
            .addFields(
                {
                    name: '🎵 Music Controls',
                    value: [
                        '`/play <query>` - Play a song or add to queue',
                        '`/skip` - Skip the current song',
                        '`/pause` - Pause/Resume playback',
                        '`/stop` - Stop playback and clear queue',
                        '`/nowplaying` - Show current song details'
                    ].join('\n')
                },
                {
                    name: '🎛️ Audio Settings',
                    value: [
                        '`/volume <0-100>` - Set volume level',
                        '`/equalizer <mode>` - Set EQ preset',
                        '  └ Modes: Normal, Bass Boost, Vocal, Nightcore'
                    ].join('\n')
                },
                {
                    name: '📋 Queue & Playlist',
                    value: [
                        '`/queue [page]` - View the current queue',
                        '`/shuffle` - Toggle shuffle mode',
                        '`/trending [page]` - View TikTok trending'
                    ].join('\n')
                },
                {
                    name: '❤️ Favorites',
                    value: [
                        '`/favorite add` - Add current song',
                        '`/favorite list` - View favorites',
                        '`/favorite play` - Play all favorites',
                        '`/favorite remove <#>` - Remove a song'
                    ].join('\n')
                },
                {
                    name: '⚙️ Settings & Info',
                    value: [
                        '`/setup <voice> <text>` - Set channels',
                        '`/stats` - View bot statistics',
                        '`/help` - This help message'
                    ].join('\n')
                },
                {
                    name: '🎮 Interactive Buttons',
                    value: 'The Now Playing embed has interactive buttons:\n⏮️ Previous | ⏯️ Pause/Resume | ⏭️ Skip | 🔀 Shuffle | ❤️ Favorite'
                }
            )
            .setFooter({ text: '🎵 Music Bot 24/7 | TikTok Trending Auto-Player' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};