const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNotification } = require('../embeds/notification');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or add it to queue')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name or YouTube URL')
                .setRequired(true)),

    async execute(interaction, bot) {
        await interaction.deferReply();

        const query = interaction.options.getString('query');
        const member = interaction.member;

        // Check if user is in a voice channel
        if (!member.voice.channel) {
            return interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.error)
                    .setDescription('❌ You need to be in a voice channel!')
                ]
            });
        }

        try {
            // Search YouTube
            const result = await bot.trending.searchYouTube(query);

            if (!result) {
                return interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(bot.config.embed.colors.error)
                        .setDescription(`❌ No results found for: **${query}**`)
                    ]
                });
            }

            const song = {
                title: result.title,
                artist: result.uploader || 'Unknown',
                youtube_url: result.url,
                youtube_id: result.id,
                thumbnail: result.thumbnail,
                duration: result.duration || 0,
                requested_by: `<@${interaction.user.id}>`,
                isManualRequest: true
            };

            // Add to queue with priority
            bot.queue.addSong(song, true);

            // If not playing, start
            if (!bot.player.isPlaying && !bot.player.isPaused) {
                // Join the user's voice channel if not already connected
                if (!bot.player.connection) {
                    await bot.player.joinChannel(member.voice.channel);
                    bot.player.initialize(interaction.guildId);
                }
                await bot.player.playNext();
            }

            const embed = createNotification('song_added', {
                title: song.title,
                artist: song.artist,
                thumbnail: song.thumbnail,
                requestedBy: `<@${interaction.user.id}>`,
                position: bot.queue.getQueueLength()
            }, bot.config);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            bot.logger.error('Play command error:', error.message);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.error)
                    .setDescription(`❌ Error: ${error.message}`)
                ]
            });
        }
    }
};