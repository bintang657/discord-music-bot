const { Logger } = require('./logger');

class KeepAlive {
    constructor(bot) {
        this.bot = bot;
        this.logger = new Logger();
        this.interval = null;
        this.healthInterval = null;
        this.lastActivity = Date.now();
    }

    start() {
        // Heartbeat every 30 seconds
        this.interval = setInterval(() => {
            this.lastActivity = Date.now();
            if (this.bot.client && this.bot.client.ws) {
                const ping = this.bot.client.ws.ping;
                if (ping < 0 || ping > 30000) {
                    this.logger.warn('⚠️ High latency or disconnected. Ping:', ping);
                }
            }
        }, 30000);

        // Health check every 60 seconds
        this.healthInterval = setInterval(async () => {
            try {
                await this.healthCheck();
            } catch (error) {
                this.logger.error('Health check failed:', error.message);
                await this.recover();
            }
        }, 60000);

        this.logger.info('💓 Keep-alive system started');
    }

    async healthCheck() {
        const bot = this.bot;

        // Check if client is connected
        if (!bot.client || !bot.client.isReady()) {
            throw new Error('Client not ready');
        }

        // Check voice connection
        if (bot.player && bot.player.guildId) {
            const connection = bot.player.getConnection();
            if (!connection && bot.config.autoplay.enabled) {
                this.logger.warn('🔄 Voice connection lost. Attempting reconnect...');
                await bot.player.autoJoinAndPlay();
            }
        }

        // Memory check
        const usage = process.memoryUsage();
        const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
        if (heapMB > 500) {
            this.logger.warn(`⚠️ High memory usage: ${heapMB}MB`);
            if (global.gc) global.gc();
        }
    }

    async recover() {
        this.logger.info('🔧 Attempting recovery...');
        try {
            if (this.bot.player) {
                await this.bot.player.autoJoinAndPlay();
            }
        } catch (error) {
            this.logger.error('Recovery failed:', error.message);
        }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        if (this.healthInterval) clearInterval(this.healthInterval);
        this.logger.info('💔 Keep-alive system stopped');
    }
}

module.exports = { KeepAlive };