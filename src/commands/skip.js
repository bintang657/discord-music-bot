const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

    async execute(interaction, bot) {
        const currentSong = bot.queue.getCurrentSong();

        if (!currentSong) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.error)
                    .setDescription('❌ No song is currently playing!')
                ],
                ephemeral: true
            });
        }

        await bot.player.skip();

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(bot.config.embed.colors.success)
                .setDescription(`⏭️ Skipped: **${currentSong.title}**`)
            ]
        });
    }
};