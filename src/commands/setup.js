const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup bot channels')
        .addChannelOption(option =>
            option.setName('voice')
                .setDescription('Voice channel for music')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('text')
                .setDescription('Text channel for notifications')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),

    async execute(interaction, bot) {
        // Check permissions
        if (interaction.user.id !== bot.config.ownerId &&
            !interaction.member.permissions.has('ManageGuild')) {
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(bot.config.embed.colors.error)
                    .setDescription('❌ You need **Manage Server** permission to use this command!')
                ],
                ephemeral: true
            });
        }

        const voiceChannel = interaction.options.getChannel('voice');
        const textChannel = interaction.options.getChannel('text');
        const guildId = interaction.guildId;

        // Update settings
        bot.db.updateSettings(guildId, 'voice_channel_id', voiceChannel.id);
        bot.db.updateSettings(guildId, 'text_channel_id', textChannel.id);

        // Update player
        bot.player.voiceChannelId = voiceChannel.id;
        bot.player.textChannelId = textChannel.id;

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(bot.config.embed.colors.success)
                .setTitle('✅ Setup Complete!')
                .addFields(
                    { name: '🔊 Voice Channel', value: `<#${voiceChannel.id}>`, inline: true },
                    { name: '📝 Text Channel', value: `<#${textChannel.id}>`, inline: true }
                )
                .setDescription('The bot will now play music in the selected voice channel and send notifications to the text channel.')
            ]
        });

        // Reconnect to new channel
        if (bot.player.connection) {
            bot.player.disconnect();
        }

        setTimeout(async () => {
            await bot.player.autoJoinAndPlay();
        }, 2000);
    }
};