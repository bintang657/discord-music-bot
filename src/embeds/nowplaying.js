const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createProgressBar, formatDurationSeconds, truncate, getGenreColor } = require('../utils/helpers');

function createNowPlayingEmbed(song, player, nextSong, config) {
    const elapsed = player.progress.getElapsed();
    const duration = song.duration || 0;
    const progressBar = createProgressBar(elapsed, duration, 20);
    const timeString = `${formatDurationSeconds(elapsed)}/${formatDurationSeconds(duration)}`;

    const color = getGenreColor(song.genre, config.embed.colors);

    const volumePercent = player.getVolume();
    const volumeBar = createVolumeBar(volumePercent);

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: '🎵 Now Playing',
            iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png'
        })
        .setTitle(truncate(song.title, 60))
        .setURL(song.youtube_url || `https://www.youtube.com/watch?v=${song.youtube_id}`)
        .setDescription(`${progressBar}\n\`${timeString}\``)
        .addFields(
            {
                name: '🎤 Artist',
                value: truncate(song.artist || 'Unknown', 40),
                inline: true
            },
            {
                name: '⏱️ Duration',
                value: formatDurationSeconds(duration),
                inline: true
            },
            {
                name: '🔊 Volume',
                value: `${volumeBar} ${volumePercent}%`,
                inline: true
            },
            {
                name: '🎛️ EQ Mode',
                value: getEQEmoji(player.getEQ()),
                inline: true
            },
            {
                name: '👤 Requested by',
                value: song.requested_by || '🤖 Auto-Trending',
                inline: true
            },
            {
                name: '🔀 Shuffle',
                value: player.queue.isShuffled() ? '✅ ON' : '❌ OFF',
                inline: true
            }
        );

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    const footerParts = [];
    if (song.rank) footerParts.push(`🔥 Trending #${song.rank} di TikTok`);
    if (nextSong) footerParts.push(`🎵 Next: ${truncate(nextSong.title, 30)}`);
    footerParts.push(`📋 Queue: ${player.queue.getQueueLength()} songs`);

    embed.setFooter({ text: footerParts.join(' | ') });
    embed.setTimestamp();

    return embed;
}

function createPlayerButtons(player) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_previous')
            .setEmoji('⏮️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_pause_resume')
            .setEmoji(player.isPaused ? '▶️' : '⏸️')
            .setStyle(player.isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('btn_skip')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_shuffle')
            .setEmoji('🔀')
            .setStyle(player.queue.isShuffled() ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('btn_favorite')
            .setEmoji('❤️')
            .setStyle(ButtonStyle.Danger)
    );

    return row;
}

function createVolumeBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '▰'.repeat(filled) + '▱'.repeat(empty);
}

function getEQEmoji(mode) {
    const emojis = {
        normal: '🎵 Normal',
        bassboost: '🔊 Bass Boost',
        vocal: '🎤 Vocal',
        nightcore: '🌙 Nightcore'
    };
    return emojis[mode] || '🎵 Normal';
}

module.exports = { createNowPlayingEmbed, createPlayerButtons };