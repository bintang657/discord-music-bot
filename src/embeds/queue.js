const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatDurationSeconds, truncate, chunkArray } = require('../utils/helpers');

function createQueueEmbed(queue, player, page = 0, config) {
    const songs = queue.getQueue();
    const currentSong = queue.getCurrentSong();
    const pages = chunkArray(songs, 10);
    const totalPages = Math.max(1, pages.length);
    const currentPage = Math.min(page, totalPages - 1);
    const pageSongs = pages[currentPage] || [];

    const embed = new EmbedBuilder()
        .setColor(config.embed.colors.info)
        .setTitle('📋 Music Queue')
        .setTimestamp();

    // Current Song
    if (currentSong) {
        embed.setDescription(
            `**🎵 Currently Playing:**\n` +
            `[${truncate(currentSong.title, 50)}](${currentSong.youtube_url || '#'}) - ` +
            `${truncate(currentSong.artist, 30)} ` +
            `\`${formatDurationSeconds(currentSong.duration)}\`\n` +
            `${currentSong.isManualRequest ? '👤 Requested' : '🤖 Auto-Trending'}\n\n` +
            `**📋 Up Next:**`
        );
    } else {
        embed.setDescription('**📋 Queue:**');
    }

    // Queue items
    if (pageSongs.length === 0) {
        embed.addFields({
            name: '\u200B',
            value: '*Queue is empty. Auto-trending will fill it!*'
        });
    } else {
        let queueText = '';
        const startIndex = currentPage * 10;

        for (let i = 0; i < pageSongs.length; i++) {
            const song = pageSongs[i];
            const globalIndex = startIndex + i + 1;
            const typeEmoji = song.isManualRequest ? '👤' : '🔥';
            const duration = formatDurationSeconds(song.duration);

            queueText += `\`${globalIndex}.\` ${typeEmoji} **${truncate(song.title, 40)}** - ${truncate(song.artist, 25)} \`${duration}\`\n`;
        }

        embed.addFields({ name: '\u200B', value: queueText });
    }

    // Footer with stats
    const totalDuration = queue.getTotalDuration();
    embed.setFooter({
        text: `Page ${currentPage + 1}/${totalPages} | ${songs.length} songs | Total: ${formatDurationSeconds(totalDuration)} | 🔀 Shuffle: ${queue.isShuffled() ? 'ON' : 'OFF'}`
    });

    return { embed, totalPages, currentPage };
}

function createQueueButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`btn_queue_page_${currentPage - 1}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 0),
        new ButtonBuilder()
            .setCustomId('btn_queue_info')
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`btn_queue_page_${currentPage + 1}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );

    return row;
}

module.exports = { createQueueEmbed, createQueueButtons };