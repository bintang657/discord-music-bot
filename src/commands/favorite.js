const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { truncate, formatDurationSeconds, chunkArray } = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('favorite')
        .setDescription('Manage your favorite songs')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add current song to favorites'))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('View your favorite songs'))
        .addSubcommand(sub =>
            sub.setName('play')
                .setDescription('Play your favorites playlist'))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a song from favorites')
                .addIntegerOption(option =>
                    option.setName('index')
                        .setDescription('Song number to remove')
                        .setRequired(true)
                        .setMinValue(1))),

    async execute(interaction, bot) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        switch (sub) {
            case 'add': {
                const song = bot.queue.getCurrentSong();
                if (!song) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(bot.config.embed.colors.error)
                            .setDescription('❌ No song is currently playing!')
                        ],
                        ephemeral: true
                    });
                }

                const added = bot.db.addFavorite(userId, song);
                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(added ? bot.config.embed.colors.success : bot.config.embed.colors.warning)
                        .setDescription(added
                            ? `❤️ Added **${truncate(song.title, 50)}** to your favorites!`
                            : `💛 **${truncate(song.title, 50)}** is already in your favorites!`)
                    ],
                    ephemeral: true
                });
                break;
            }

            case 'list': {
                const favorites = bot.db.getFavorites(userId);

                if (favorites.length === 0) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(bot.config.embed.colors.info)
                            .setDescription('📋 You have no favorite songs yet!\nUse `/favorite add` or click the ❤️ button to add songs.')
                        ],
                        ephemeral: true
                    });
                }

                let list = '';
                for (let i = 0; i < Math.min(favorites.length, 25); i++) {
                    const f = favorites[i];
                    list += `\`${i + 1}.\` **${truncate(f.title, 40)}** - ${truncate(f.artist, 25)}\n`;
                }

                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF69B4')
                        .setTitle(`❤️ ${interaction.user.username}'s Favorites`)
                        .setDescription(list)
                        .setFooter({ text: `${favorites.length} songs | Use /favorite play to queue all` })
                    ]
                });
                break;
            }

            case 'play': {
                const favorites = bot.db.getFavorites(userId);

                if (favorites.length === 0) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(bot.config.embed.colors.error)
                            .setDescription('❌ You have no favorite songs!')
                        ],
                        ephemeral: true
                    });
                }

                const songs = favorites.map(f => ({
                    title: f.title,
                    artist: f.artist,
                    youtube_url: f.youtube_url,
                    youtube_id: f.youtube_id,
                    requested_by: `<@${userId}>`,
                    isManualRequest: true
                }));

                bot.queue.addSongs(songs, true);

                if (!bot.player.isPlaying) {
                    await bot.player.playNext();
                }

                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(bot.config.embed.colors.success)
                        .setDescription(`❤️ Added **${songs.length}** favorites to queue!`)
                    ]
                });
                break;
            }

            case 'remove': {
                const index = interaction.options.getInteger('index') - 1;
                const favorites = bot.db.getFavorites(userId);

                if (index < 0 || index >= favorites.length) {
                    return interaction.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(bot.config.embed.colors.error)
                            .setDescription(`❌ Invalid index! You have ${favorites.length} favorites.`)
                        ],
                        ephemeral: true
                    });
                }

                const removed = bot.db.removeFavorite(userId, favorites[index].youtube_id);
                await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(bot.config.embed.colors.success)
                        .setDescription(removed
                            ? `🗑️ Removed **${truncate(favorites[index].title, 50)}** from favorites!`
                            : '❌ Failed to remove song.')
                    ],
                    ephemeral: true
                });
                break;
            }
        }
    }
};