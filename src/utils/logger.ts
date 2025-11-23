/**
 * Simple logging utility
 *
 * Provides structured logging with different log levels.
 * In production, consider integrating with a service like Sentry (see MONITORING_SETUP.md).
 *
 * Log levels:
 * - debug: Development-only detailed information
 * - info: General informational messages
 * - warn: Warning messages for potentially problematic situations
 * - error: Error messages for exceptional conditions
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevelopment = import.meta.env.DEV;

/**
 * Logger class for application-wide logging
 *
 * Automatically filters debug logs in production and formats all logs with timestamps.
 */
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

    /**
     * Log a debug message (development only)
     * @param message - Debug message
     * @param args - Additional arguments to log
     */
    debug(message: string, ...args: unknown[]): void {
        this.formatMessage('debug', message, ...args);
    }

    /**
     * Log an informational message
     * @param message - Info message
     * @param args - Additional arguments to log
     */
    info(message: string, ...args: unknown[]): void {
        this.formatMessage('info', message, ...args);
    }

    /**
     * Log a warning message
     * @param message - Warning message
     * @param args - Additional arguments to log
     */
    warn(message: string, ...args: unknown[]): void {
        this.formatMessage('warn', message, ...args);
    }

    /**
     * Log an error message
     * @param message - Error message
     * @param error - Optional Error object or additional error information
     * @param args - Additional arguments to log
     */
    error(message: string, error?: unknown, ...args: unknown[]): void {
        if (error instanceof Error) {
            this.formatMessage('error', message, error, ...args);
        } else {
            this.formatMessage('error', message, error, ...args);
        }
    }
}

/**
 * Global logger instance
 *
 * @example
 * ```typescript
 * import { logger } from '../utils/logger';
 *
 * logger.info('User logged in', { userId: '123' });
 * logger.error('Failed to save data', error);
 * logger.warn('Low disk space');
 * ```
 */
export const logger = new Logger();
