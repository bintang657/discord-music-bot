const { EmbedBuilder } = require('discord.js');
const { truncate } = require('../utils/helpers');

function createNotification(type, data, config) {
    const embed = new EmbedBuilder().setTimestamp();

    switch (type) {
        case 'song_added':
            embed.setColor(config.embed.colors.success)
                .setTitle('🎵 Song Added to Queue')
                .setDescription(`**${truncate(data.title, 50)}** - ${truncate(data.artist, 30)}`)
                .addFields(
                    { name: 'Requested by', value: data.requestedBy || 'Unknown', inline: true },
                    { name: 'Position', value: `#${data.position}`, inline: true }
                );
            if (data.thumbnail) embed.setThumbnail(data.thumbnail);
            break;

        case 'trending_updated':
            embed.setColor(config.embed.colors.warning)
                .setTitle('🔄 Trending List Updated!')
                .setDescription(`Loaded **${data.count}** new trending songs from TikTok!`)
                .addFields(
                    { name: 'Source', value: data.source || 'Multiple', inline: true },
                    { name: 'Next Update', value: '<t:' + Math.floor((Date.now() + config.trending.fetchInterval) / 1000) + ':R>', inline: true }
                );
            break;

        case 'error':
            embed.setColor(config.embed.colors.error)
                .setTitle('⚠️ Error Occurred')
                .setDescription(data.message || 'An unexpected error occurred.')
                .addFields(
                    { name: 'Action', value: data.action || 'Auto-recovering...', inline: true }
                );
            break;

        case 'reconnect':
            embed.setColor(config.embed.colors.info)
                .setTitle('🔄 Reconnecting...')
                .setDescription(`Attempt ${data.attempt}/${data.maxAttempts}`)
                .addFields(
                    { name: 'Reason', value: data.reason || 'Connection lost', inline: true }
                );
            break;

        case 'stats':
            embed.setColor(config.embed.colors.info)
                .setTitle('📊 Daily Stats Summary')
                .addFields(
                    { name: '🎵 Songs Played', value: `${data.songsPlayed}`, inline: true },
                    { name: '⏱️ Total Time', value: data.totalTime || '0h', inline: true },
                    { name: '👥 Listeners', value: `${data.listeners || 0}`, inline: true }
                );
            break;
    }

    return embed;
}

module.exports = { createNotification };