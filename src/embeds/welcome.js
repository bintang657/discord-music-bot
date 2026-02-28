const { EmbedBuilder } = require('discord.js');

function createWelcomeEmbed(bot, guild) {
    const trendingCount = bot.trending.getCachedSongs().length;
    const settings = bot.db.getSettings(guild.id);

    const asciiArt = [
        '```',
        '╔══════════════════════════════════════╗',
        '║  ♪ ♫ ♬  MUSIC BOT 24/7  ♬ ♫ ♪     ║',
        '║  ████████████████████████████████    ║',
        '║  █  TikTok Trending Auto-Player █    ║',
        '║  ████████████████████████████████    ║',
        '╚══════════════════════════════════════╝',
        '```'
    ].join('\n');

    const embed = new EmbedBuilder()
        .setColor('#00D4FF')
        .setTitle('🎵 Music Bot 24/7 is Online!')
        .setDescription(asciiArt)
        .addFields(
            {
                name: '📊 Status',
                value: [
                    `🟢 **Bot Status:** Online`,
                    `🔊 **Voice Channel:** <#${bot.player.voiceChannelId}>`,
                    `📝 **Text Channel:** <#${bot.player.textChannelId}>`,
                    `🔊 **Volume:** ${settings.volume}%`,
                    `🔀 **Shuffle:** ${settings.shuffle_mode ? 'ON' : 'OFF'}`,
                    `🎛️ **EQ Mode:** ${settings.eq_mode}`,
                    `📋 **Trending Songs:** ${trendingCount}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🎮 Quick Commands',
                value: [
                    '`/play <song>` - Play a song',
                    '`/skip` - Skip current song',
                    '`/queue` - View queue',
                    '`/nowplaying` - Current song info',
                    '`/trending` - View trending songs',
                    '`/volume <0-100>` - Adjust volume',
                    '`/equalizer <mode>` - Change EQ',
                    '`/help` - All commands'
                ].join('\n'),
                inline: false
            },
            {
                name: '🔥 Features',
                value: [
                    '✅ 24/7 Non-stop music',
                    '✅ TikTok trending auto-playlist',
                    '✅ Auto-reconnect on disconnect',
                    '✅ Bass Boost & Nightcore EQ',
                    '✅ Favorites system',
                    '✅ Interactive buttons'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: '🎵 Enjoy the music! | Auto-updating trending every 6 hours' })
        .setTimestamp();

    return embed;
}

module.exports = { createWelcomeEmbed };