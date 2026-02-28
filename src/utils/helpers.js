function formatDuration(ms) {
    if (!ms || isNaN(ms)) return '0:00';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDurationSeconds(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
    const s = Math.floor(totalSeconds);
    const seconds = s % 60;
    const minutes = Math.floor(s / 60) % 60;
    const hours = Math.floor(s / 3600);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createProgressBar(current, total, length = 20) {
    if (!total || total === 0) return '▬'.repeat(length);
    const progress = Math.min(Math.floor((current / total) * length), length);
    const empty = length - progress;
    return '▬'.repeat(Math.max(0, progress)) + '🔘' + '▬'.repeat(Math.max(0, empty - 1));
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function truncate(str, maxLength = 50) {
    if (!str) return '';
    return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
}

function getRankEmoji(rank) {
    const emojis = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return emojis[rank] || `**#${rank}**`;
}

function getGenreColor(genre, colors) {
    const genreMap = {
        'pop': colors.pop,
        'hip hop': colors.hiphop,
        'hip-hop': colors.hiphop,
        'rap': colors.hiphop,
        'electronic': colors.electronic,
        'edm': colors.electronic,
        'dance': colors.electronic,
        'latin': colors.latin,
        'reggaeton': colors.latin,
        'r&b': colors.rnb,
        'rnb': colors.rnb,
        'soul': colors.rnb,
        'rock': colors.rock,
        'alternative': colors.rock,
    };

    if (!genre) return colors.default;
    const lower = genre.toLowerCase();
    for (const [key, color] of Object.entries(genreMap)) {
        if (lower.includes(key)) return color;
    }
    return colors.default;
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

module.exports = {
    formatDuration,
    formatDurationSeconds,
    createProgressBar,
    shuffleArray,
    truncate,
    getRankEmoji,
    getGenreColor,
    chunkArray
};