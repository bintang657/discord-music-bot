const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)),

    async execute(interaction, bot) {
        const level = interaction.options.getInteger('level');
        const newVolume = bot.player.setVolume(level);

        const bars = Math.round(newVolume / 10);
        const volumeBar = '▰'.repeat(bars) + '▱'.repeat(10 - bars);

        let emoji = '🔈';
        if (newVolume > 70) emoji = '🔊';
        else if (newVolume > 30) emoji = '🔉';
        else if (newVolume === 0) emoji = '🔇';

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(bot.config.embed.colors.info)
                .setDescription(`${emoji} Volume set to **${newVolume}%**\n${volumeBar}`)
            ]
        });
    }
};