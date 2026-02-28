const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDurationSeconds } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics'),

    async execute(interaction, bot) {
        const guildId = interaction.guildId;
        const totalStats = bot.db.getTotalStats(guildId);
        const weeklyStats = bot.db.getStats(guildId, 7);
        const trendingCount = bot.trending.getCachedSongs().length;

        const uptime = process.uptime();
        const uptimeStr = formatUptime(uptime);

        const memUsage = process.memoryUsage();
        const heapMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1);

        const embed = new EmbedBuilder()
            .setColor(bot.config.embed.colors.info)
            .setTitle('📊 Bot Statistics')
            .addFields(
                {
                    name: '🎵 Music Stats',
                    value: [
                        `**Total Songs Played:** ${totalStats.total_songs}`,
                        `**Active Days:** ${totalStats.active_days}`,
                        `**Queue Length:** ${bot.queue.getQueueLength()}`,
                        `**Trending Songs:** ${trendingCount}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🖥️ System',
                    value: [
                        `**Uptime:** ${uptimeStr}`,
                        `**Memory:** ${heapMB} MB`,
                        `**Ping:** ${bot.client.ws.ping}ms`,
                        `**Node.js:** ${process.version}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '⚙️ Current Settings',
                    value: [
                        `**Volume:** ${bot.player.getVolume()}%`,
                        `**EQ Mode:** ${bot.player.getEQ()}`,
                        `**Shuffle:** ${bot.queue.isShuffled() ? 'ON' : 'OFF'}`,
                        `**Playing:** ${bot.player.isPlaying ? 'Yes ✅' : 'No ❌'}`
                    ].join('\n'),
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.username}` });

        // Weekly chart
        if (weeklyStats.length > 0) {
            let weeklyText = '';
            for (const stat of weeklyStats.slice(0, 7)) {
                const bar = '█'.repeat(Math.min(Math.ceil(stat.songs_played / 5), 20));
                weeklyText += `\`${stat.date}\` ${bar} ${stat.songs_played}\n`;
            }
            embed.addFields({
                name: '📈 This Week',
                value: weeklyText || 'No data yet'
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
}