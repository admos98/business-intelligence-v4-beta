import React, { useState, useMemo } from 'react';
import { SellSummaryData } from '../../shared/types';
import Header from '../components/common/Header';
import { useShoppingStore } from '../store/useShoppingStore';

import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';
import SkeletonLoader from '../components/common/SkeletonLoader';

interface SellAnalysisDashboardProps {
  onLogout: () => void;
}

type SummaryPeriod = '7d' | '30d' | 'mtd' | 'ytd' | 'all';

const SellAnalysisDashboard: React.FC<SellAnalysisDashboardProps> = ({ onLogout }) => {
  const store = useShoppingStore();
  const { getSellSummaryData } = store;

  const [period, setPeriod] = useState<SummaryPeriod>('mtd');

  const summaryData: SellSummaryData | null = useMemo(() => {
    return getSellSummaryData(period);
  }, [period, getSellSummaryData]);

  const isLoading = false;

  const handleExportAnalysisJson = () => {
    if (!summaryData) {
      return;
    }
    const dataString = JSON.stringify({ period, data: summaryData }, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sell_analysis_${period}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAnalysisCsv = () => {
    if (!summaryData) {
      return;
    }
    const headers = ['Metric', 'Value'];
    const rows: (string | number)[][] = [
      ['Period', period],
      ['Total Revenue', summaryData.kpis.totalRevenue],
      ['Total Transactions', summaryData.kpis.totalTransactions],
      ['Avg Transaction Value', summaryData.kpis.avgTransactionValue],
      ...(summaryData.kpis.topItem ? [['Top Item', `${summaryData.kpis.topItem.name} (${summaryData.kpis.topItem.quantity})`]] : []),
      ...(summaryData.kpis.topCategory ? [['Top Category', `${summaryData.kpis.topCategory.name} (${summaryData.kpis.topCategory.revenue})`]] : []),
    ];
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sell_analysis_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header title="تحلیل فروش و درآمد" onLogout={onLogout}>
        <button onClick={handleExportAnalysisCsv} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر کردن CSV
        </button>
        <button onClick={handleExportAnalysisJson} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر کردن JSON
        </button>
      </Header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* PERIOD SELECTOR */}
        <div className="flex flex-wrap gap-2 justify-center">
          {['7d', '30d', 'mtd', 'ytd', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as SummaryPeriod)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === p
                  ? 'bg-accent text-accent-text'
                  : 'bg-surface text-primary border border-border hover:bg-border'
              }`}
            >
              {p === '7d' ? '۷ روز' : p === '30d' ? '۳۰ روز' : p === 'mtd' ? 'ماه جاری' : p === 'ytd' ? 'سال جاری' : 'کل'}
            </button>
          ))}
        </div>

        {isLoading || !summaryData ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} lines={2} />
            ))}
          </div>
        ) : (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard
                title="کل درآمد"
                value={<CurrencyDisplay value={summaryData.kpis.totalRevenue} />}
                subtitle={`${summaryData.kpis.totalTransactions} تراکنش`}
                color="accent"
              />
              <KPICard
                title="متوسط هر تراکنش"
                value={<CurrencyDisplay value={summaryData.kpis.avgTransactionValue} />}
                subtitle={`${summaryData.kpis.totalTransactions} فروش`}
                color="primary"
              />
              {summaryData.kpis.topItem && (
                <KPICard
                  title="محبوب‌ترین کالا"
                  value={summaryData.kpis.topItem.name}
                  subtitle={`${summaryData.kpis.topItem.quantity} فروخته شده`}
                  color="success"
                />
              )}
              {summaryData.kpis.topCategory && (
                <KPICard
                  title="پرفروش‌ترین دسته"
                  value={summaryData.kpis.topCategory.name}
                  subtitle={<CurrencyDisplay value={summaryData.kpis.topCategory.revenue} />}
                  color="warning"
                />
              )}
            </div>

            {/* CHARTS ROW 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* REVENUE OVER TIME */}
              <Card title="روند درآمد">
                <div className="h-60 flex items-end justify-between gap-2 px-2">
                  {summaryData.charts.revenueOverTime.data.length === 0 ? (
                    <p className="text-center text-secondary w-full py-16">هیچ داده‌ای برای نمایش وجود ندارد</p>
                  ) : (
                    <>
                      {summaryData.charts.revenueOverTime.data.map((value, idx) => {
                        const maxValue = Math.max(...summaryData.charts.revenueOverTime.data, 1);
                        const height = (value / maxValue) * 100;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                            <div
                              className="w-full bg-accent rounded-t transition-all hover:opacity-80"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${summaryData.charts.revenueOverTime.labels[idx]}: ${value.toLocaleString('fa-IR')}`}
                            />
                            <span className="text-xs text-secondary text-center truncate">
                              {summaryData.charts.revenueOverTime.labels[idx]}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </Card>

              {/* REVENUE BY CATEGORY */}
              <Card title="درآمد بر حسب دسته">
                <div className="space-y-3">
                  {summaryData.charts.revenueByCategory.labels.length === 0 ? (
                    <p className="text-center text-secondary py-12">هیچ داده‌ای برای نمایش وجود ندارد</p>
                  ) : (
                    <>
                      {summaryData.charts.revenueByCategory.labels.map((label, idx) => {
                        const value = summaryData.charts.revenueByCategory.data[idx];
                        const maxValue = Math.max(...summaryData.charts.revenueByCategory.data, 1);
                        const percent = (value / maxValue) * 100;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-primary truncate">{label}</span>
                              <CurrencyDisplay value={value} className="text-sm font-semibold text-accent" />
                            </div>
                            <div className="w-full bg-background rounded-full h-2">
                              <div
                                className="bg-accent rounded-full h-2 transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </Card>
            </div>

            {/* POPULAR ITEMS */}
            <Card title="محبوب‌ترین اقلام">
              <div className="space-y-2">
                {summaryData.charts.itemPopularity.labels.length === 0 ? (
                  <p className="text-center text-secondary py-8">هیچ داده‌ای برای نمایش وجود ندارد</p>
                ) : (
                  <>
                    {summaryData.charts.itemPopularity.labels.map((label, idx) => {
                      const quantity = summaryData.charts.itemPopularity.data[idx];
                      const maxQuantity = Math.max(...summaryData.charts.itemPopularity.data, 1);
                      const percent = (quantity / maxQuantity) * 100;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-primary truncate">{label}</span>
                              <span className="text-xs font-semibold text-secondary">{quantity} فروخته</span>
                            </div>
                            <div className="w-full bg-background rounded-full h-2">
                              <div
                                className="bg-success rounded-full h-2 transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  );
};

interface KPICardProps {
  title: string;
  value: React.ReactNode;
  subtitle: React.ReactNode;
  color: 'accent' | 'primary' | 'success' | 'warning' | 'danger';
}

const KPICard: React.FC<KPICardProps> = ({ title, value, subtitle, color }) => {
  const colorClasses: Record<string, string> = {
    accent: 'border-accent bg-accent/5 text-accent',
    primary: 'border-primary bg-primary/5 text-primary',
    success: 'border-success bg-success/5 text-success',
    warning: 'border-yellow-500 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400',
    danger: 'border-danger bg-danger/5 text-danger',
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 shadow-card ${colorClasses[color]} bg-surface`}>
      <p className="text-xs font-medium text-secondary mb-1">{title}</p>
      <p className="text-xl md:text-2xl font-bold mb-2">{value}</p>
      <p className="text-xs text-secondary">{subtitle}</p>
    </div>
  );
};

export default SellAnalysisDashboard;
