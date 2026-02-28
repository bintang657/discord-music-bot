const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { truncate, getRankEmoji, chunkArray } = require('../utils/helpers');

function createTrendingEmbed(songs, page = 0, lastFetch, config) {
    const pages = chunkArray(songs, 10);
    const totalPages = Math.max(1, pages.length);
    const currentPage = Math.min(page, totalPages - 1);
    const pageSongs = pages[currentPage] || [];

    const embed = new EmbedBuilder()
        .setColor(config.embed.colors.warning)
        .setTitle('🔥 TikTok Trending Songs')
        .setDescription('Lagu-lagu yang sedang viral di TikTok!')
        .setTimestamp();

    if (pageSongs.length === 0) {
        embed.addFields({
            name: '\u200B',
            value: '*No trending songs available. Try refreshing!*'
        });
    } else {
        let trendingText = '';
        const startIndex = currentPage * 10;

        for (let i = 0; i < pageSongs.length; i++) {
            const song = pageSongs[i];
            const globalRank = startIndex + i + 1;
            const rankDisplay = getRankEmoji(globalRank);

            trendingText += `${rankDisplay} **${truncate(song.title, 40)}**\n`;
            trendingText += `  └ 🎤 ${truncate(song.artist, 35)}`;
            if (song.youtube_url) trendingText += ` | [▶️ YouTube](${song.youtube_url})`;
            trendingText += '\n';
        }

        embed.addFields({ name: '\u200B', value: trendingText });
    }

    const updateTime = lastFetch ? `<t:${Math.floor(lastFetch.getTime() / 1000)}:R>` : 'Never';

    embed.setFooter({
        text: `Page ${currentPage + 1}/${totalPages} | ${songs.length} songs total | Last update: ${lastFetch ? lastFetch.toLocaleString() : 'Never'}`
    });

    return { embed, totalPages, currentPage };
}

function createTrendingButtons(currentPage, totalPages) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`btn_queue_page_${currentPage - 1}`)
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage <= 0),
        new ButtonBuilder()
            .setCustomId('btn_trending_refresh')
            .setEmoji('🔄')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`btn_queue_page_${currentPage + 1}`)
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId('btn_trending_playall')
            .setEmoji('▶️')
            .setLabel('Play All')
            .setStyle(ButtonStyle.Success)
    );

    return row;
}

module.exports = { createTrendingEmbed, createTrendingButtons };