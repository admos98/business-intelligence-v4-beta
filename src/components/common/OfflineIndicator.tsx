import React, { useState, useEffect } from 'react';
import { onNetworkStatusChange, isOnline } from '../../lib/indexedDB';
import { syncQueuedData } from '../../lib/api';
import { useToast } from './Toast';

export const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState(isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const cleanup = onNetworkStatusChange(async (isOnline) => {
      setOnline(isOnline);

      if (isOnline) {
        // Connection restored - try to sync
        setIsSyncing(true);
        try {
          await syncQueuedData();
          addToast('داده‌ها با موفقیت همگام‌سازی شدند', 'success');
        } catch (error) {
          addToast('خطا در همگام‌سازی داده‌ها', 'error');
        } finally {
          setIsSyncing(false);
        }
      } else {
        addToast('اتصال به اینترنت قطع شد - حالت آفلاین فعال است', 'warning');
      }
    });

    return cleanup;
  }, [addToast]);

  if (online && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
      <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
        isSyncing
          ? 'bg-accent text-accent-text'
          : 'bg-warning text-warning-text'
      }`}>
        {isSyncing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
            <span className="text-sm font-medium">در حال همگام‌سازی...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <span className="text-sm font-medium">حالت آفلاین</span>
          </>
        )}
      </div>
    </div>
  );
};
