// src/lib/indexedDB.ts
// IndexedDB wrapper for offline data storage

import { StoredData } from './api';
import { logger } from '../utils/logger';

const DB_NAME = 'mehrnoosh_cafe_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';
const SYNC_QUEUE_STORE = 'sync_queue';

interface SyncQueueItem {
  id: string;
  timestamp: string;
  action: 'save' | 'delete';
  data: StoredData;
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('IndexedDB open failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for app data
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }

        // Create object store for sync queue
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  async saveData(data: StoredData): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id: 'main', data, timestamp: new Date().toISOString() });

      request.onsuccess = () => {
        logger.info('Data saved to IndexedDB');
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to save to IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async getData(): Promise<StoredData | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('main');

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.data) {
          logger.info('Data loaded from IndexedDB');
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        logger.error('Failed to load from IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  async addToSyncQueue(data: StoredData): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const queueItem: Omit<SyncQueueItem, 'id'> = {
        timestamp: new Date().toISOString(),
        action: 'save',
        data,
      };
      const request = store.add(queueItem);

      request.onsuccess = () => {
        logger.info('Added to sync queue');
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to add to sync queue:', request.error);
        reject(request.error);
      };
    });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        logger.error('Failed to get sync queue:', request.error);
        reject(request.error);
      };
    });
  }

  async clearSyncQueue(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        logger.info('Sync queue cleared');
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to clear sync queue:', request.error);
        reject(request.error);
      };
    });
  }

  async removeSyncQueueItem(id: number): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SYNC_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(SYNC_QUEUE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        logger.error('Failed to remove sync queue item:', request.error);
        reject(request.error);
      };
    });
  }
}

export const indexedDBManager = new IndexedDBManager();

// Online/Offline detection helper
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' && navigator.onLine;
};

// Network status change listener
export const onNetworkStatusChange = (callback: (isOnline: boolean) => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};
