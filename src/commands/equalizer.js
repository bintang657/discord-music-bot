const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equalizer')
        .setDescription('Set equalizer preset')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('EQ preset')
                .setRequired(true)
                .addChoices(
                    { name: '🎵 Normal', value: 'normal' },
                    { name: '🔊 Bass Boost', value: 'bassboost' },
                    { name: '🎤 Vocal', value: 'vocal' },
                    { name: '🌙 Nightcore', value: 'nightcore' }
                )),

    async execute(interaction, bot) {
        const mode = interaction.options.getString('mode');

        await interaction.deferReply();

        const success = bot.player.setEQ(mode);

        const eqEmojis = {
            normal: '🎵',
            bassboost: '🔊',
            vocal: '🎤',
            nightcore: '🌙'
        };

        const eqDescriptions = {
            normal: 'Flat response, no effects',
            bassboost: 'Enhanced low frequencies for that bass punch!',
            vocal: 'Enhanced mid frequencies for clear vocals',
            nightcore: 'Sped up with higher pitch - anime vibes!'
        };

        if (success) {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.success)
                    .setTitle(`${eqEmojis[mode]} Equalizer: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`)
                    .setDescription(eqDescriptions[mode])
                    .addFields({
                        name: 'Note',
                        value: 'The current song will restart with the new EQ applied.'
                    })
                ]
            });
        } else {
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.error)
                    .setDescription('❌ Invalid EQ mode!')
                ]
            });
        }
    }
};