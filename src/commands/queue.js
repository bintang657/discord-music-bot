const { SlashCommandBuilder } = require('discord.js');
const { createQueueEmbed, createQueueButtons } = require('../embeds/queue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current queue')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number')
                .setMinValue(1)),

    async execute(interaction, bot) {
        const page = (interaction.options.getInteger('page') || 1) - 1;

        const { embed, totalPages, currentPage } = createQueueEmbed(
            bot.queue, bot.player, page, bot.config
        );
        const buttons = createQueueButtons(currentPage, totalPages);

        const response = await interaction.reply({
            embeds: [embed],
            components: totalPages > 1 ? [buttons] : [],
            fetchReply: true
        });

        // Handle pagination
        if (totalPages > 1) {
            const collector = response.createMessageComponentCollector({
                time: 120000 // 2 minutes
            });

            collector.on('collect', async (btnInteraction) => {
                if (btnInteraction.user.id !== interaction.user.id) {
                    return btnInteraction.reply({
                        content: '❌ Only the command user can navigate pages!',
                        ephemeral: true
                    });
                }

                const newPage = parseInt(btnInteraction.customId.split('_').pop());
                const { embed: newEmbed, totalPages: tp, currentPage: cp } = createQueueEmbed(
                    bot.queue, bot.player, newPage, bot.config
                );
                const newButtons = createQueueButtons(cp, tp);

                await btnInteraction.update({
                    embeds: [newEmbed],
                    components: [newButtons]
                });
            });

            collector.on('end', async () => {
                try {
                    await response.edit({ components: [] });
                } catch { }
            });
        }
    }
};