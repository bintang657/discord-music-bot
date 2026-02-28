'use strict';

const { MusicBot } = require('./src/bot');
const { Logger } = require('./src/utils/logger');
const { KeepAlive } = require('./src/utils/keepalive');

const logger = new Logger();

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT. Graceful shutdown...');
    bot.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM. Graceful shutdown...');
    bot.destroy();
    process.exit(0);
});

const bot = new MusicBot();
const keepAlive = new KeepAlive(bot);

async function main() {
    try {
        logger.info('╔══════════════════════════════════════════════╗');
        logger.info('║  🎵 Discord Music Bot 24/7                  ║');
        logger.info('║  TikTok Trending Auto-Player                ║');
        logger.info('║  Starting up...                             ║');
        logger.info('╚══════════════════════════════════════════════╝');

        await bot.initialize();
        keepAlive.start();

        logger.info('✅ Bot is fully operational!');
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

main();