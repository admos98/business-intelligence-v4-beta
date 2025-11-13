/**
 * Simple logging utility
 * In production, you might want to integrate with a service like Sentry
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;

class Logger {
    private shouldLog(level: LogLevel): boolean {
        if (!isDevelopment && level === 'debug') {
            return false;
        }
        return true;
    }

    private formatMessage(level: LogLevel, message: string, ...args: unknown[]): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        switch (level) {
            case 'error':
                console.error(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'info':
                console.info(prefix, message, ...args);
                break;
            case 'debug':
                console.debug(prefix, message, ...args);
                break;
        }
    }

    debug(message: string, ...args: unknown[]): void {
        this.formatMessage('debug', message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        this.formatMessage('info', message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.formatMessage('warn', message, ...args);
    }

    error(message: string, error?: unknown, ...args: unknown[]): void {
        if (error instanceof Error) {
            this.formatMessage('error', message, error, ...args);
        } else {
            this.formatMessage('error', message, error, ...args);
        }
    }
}

export const logger = new Logger();
