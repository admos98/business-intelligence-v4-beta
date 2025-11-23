// src/lib/geminiCache.ts
// Cache manager for Gemini AI responses to avoid duplicate API calls

import { logger } from '../utils/logger';

interface CacheEntry<T> {
    key: string;
    task: string;
    payloadHash: string;
    response: T;
    timestamp: number;
    expiresAt: number;
}

const CACHE_DB_NAME = 'gemini-cache';
const CACHE_STORE_NAME = 'responses';
const CACHE_VERSION = 1;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Maximum number of cache entries

// Tasks that should NOT be cached (e.g., image-based tasks)
const NON_CACHEABLE_TASKS = new Set(['parseReceipt']);

// Cache expiration check interval (1 hour)
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

class GeminiCacheManager {
    private db: IDBDatabase | null = null;
    private cleanupTimer: number | null = null;

    /**
     * Initialize the cache database
     */
    async init(): Promise<void> {
        if (this.db) {
            return; // Already initialized
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION);

            request.onerror = () => {
                logger.error('Failed to open Gemini cache database');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.startCleanupTimer();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
                    const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
                    store.createIndex('expiresAt', 'expiresAt', { unique: false });
                    store.createIndex('task', 'task', { unique: false });
                }
            };
        });
    }

    /**
     * Normalize payload for consistent cache key generation
     */
    private normalizePayload(payload: unknown): unknown {
        if (payload === null || payload === undefined) {
            return payload;
        }

        if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
            return payload;
        }

        if (Array.isArray(payload)) {
            return payload.map(item => this.normalizePayload(item));
        }

        if (typeof payload === 'object') {
            // Sort object keys for consistent hashing
            const sorted: Record<string, unknown> = {};
            const keys = Object.keys(payload).sort();
            for (const key of keys) {
                sorted[key] = this.normalizePayload((payload as Record<string, unknown>)[key]);
            }
            return sorted;
        }

        return payload;
    }

    /**
     * Generate a cache key from task and payload
     */
    private generateCacheKey(task: string, payload: unknown): string {
        // Normalize payload for consistent hashing
        const normalized = this.normalizePayload(payload);
        const payloadStr = JSON.stringify(normalized);

        // Simple hash function (for better performance than crypto.subtle)
        let hash = 0;
        const str = `${task}:${payloadStr}`;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return `gemini:${task}:${Math.abs(hash).toString(36)}`;
    }

    /**
     * Check if a task should be cached
     */
    private shouldCache(task: string): boolean {
        return !NON_CACHEABLE_TASKS.has(task);
    }

    /**
     * Get cached response if available and not expired
     */
    async get<T>(task: string, payload: unknown): Promise<T | null> {
        if (!this.shouldCache(task)) {
            return null; // Don't cache this task type
        }

        await this.ensureInitialized();

        const key = this.generateCacheKey(task, payload);

        return new Promise((resolve) => {
            if (!this.db) {
                resolve(null);
                return;
            }

            const transaction = this.db.transaction([CACHE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const entry = request.result as CacheEntry<T> | undefined;

                if (!entry) {
                    resolve(null);
                    return;
                }

                // Check if expired
                const now = Date.now();
                if (now > entry.expiresAt) {
                    // Entry expired, delete it
                    this.delete(key).catch(err =>
                        logger.warn('Failed to delete expired cache entry:', err)
                    );
                    resolve(null);
                    return;
                }

                logger.debug(`Cache hit for task: ${task}`);
                resolve(entry.response);
            };

            request.onerror = () => {
                logger.warn('Error reading from cache:', request.error);
                resolve(null);
            };
        });
    }

    /**
     * Store a response in cache
     */
    async set<T>(task: string, payload: unknown, response: T, ttlMs: number = DEFAULT_CACHE_TTL_MS): Promise<void> {
        if (!this.shouldCache(task)) {
            return; // Don't cache this task type
        }

        await this.ensureInitialized();

        // Check cache size and evict oldest entries if needed
        await this.enforceMaxSize();

        const key = this.generateCacheKey(task, payload);
        const now = Date.now();

        const entry: CacheEntry<T> = {
            key,
            task,
            payloadHash: key,
            response,
            timestamp: now,
            expiresAt: now + ttlMs,
        };

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Cache database not initialized'));
                return;
            }

            const transaction = this.db.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = () => {
                logger.debug(`Cached response for task: ${task}`);
                resolve();
            };

            request.onerror = () => {
                logger.warn('Error writing to cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Enforce maximum cache size by removing oldest entries
     */
    private async enforceMaxSize(): Promise<void> {
        if (!this.db) {
            return;
        }

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const count = countRequest.result;

                if (count < MAX_CACHE_SIZE) {
                    resolve();
                    return;
                }

                // Need to evict oldest entries
                const toDelete = count - MAX_CACHE_SIZE + 1; // +1 to make room for new entry
                const index = store.index('expiresAt');
                const cursorRequest = index.openCursor();

                let deleted = 0;

                cursorRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor && deleted < toDelete) {
                        cursor.delete();
                        deleted++;
                        cursor.continue();
                    } else {
                        if (deleted > 0) {
                            logger.debug(`Evicted ${deleted} oldest cache entries to maintain size limit`);
                        }
                        resolve();
                    }
                };

                cursorRequest.onerror = () => {
                    logger.warn('Error enforcing cache size limit:', cursorRequest.error);
                    resolve(); // Don't fail the cache operation
                };
            };

            countRequest.onerror = () => {
                logger.warn('Error checking cache size:', countRequest.error);
                resolve(); // Don't fail the cache operation - continue without size limit enforcement
            };
        });
    }

    /**
     * Delete a specific cache entry
     */
    private async delete(key: string): Promise<void> {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clean up expired cache entries
     */
    async cleanup(): Promise<void> {
        if (!this.db) {
            return;
        }

        const now = Date.now();
        let deletedCount = 0;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const index = store.index('expiresAt');
            const request = index.openCursor(IDBKeyRange.upperBound(now));

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    if (deletedCount > 0) {
                        logger.info(`Cleaned up ${deletedCount} expired cache entries`);
                    }
                    resolve();
                }
            };

            request.onerror = () => {
                logger.warn('Error during cache cleanup:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all cache entries for a specific task
     */
    async clearTask(task: string): Promise<void> {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const index = store.index('task');
            const request = index.openCursor(IDBKeyRange.only(task));

            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    if (deletedCount > 0) {
                        logger.info(`Cleared ${deletedCount} cache entries for task: ${task}`);
                    }
                    resolve();
                }
            };

            request.onerror = () => {
                logger.warn('Error clearing task cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all cache entries
     */
    async clearAll(): Promise<void> {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([CACHE_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                logger.info('Cleared all Gemini cache entries');
                resolve();
            };

            request.onerror = () => {
                logger.warn('Error clearing all cache:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{ total: number; expired: number }> {
        if (!this.db) {
            return { total: 0, expired: 0 };
        }

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([CACHE_STORE_NAME], 'readonly');
            const store = transaction.objectStore(CACHE_STORE_NAME);
            const request = store.count();

            let total = 0;
            let expired = 0;
            const now = Date.now();

            request.onsuccess = () => {
                total = request.result;

                // Count expired entries
                const index = store.index('expiresAt');
                const expiredRequest = index.openCursor(IDBKeyRange.upperBound(now));

                expiredRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                    if (cursor) {
                        expired++;
                        cursor.continue();
                    } else {
                        resolve({ total, expired });
                    }
                };

                expiredRequest.onerror = () => {
                    resolve({ total, expired: 0 });
                };
            };

            request.onerror = () => {
                resolve({ total: 0, expired: 0 });
            };
        });
    }

    /**
     * Start periodic cleanup timer
     */
    private startCleanupTimer(): void {
        if (this.cleanupTimer !== null) {
            return; // Timer already started
        }

        // Run cleanup immediately, then periodically
        this.cleanup().catch(err =>
            logger.warn('Initial cache cleanup failed:', err)
        );

        this.cleanupTimer = window.setInterval(() => {
            this.cleanup().catch(err =>
                logger.warn('Periodic cache cleanup failed:', err)
            );
        }, CLEANUP_INTERVAL_MS);
    }

    /**
     * Ensure database is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.db) {
            await this.init();
        }
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.cleanupTimer !== null) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

// Singleton instance
export const geminiCache = new GeminiCacheManager();

// Initialize cache on module load
if (typeof window !== 'undefined') {
    geminiCache.init().catch(err =>
        logger.warn('Failed to initialize Gemini cache:', err)
    );
}
