import { ShoppingList, Vendor, POSItem, SellTransaction, Recipe, StockEntry, Account, JournalEntry, TaxSettings, TaxRate, Customer, Invoice, Payment } from '../../shared/types';
import { logger } from '../utils/logger';
import { indexedDBManager, isOnline } from './indexedDB';

export interface StoredData {
    lists: ShoppingList[];
    customCategories: string[];
    vendors: Vendor[];
    categoryVendorMap: Record<string, string>;
    itemInfoMap: Record<string, { unit: string; category: string }>;
    posItems?: POSItem[];
    posCategories?: string[];
    sellTransactions?: SellTransaction[];
    recipes?: Recipe[];
    stockEntries?: Record<string, StockEntry>;
    accounts?: Account[];
    journalEntries?: JournalEntry[];
    taxSettings?: TaxSettings;
    taxRates?: TaxRate[];
    customers?: Customer[];
    invoices?: Invoice[];
    payments?: Payment[];
}

interface ApiErrorResponse {
    error?: string;
    details?: string;
}

/**
 * Fetches application data from cloud storage or local IndexedDB
 *
 * Attempts to fetch from cloud (GitHub Gist) first if online, falls back to IndexedDB
 * if offline or if cloud fetch fails. Saves cloud data to IndexedDB for offline access.
 *
 * @returns Promise resolving to the stored data, or null if no data is available
 * @throws Error if data fetching fails
 *
 * @example
 * ```typescript
 * const data = await fetchData();
 * if (data) {
 *   // Use data
 * }
 * ```
 */
export const fetchData = async (): Promise<StoredData | null> => {
    try {
        // Try to fetch from cloud first if online
        if (isOnline()) {
            try {
                const response = await fetch('/api/data', {
                    signal: AbortSignal.timeout(30000), // 30 second timeout
                });

                if (!response.ok) {
                    let errorMessage = response.statusText;
                    try {
                        const errorData = await response.json() as ApiErrorResponse;
                        errorMessage = errorData.details || errorData.error || errorMessage;
                    } catch {
                        // If JSON parsing fails, use status text
                    }
                    throw new Error(`Failed to fetch data: ${errorMessage}`);
                }

                // Vercel's response for an empty body might be a 204 No Content
                if (response.status === 204) {
                    // Try IndexedDB as fallback
                    return await indexedDBManager.getData();
                }

                const cloudData = await response.json() as StoredData;

                // Save to IndexedDB for offline access
                try {
                    await indexedDBManager.saveData(cloudData);
                } catch (dbError) {
                    logger.warn('Failed to save to IndexedDB:', dbError);
                }

                return cloudData;
            } catch (networkError) {
                logger.warn('Network fetch failed, trying IndexedDB:', networkError);
                // Fall through to IndexedDB
            }
        }

        // Fallback to IndexedDB if offline or network failed
        const localData = await indexedDBManager.getData();
        if (localData) {
            logger.info('Loaded data from IndexedDB (offline mode)');
            return localData;
        }

        return null;

    } catch (error) {
        if (error instanceof Error) {
            logger.error("Error in fetchData:", error);
            throw error;
        }
        throw new Error("Unknown error occurred while fetching data");
    }
};

/**
 * Saves application data to both local IndexedDB and cloud storage
 *
 * Implements offline-first strategy:
 * 1. Always saves to IndexedDB first (for immediate offline access)
 * 2. Attempts to save to cloud if online
 * 3. Queues data for sync if offline or cloud save fails
 *
 * @param data - The data to save
 * @returns Promise that resolves when save operation completes
 * @throws Error if critical save operation fails
 *
 * @example
 * ```typescript
 * await saveData({
 *   lists: [...],
 *   vendors: [...],
 *   // ... other data
 * });
 * ```
 */
export const saveData = async (data: StoredData): Promise<void> => {
    // Always save to IndexedDB first for offline support
    try {
        await indexedDBManager.saveData(data);
    } catch (dbError) {
        logger.warn('Failed to save to IndexedDB:', dbError);
    }

    // Try to save to cloud if online
    if (isOnline()) {
        try {
            const response = await fetch('/api/data', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(30000), // 30 second timeout
            });

            if (!response.ok) {
                let errorMessage = response.statusText;
                try {
                    const errorData = await response.json() as ApiErrorResponse;
                    errorMessage = errorData.details || errorData.error || errorMessage;
                } catch {
                    // If JSON parsing fails, use status text
                }
                throw new Error(`Failed to save data: ${errorMessage}`);
            }

            // Successfully saved to cloud, clear sync queue if any
            try {
                await indexedDBManager.clearSyncQueue();
            } catch (queueError) {
                logger.warn('Failed to clear sync queue:', queueError);
            }

            return;
        } catch (networkError) {
            logger.warn('Network save failed, adding to sync queue:', networkError);
            // Add to sync queue for later retry
            try {
                await indexedDBManager.addToSyncQueue(data);
            } catch (queueError) {
                logger.error('Failed to add to sync queue:', queueError);
            }
            // Don't throw - data is saved locally
            return;
        }
    } else {
        // Offline - add to sync queue
        logger.info('Offline mode: data saved locally, queued for sync');
        try {
            await indexedDBManager.addToSyncQueue(data);
        } catch (queueError) {
            logger.error('Failed to add to sync queue:', queueError);
        }
    }
};

/**
 * Syncs queued data to cloud when connection is restored
 *
 * Processes the sync queue created during offline operations.
 * Uses the most recent data in the queue to avoid conflicts.
 * Clears the queue after successful sync.
 *
 * Should be called when network connection is detected (e.g., in OfflineIndicator component).
 *
 * @returns Promise that resolves when sync operation completes
 *
 * @example
 * ```typescript
 * // In a component that detects online status
 * useEffect(() => {
 *   if (navigator.onLine) {
 *     syncQueuedData();
 *   }
 * }, [isOnline]);
 * ```
 */
export const syncQueuedData = async (): Promise<void> => {
    if (!isOnline()) {
        logger.info('Still offline, skipping sync');
        return;
    }

    try {
        const queue = await indexedDBManager.getSyncQueue();
        if (queue.length === 0) {
            return;
        }

        logger.info(`Syncing ${queue.length} queued items...`);

        // Get the most recent data (last item in queue)
        const latestItem = queue[queue.length - 1];

        try {
            const response = await fetch('/api/data', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(latestItem.data),
                signal: AbortSignal.timeout(30000),
            });

            if (response.ok) {
                // Successfully synced, clear queue
                await indexedDBManager.clearSyncQueue();
                logger.info('Sync queue cleared successfully');
            } else {
                logger.warn('Sync failed, will retry later');
            }
        } catch (error) {
            logger.warn('Sync error, will retry later:', error);
        }
    } catch (error) {
        logger.error('Failed to process sync queue:', error);
    }
};
