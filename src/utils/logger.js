const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    _timestamp() {
        return new Date().toISOString();
    }

    _write(level, ...args) {
        const msg = `[${this._timestamp()}] [${level}] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
        ).join(' ')}`;

        console.log(msg);

        const logFile = path.join(this.logDir, `bot-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, msg + '\n');
    }

    info(...args) { this._write('INFO', ...args); }
    warn(...args) { this._write('WARN', ...args); }
    error(...args) { this._write('ERROR', ...args); }
    debug(...args) { this._write('DEBUG', ...args); }
    player(...args) { this._write('PLAYER', ...args); }
    trending(...args) { this._write('TRENDING', ...args); }
}

module.exports = { Logger };