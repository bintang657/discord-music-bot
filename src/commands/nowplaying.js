const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNowPlayingEmbed, createPlayerButtons } = require('../embeds/nowplaying');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing song'),

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

        const nextSongs = bot.queue.peek(1);
        const nextSong = nextSongs.length > 0 ? nextSongs[0] : null;

        const embed = createNowPlayingEmbed(currentSong, bot.player, nextSong, bot.config);
        const buttons = createPlayerButtons(bot.player);

        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    }
};