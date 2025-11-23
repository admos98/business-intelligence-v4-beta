// src/pages/TaxReportsPage.tsx

import React, { useState, useMemo } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';
import { exportTaxReport } from '../lib/excelExport';
import { PieChart, PieChartData } from '../components/charts/PieChart';

export const TaxReportsPage: React.FC = () => {
  const { getTaxReport, taxSettings } = useShoppingStore();
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'mtd' | 'ytd' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showCharts, setShowCharts] = useState(true);

  const dateRange = useMemo(() => {
    const end = new Date();
    let start = new Date();

    switch (selectedPeriod) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case 'mtd':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'ytd':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (startDate && endDate) {
          return {
            start: new Date(startDate),
            end: new Date(endDate),
          };
        }
        break;
    }

    return { start, end };
  }, [selectedPeriod, startDate, endDate]);

  const taxReport = useMemo(() => {
    return getTaxReport(dateRange.start, dateRange.end);
  }, [dateRange, getTaxReport]);

  // Chart data
  const taxBreakdownData: PieChartData[] = useMemo(() => {
    const data: PieChartData[] = [];
    if (taxReport.taxableRevenue > 0) {
      data.push({ label: t.taxableSales, value: taxReport.taxableRevenue, color: '#10b981' });
    }
    if (taxReport.nonTaxableRevenue > 0) {
      data.push({ label: t.nonTaxableSales, value: taxReport.nonTaxableRevenue, color: '#6b7280' });
    }
    return data;
  }, [taxReport]);

  const handleExportExcel = () => {
    exportTaxReport({
      taxableRevenue: taxReport.taxableRevenue,
      nonTaxableRevenue: taxReport.nonTaxableRevenue,
      totalRevenue: taxReport.totalRevenue,
      taxCollected: taxReport.taxCollected,
      transactions: taxReport.transactions,
      period: {
        start: toJalaliDateString(taxReport.startDate.toISOString()),
        end: toJalaliDateString(taxReport.endDate.toISOString()),
      },
    });
  };

  if (!taxSettings.enabled) {
    return (
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {t.taxReports}
          </h1>
        </div>

        <Card>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              مالیات غیرفعال است
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              برای مشاهده گزارش‌های مالیاتی، ابتدا مالیات را از تنظیمات فعال کنید.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {t.taxReports}
        </h1>
      </div>

      {/* Period Selector */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          انتخاب بازه زمانی
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            onClick={() => setSelectedPeriod('7d')}
            variant={selectedPeriod === '7d' ? 'primary' : 'secondary'}
            size="sm"
          >
            7 روز گذشته
          </Button>
          <Button
            onClick={() => setSelectedPeriod('30d')}
            variant={selectedPeriod === '30d' ? 'primary' : 'secondary'}
            size="sm"
          >
            30 روز گذشته
          </Button>
          <Button
            onClick={() => setSelectedPeriod('mtd')}
            variant={selectedPeriod === 'mtd' ? 'primary' : 'secondary'}
            size="sm"
          >
            ماه جاری
          </Button>
          <Button
            onClick={() => setSelectedPeriod('ytd')}
            variant={selectedPeriod === 'ytd' ? 'primary' : 'secondary'}
            size="sm"
          >
            سال جاری
          </Button>
          <Button
            onClick={() => setSelectedPeriod('custom')}
            variant={selectedPeriod === 'custom' ? 'primary' : 'secondary'}
            size="sm"
          >
            دلخواه
          </Button>
        </div>

        {selectedPeriod === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                از تاریخ
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                تا تاریخ
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            گزارش از {toJalaliDateString(taxReport.startDate.toISOString())} تا{' '}
            {toJalaliDateString(taxReport.endDate.toISOString())}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportExcel}>
              📊 {t.exportToExcel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCharts(!showCharts)}
            >
              {showCharts ? '📋 ' + t.tableView : '📈 ' + t.chartView}
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              کل درآمد
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <CurrencyDisplay value={taxReport.totalRevenue} />
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.taxableSales}
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              <CurrencyDisplay value={taxReport.taxableRevenue} />
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.nonTaxableSales}
            </p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              <CurrencyDisplay value={taxReport.nonTaxableRevenue} />
            </p>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t.taxCollected}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              <CurrencyDisplay value={taxReport.taxCollected} />
            </p>
          </div>
        </Card>
      </div>

      {/* Charts */}
      {showCharts && taxBreakdownData.length > 0 && (
        <Card title="ترکیب درآمد (مشمول و معاف از مالیات)">
          <div className="flex justify-center">
            <PieChart data={taxBreakdownData} width={350} height={350} />
          </div>
        </Card>
      )}

      {/* Tax Summary */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          {t.taxSummary}
        </h2>

        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-gray-700 dark:text-gray-300">نرخ میانگین مالیات</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {t.taxPercentage(taxReport.taxRate)}
            </span>
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-gray-700 dark:text-gray-300">درصد فروش مشمول مالیات</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {taxReport.totalRevenue > 0
                ? ((taxReport.taxableRevenue / taxReport.totalRevenue) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>

          <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
            <span className="text-green-700 dark:text-green-300 font-medium">
              {t.totalTaxCollected}
            </span>
            <span className="font-bold text-green-900 dark:text-green-100 text-lg">
              <CurrencyDisplay value={taxReport.taxCollected} />
            </span>
          </div>
        </div>
      </Card>

      {/* Detailed Transactions */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          جزئیات تراکنش‌های مشمول مالیات
        </h2>

        {taxReport.transactions.length === 0 ? (
          <p className="text-center py-8 text-gray-500 dark:text-gray-400">
            هیچ تراکنش مشمول مالیاتی در این بازه زمانی وجود ندارد
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    شماره رسید
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    تاریخ
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    مبلغ فروش
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    نرخ مالیات
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    مبلغ مالیات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {taxReport.transactions.map((trans) => (
                  <tr key={trans.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      #{trans.receiptNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {toJalaliDateString(trans.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <CurrencyDisplay value={trans.amount} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.taxPercentage(trans.taxRate)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
                      <CurrencyDisplay value={trans.taxAmount} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    جمع کل
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <CurrencyDisplay value={taxReport.taxableRevenue} />
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400">
                    <CurrencyDisplay value={taxReport.taxCollected} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
