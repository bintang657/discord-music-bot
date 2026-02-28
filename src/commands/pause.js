const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume playback'),

    async execute(interaction, bot) {
        const result = bot.player.togglePause();

        const emoji = result.action === 'paused' ? '⏸️' : '▶️';
        const text = result.action === 'paused' ? 'Paused' : 'Resumed';

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(bot.config.embed.colors.info)
                .setDescription(`${emoji} Playback ${text}`)
            ]
        });
    }
};