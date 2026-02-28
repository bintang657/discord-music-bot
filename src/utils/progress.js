const { createProgressBar, formatDurationSeconds } = require('./helpers');

class ProgressTracker {
    constructor() {
        this.startTime = null;
        this.duration = 0;
        this.pausedAt = null;
        this.totalPausedTime = 0;
    }

    start(durationSeconds) {
        this.startTime = Date.now();
        this.duration = durationSeconds;
        this.pausedAt = null;
        this.totalPausedTime = 0;
    }

    pause() {
        if (!this.pausedAt) {
            this.pausedAt = Date.now();
        }
    }

    resume() {
        if (this.pausedAt) {
            this.totalPausedTime += Date.now() - this.pausedAt;
            this.pausedAt = null;
        }
    }

    getElapsed() {
        if (!this.startTime) return 0;
        let elapsed = Date.now() - this.startTime - this.totalPausedTime;
        if (this.pausedAt) {
            elapsed -= (Date.now() - this.pausedAt);
        }
        return Math.max(0, Math.floor(elapsed / 1000));
    }

    getProgressBar(length = 20) {
        const elapsed = this.getElapsed();
        return createProgressBar(elapsed, this.duration, length);
    }

    getTimeString() {
        const elapsed = this.getElapsed();
        return `${formatDurationSeconds(elapsed)}/${formatDurationSeconds(this.duration)}`;
    }

    isFinished() {
        return this.getElapsed() >= this.duration;
    }
}

module.exports = { ProgressTracker };