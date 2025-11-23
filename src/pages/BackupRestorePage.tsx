import React, { useState, useEffect, useMemo } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { usePageActions } from '../contexts/PageActionsContext';
import { useToast } from '../components/common/Toast';
import { toJalaliDateString } from '../../shared/jalali';
// exportData and importData are methods from useShoppingStore
import { StoredData } from '../lib/api';
import { logger } from '../utils/logger';

interface BackupVersion {
  id: string;
  timestamp: string;
  size: number;
  description?: string;
  data: StoredData;
}

const BACKUP_STORAGE_KEY = 'mehrnoosh_cafe_backups';
const MAX_LOCAL_BACKUPS = 10;

export const BackupRestorePage: React.FC = () => {
  const { exportData, importData } = useShoppingStore();
  const { setActions } = usePageActions();
  const { addToast } = useToast();
  const [localBackups, setLocalBackups] = useState<BackupVersion[]>([]);
  const [backupDescription, setBackupDescription] = useState<string>('');

  // Load local backups on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (stored) {
        const backups = JSON.parse(stored) as BackupVersion[];
        setLocalBackups(backups);
      }
    } catch (error) {
      logger.error('Failed to load backups:', error);
    }
  }, []);

  // Save backups to localStorage
  const saveBackupsToStorage = (backups: BackupVersion[]) => {
    try {
      // Keep only the most recent backups
      const sorted = [...backups].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const limited = sorted.slice(0, MAX_LOCAL_BACKUPS);
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(limited));
      setLocalBackups(limited);
    } catch (error) {
      logger.error('Failed to save backups:', error);
      addToast('خطا در ذخیره نسخه‌های پشتیبان', 'error');
    }
  };

  const handleCreateBackup = () => {
    try {
      const dataString = exportData();
      const data = JSON.parse(dataString) as StoredData;
      const size = new Blob([dataString]).size;

      const backup: BackupVersion = {
        id: `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        size,
        description: backupDescription.trim() || undefined,
        data,
      };

      const updated = [backup, ...localBackups];
      saveBackupsToStorage(updated);
      setBackupDescription('');
      addToast('نسخه پشتیبان با موفقیت ایجاد شد', 'success');
    } catch (error) {
      addToast('خطا در ایجاد نسخه پشتیبان', 'error');
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    const backup = localBackups.find(b => b.id === backupId);
    if (!backup) {
      addToast('نسخه پشتیبان یافت نشد', 'error');
      return;
    }

    if (!confirm(`آیا از بازگردانی این نسخه پشتیبان اطمینان دارید؟\nتاریخ: ${toJalaliDateString(backup.timestamp)}\nاین عمل داده‌های فعلی را جایگزین می‌کند.`)) {
      return;
    }

    try {
      await importData(JSON.stringify(backup.data));
      addToast('نسخه پشتیبان با موفقیت بازگردانی شد', 'success');
    } catch (error) {
      addToast('خطا در بازگردانی نسخه پشتیبان', 'error');
    }
  };

  const handleDeleteBackup = (backupId: string) => {
    if (!confirm('آیا از حذف این نسخه پشتیبان اطمینان دارید؟')) {
      return;
    }

    const updated = localBackups.filter(b => b.id !== backupId);
    saveBackupsToStorage(updated);
    addToast('نسخه پشتیبان حذف شد', 'success');
  };

  const handleExportBackup = (backupId: string) => {
    const backup = localBackups.find(b => b.id === backupId);
    if (!backup) {
      addToast('نسخه پشتیبان یافت نشد', 'error');
      return;
    }

    const dataString = JSON.stringify(backup.data, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `mehrnoosh_cafe_backup_${backup.timestamp.split('T')[0]}_${backup.id.slice(-8)}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    addToast('نسخه پشتیبان با موفقیت دانلود شد', 'success');
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const data = JSON.parse(result) as StoredData;
          const size = new Blob([result]).size;

          const backup: BackupVersion = {
            id: `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            size,
            description: `وارد شده از فایل: ${file.name}`,
            data,
          };

          const updated = [backup, ...localBackups];
          saveBackupsToStorage(updated);
          addToast('نسخه پشتیبان با موفقیت وارد شد', 'success');
        }
      } catch (error) {
        addToast('خطا در خواندن فایل پشتیبان', 'error');
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const handleExportAllData = () => {
    const dataString = exportData();
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `mehrnoosh_cafe_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    addToast('داده‌ها با موفقیت صادر شدند', 'success');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  React.useEffect(() => {
    setActions(
      <>
        <Button key="export-all" variant="ghost" size="sm" onClick={handleExportAllData}>
          صادر همه داده‌ها
        </Button>
      </>
    );
    return () => setActions(null);
  }, [setActions]);

  const sortedBackups = useMemo(() => {
    return [...localBackups].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [localBackups]);

  return (
    <>
      <Header title="پشتیبان‌گیری و بازگردانی" onBack={() => window.history.back()} backText="بازگشت" hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {/* Create Backup Section */}
        <Card title="ایجاد نسخه پشتیبان" className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                توضیحات (اختیاری)
              </label>
              <input
                type="text"
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
                placeholder="مثال: قبل از تغییرات مهم"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <Button onClick={handleCreateBackup} variant="primary">
              ایجاد نسخه پشتیبان
            </Button>
            <p className="text-xs text-secondary">
              نسخه‌های پشتیبان به صورت محلی در مرورگر ذخیره می‌شوند (حداکثر {MAX_LOCAL_BACKUPS} نسخه)
            </p>
          </div>
        </Card>

        {/* Import Backup Section */}
        <Card title="وارد کردن نسخه پشتیبان" className="mb-6">
          <div className="space-y-4">
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
              id="import-backup-input"
            />
            <label htmlFor="import-backup-input" className="cursor-pointer">
              <Button variant="ghost" onClick={() => document.getElementById('import-backup-input')?.click()}>
                انتخاب فایل پشتیبان
              </Button>
            </label>
            <p className="text-xs text-secondary">
              فایل JSON پشتیبان را انتخاب کنید تا به لیست نسخه‌های محلی اضافه شود
            </p>
          </div>
        </Card>

        {/* Backup List */}
        <Card title={`نسخه‌های پشتیبان محلی (${sortedBackups.length})`}>
          {sortedBackups.length === 0 ? (
            <div className="text-center py-8 text-secondary">
              هیچ نسخه پشتیبانی یافت نشد
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBackups.map(backup => (
                <div
                  key={backup.id}
                  className="p-4 rounded-lg border border-border bg-background"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-primary">
                          {toJalaliDateString(backup.timestamp, { format: 'long' })}
                        </span>
                        <span className="text-xs text-secondary">
                          {new Date(backup.timestamp).toLocaleTimeString('fa-IR')}
                        </span>
                      </div>
                      {backup.description && (
                        <div className="text-sm text-secondary mb-2">{backup.description}</div>
                      )}
                      <div className="text-xs text-secondary">
                        حجم: {formatFileSize(backup.size)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExportBackup(backup.id)}
                      >
                        دانلود
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestoreBackup(backup.id)}
                        className="text-accent"
                      >
                        بازگردانی
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBackup(backup.id)}
                        className="text-danger"
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Warning */}
        <Card className="mt-6 border-warning/20 bg-warning/5">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <div className="font-medium text-warning mb-1">هشدار</div>
              <div className="text-sm text-secondary">
                نسخه‌های پشتیبان محلی در مرورگر ذخیره می‌شوند و در صورت پاک کردن داده‌های مرورگر از بین می‌روند.
                برای اطمینان بیشتر، حتماً نسخه‌های مهم را دانلود و در جای امنی نگهداری کنید.
              </div>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
};
