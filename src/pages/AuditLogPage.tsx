import React, { useState, useMemo } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { AuditLogEntry } from '../../shared/types';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import { toJalaliDateString } from '../../shared/jalali';
import { usePageActions } from '../contexts/PageActionsContext';
import Button from '../components/common/Button';
import { exportToExcel } from '../lib/excelExport';
import { useToast } from '../components/common/Toast';

export const AuditLogPage: React.FC = () => {
  const { auditLog } = useShoppingStore();
  const { setActions } = usePageActions();
  const { addToast } = useToast();
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Get unique actions and users for filters
  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    auditLog.forEach(entry => actions.add(entry.action));
    return Array.from(actions).sort();
  }, [auditLog]);

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    auditLog.forEach(entry => {
      if (entry.userId) users.add(entry.userId);
    });
    return Array.from(users).sort();
  }, [auditLog]);

  // Filter and sort audit logs
  const filteredLogs = useMemo(() => {
    return auditLog
      .filter(entry => {
        if (filterAction !== 'all' && entry.action !== filterAction) return false;
        if (filterUser !== 'all' && entry.userId !== filterUser) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesName = entry.details.entityName?.toLowerCase().includes(query);
          const matchesId = entry.details.entityId?.toLowerCase().includes(query);
          const matchesAction = entry.action.toLowerCase().includes(query);
          const matchesUser = entry.userId?.toLowerCase().includes(query);
          if (!matchesName && !matchesId && !matchesAction && !matchesUser) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLog, filterAction, filterUser, searchQuery]);

  const handleExportExcel = () => {
    const data = filteredLogs.map(entry => ({
      'تاریخ': toJalaliDateString(entry.timestamp),
      'عملیات': getActionLabel(entry.action),
      'کاربر': entry.userId || 'سیستم',
      'موجودیت': entry.details.entityName || entry.details.entityId || '-',
      'جزئیات': JSON.stringify(entry.details.changes || entry.details.metadata || {}),
    }));

    exportToExcel(data, `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('گزارش لاگ با موفقیت صادر شد', 'success');
  };

  const getActionLabel = (action: AuditLogEntry['action']): string => {
    const labels: Record<AuditLogEntry['action'], string> = {
      transaction_created: 'ایجاد تراکنش',
      transaction_updated: 'به‌روزرسانی تراکنش',
      transaction_deleted: 'حذف تراکنش',
      item_created: 'ایجاد کالا',
      item_updated: 'به‌روزرسانی کالا',
      item_deleted: 'حذف کالا',
      refund_created: 'ایجاد برگشت',
      stock_updated: 'به‌روزرسانی موجودی',
      recipe_created: 'ایجاد دستور',
      recipe_updated: 'به‌روزرسانی دستور',
      recipe_deleted: 'حذف دستور',
    };
    return labels[action] || action;
  };

  React.useEffect(() => {
    setActions(
      <>
        <Button key="export-excel" variant="ghost" size="sm" onClick={handleExportExcel} disabled={filteredLogs.length === 0}>
          صادر Excel
        </Button>
      </>
    );
    return () => setActions(null);
  }, [setActions, filteredLogs.length]);

  return (
    <>
      <Header title="گزارش لاگ عملیات" onBack={() => window.history.back()} backText="بازگشت" hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {/* Filters */}
        <Card title="فیلترها" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">نوع عملیات</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">همه</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{getActionLabel(action as AuditLogEntry['action'])}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">کاربر</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">همه</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">جستجو</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در لاگ..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        </Card>

        {/* Results count */}
        <div className="mb-4 text-sm text-secondary">
          {filteredLogs.length} مورد از {auditLog.length} لاگ
        </div>

        {/* Audit Log Table */}
        {filteredLogs.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-secondary">
              لاگی یافت نشد
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right p-3 font-semibold text-primary">تاریخ و زمان</th>
                    <th className="text-right p-3 font-semibold text-primary">عملیات</th>
                    <th className="text-right p-3 font-semibold text-primary">کاربر</th>
                    <th className="text-right p-3 font-semibold text-primary">موجودیت</th>
                    <th className="text-right p-3 font-semibold text-primary">جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(entry => (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-background transition-colors">
                      <td className="p-3 text-secondary">
                        {toJalaliDateString(entry.timestamp, { format: 'long' })}
                        <br />
                        <span className="text-xs">{new Date(entry.timestamp).toLocaleTimeString('fa-IR')}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-accent/10 text-accent rounded-md text-xs font-medium">
                          {getActionLabel(entry.action)}
                        </span>
                      </td>
                      <td className="p-3 text-secondary">{entry.userId || 'سیستم'}</td>
                      <td className="p-3">
                        {entry.details.entityName || entry.details.entityId || '-'}
                      </td>
                      <td className="p-3">
                        {entry.details.changes && Object.keys(entry.details.changes).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-accent hover:text-accent/80 text-xs">مشاهده تغییرات</summary>
                            <div className="mt-2 p-2 bg-background rounded text-xs space-y-1">
                              {Object.entries(entry.details.changes).map(([key, change]) => (
                                <div key={key}>
                                  <span className="font-medium">{key}:</span>{' '}
                                  <span className="text-danger line-through">{String(change.old ?? '-')}</span>
                                  {' → '}
                                  <span className="text-accent">{String(change.new ?? '-')}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : entry.details.metadata ? (
                          <details className="cursor-pointer">
                            <summary className="text-accent hover:text-accent/80 text-xs">مشاهده جزئیات</summary>
                            <div className="mt-2 p-2 bg-background rounded text-xs">
                              <pre className="whitespace-pre-wrap">{JSON.stringify(entry.details.metadata, null, 2)}</pre>
                            </div>
                          </details>
                        ) : (
                          <span className="text-secondary text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </>
  );
};
