// src/pages/AgingReportsPage.tsx

import React, { useState, useMemo } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';
import { exportAgingReport } from '../lib/excelExport';

export const AgingReportsPage: React.FC = () => {
  const { getAgingReport } = useShoppingStore();
  const [reportType, setReportType] = useState<'receivable' | 'payable'>('receivable');

  const agingData = useMemo(() => {
    return getAgingReport(reportType);
  }, [reportType, getAgingReport]);

  const handleExportExcel = () => {
    exportAgingReport({
      type: reportType,
      current: agingData.current,
      days31to60: agingData.days31to60,
      days61to90: agingData.days61to90,
      over90: agingData.over90,
      total: agingData.total,
      details: agingData.details.map(d => ({
        ...d,
        invoiceDate: toJalaliDateString(d.invoiceDate),
        dueDate: toJalaliDateString(d.dueDate),
      })),
    });
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {t.agingReport}
        </h1>
        <Button variant="secondary" onClick={handleExportExcel}>
          📊 {t.exportToExcel}
        </Button>
      </div>

      <Card>
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setReportType('receivable')}
            variant={reportType === 'receivable' ? 'primary' : 'secondary'}
          >
            {t.accountsReceivable}
          </Button>
          <Button
            onClick={() => setReportType('payable')}
            variant={reportType === 'payable' ? 'primary' : 'secondary'}
          >
            {t.accountsPayable}
          </Button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          تا تاریخ: {toJalaliDateString(agingData.asOfDate.toISOString())}
        </p>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t.current}</div>
            <div className="font-bold text-green-600 dark:text-green-400">
              <CurrencyDisplay value={agingData.current.amount} />
            </div>
            <div className="text-xs text-gray-500">{agingData.current.count} فاکتور</div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t.days31to60}</div>
            <div className="font-bold text-yellow-600 dark:text-yellow-400">
              <CurrencyDisplay value={agingData.days31to60.amount} />
            </div>
            <div className="text-xs text-gray-500">{agingData.days31to60.count} فاکتور</div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t.days61to90}</div>
            <div className="font-bold text-orange-600 dark:text-orange-400">
              <CurrencyDisplay value={agingData.days61to90.amount} />
            </div>
            <div className="text-xs text-gray-500">{agingData.days61to90.count} فاکتور</div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t.over90Days}</div>
            <div className="font-bold text-red-600 dark:text-red-400">
              <CurrencyDisplay value={agingData.over90.amount} />
            </div>
            <div className="text-xs text-gray-500">{agingData.over90.count} فاکتور</div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{t.total}</div>
            <div className="font-bold text-blue-600 dark:text-blue-400 text-lg">
              <CurrencyDisplay value={agingData.total} />
            </div>
          </div>
        </div>

        {/* Details Table */}
        <h3 className="text-lg font-semibold mb-3">جزئیات</h3>
        {agingData.details.length === 0 ? (
          <p className="text-center py-8 text-gray-500">
            هیچ فاکتور معوق یافت نشد
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">نام</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.invoiceNumber}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.invoiceDate}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.dueDate}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">مبلغ</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">تأخیر (روز)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {agingData.details.map((detail) => (
                  <tr key={detail.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{detail.name}</td>
                    <td className="px-4 py-3 text-sm">{detail.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm">{toJalaliDateString(detail.invoiceDate)}</td>
                    <td className="px-4 py-3 text-sm">{toJalaliDateString(detail.dueDate)}</td>
                    <td className="px-4 py-3 font-semibold">
                      <CurrencyDisplay value={detail.amount} />
                    </td>
                    <td className={`px-4 py-3 font-semibold ${
                      detail.daysOverdue > 90 ? 'text-red-600' :
                      detail.daysOverdue > 60 ? 'text-orange-600' :
                      detail.daysOverdue > 30 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {detail.daysOverdue > 0 ? `${detail.daysOverdue} روز` : 'جاری'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold">
                    جمع کل
                  </td>
                  <td className="px-4 py-3 font-bold">
                    <CurrencyDisplay value={agingData.total} />
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
