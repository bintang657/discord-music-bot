const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear queue'),

    async execute(interaction, bot) {
        // Check if user is owner or has manage server permission
        if (interaction.user.id !== bot.config.ownerId &&
            !interaction.member.permissions.has('ManageGuild')) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.error)
                    .setDescription('❌ You need **Manage Server** permission to stop the bot!')
                ],
                ephemeral: true
            });
        }

        bot.player.stop();

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(bot.config.embed.colors.warning)
                .setDescription('⏹️ Playback stopped and queue cleared.\nUse `/play` to start again!')
            ]
        });
    }
};