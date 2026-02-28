const { SlashCommandBuilder } = require('discord.js');
const { createTrendingEmbed, createTrendingButtons } = require('../embeds/trending');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trending')
        .setDescription('View TikTok trending songs')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)),

    async execute(interaction, bot) {
        await interaction.deferReply();

        const songs = bot.trending.getCachedSongs();
        const page = (interaction.options.getInteger('page') || 1) - 1;
        const lastFetch = bot.trending.getLastFetchTime();

        const { embed, totalPages, currentPage } = createTrendingEmbed(
            songs, page, lastFetch, bot.config
        );
        const buttons = createTrendingButtons(currentPage, totalPages);

        const response = await interaction.editReply({
            embeds: [embed],
            components: [buttons],
            fetchReply: true
        });

        // Handle pagination
        const collector = response.createMessageComponentCollector({
            time: 120000
        });

        collector.on('collect', async (btnInteraction) => {
            if (btnInteraction.customId.startsWith('btn_queue_page_')) {
                const newPage = parseInt(btnInteraction.customId.split('_').pop());
                const { embed: newEmbed, totalPages: tp, currentPage: cp } = createTrendingEmbed(
                    bot.trending.getCachedSongs(), newPage, bot.trending.getLastFetchTime(), bot.config
                );
                const newButtons = createTrendingButtons(cp, tp);

                await btnInteraction.update({
                    embeds: [newEmbed],
                    components: [newButtons]
                });
            }
            // Other buttons handled in bot.js handleButton
        });

        collector.on('end', async () => {
            try {
                await response.edit({ components: [] });
            } catch { }
        });
    }
};