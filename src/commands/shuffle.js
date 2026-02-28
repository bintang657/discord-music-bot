const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Toggle shuffle mode'),

    async execute(interaction, bot) {
        const shuffled = bot.queue.toggleShuffle();

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(bot.config.embed.colors.info)
                .setDescription(`🔀 Shuffle mode: **${shuffled ? 'ON ✅' : 'OFF ❌'}**${shuffled ? '\n📋 Queue has been shuffled!' : ''}`)
            ]
        });
    }
};