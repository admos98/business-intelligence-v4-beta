import React, { useState, useEffect, useRef, useMemo } from 'react';
// FIX: Add .tsx extension to fix module import error
import Header from '../components/common/Header.tsx';
import Card from '../components/common/Card.tsx';
// FIX: Add .ts extension to fix module import error
import { t } from '../../shared/translations.ts';
import { useShoppingStore } from '../store/useShoppingStore.ts';
import { SummaryData } from '../../shared/types.ts';
import { generateExecutiveSummary } from '../lib/gemini.ts';
import SkeletonLoader from '../components/common/SkeletonLoader.tsx';
import CurrencyDisplay from '../components/common/CurrencyDisplay.tsx';
import { useToast } from '../components/common/Toast.tsx';
// FIX: Replace declare with import for Chart.js
import { Chart } from 'chart.js/auto';


type Period = '7d' | '30d' | 'mtd' | 'ytd' | 'all';

interface SummaryDashboardProps {
  onBack: () => void;
}

const LoadingOverlay = () => (
  <div className="absolute inset-0 bg-surface/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
    <svg className="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);


const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ onBack }) => {
  const [period, setPeriod] = useState<Period>('30d');
  const getSummaryData = useShoppingStore(state => state.getSummaryData);
  const { addToast } = useToast();

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const spendingTimeChartRef = useRef<HTMLCanvasElement | null>(null);
  const spendingTimeChartInstance = useRef<any | null>(null);
  const spendingCategoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const spendingCategoryChartInstance = useRef<any | null>(null);

  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => {
        try {
            const data = getSummaryData(period);
            setSummaryData(data);
            if (isInitialLoading) {
                setIsInitialLoading(false);
            }
        } catch (error) {
            console.error('Error loading summary data:', error);
            setSummaryData(null);
            setIsInitialLoading(false);
        } finally {
            setIsUpdating(false);
        }
    }, 100); // Small delay to allow UI to show loading state

    return () => clearTimeout(timer);
  }, [period, getSummaryData, isInitialLoading]);

// src/pages/SummaryDashboard.tsx

// Make sure this useEffect looks like this again:
useEffect(() => {
  let cancelled = false;
  if (summaryData) {
    setIsAiLoading(true);
    // Just pass the original summaryData from state. No TypeScript error.
    generateExecutiveSummary(summaryData)
      .then((result) => {
        if (!cancelled) {
          setAiSummary(result);
        }
      })
      .catch(err => {
          if (!cancelled) {
            console.error(err);
            setAiSummary(t.aiSummaryError);
          }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAiLoading(false);
        }
      });
  } else {
    setAiSummary('');
  }
  return () => {
    cancelled = true;
  };
}, [summaryData]);

  const handleExportJson = () => {
    if (!summaryData) return;

    const dataToExport = {
      periodIdentifier: period,
      aiSummary,
      ...summaryData, // This will correctly include summaryData.period with its start/end dates
    };

    const dataString = JSON.stringify(dataToExport, (key, value) => {
      // Dates are objects, stringify them for cleaner JSON
      if (key === 'startDate' || key === 'endDate') {
        return new Date(value).toISOString();
      }
      return value;
    }, 2);

    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary_report_${period}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t.exportJsonSuccess, 'success');
  };

  const formatLargeNumber = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
      return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (Math.abs(value) >= 1_000) {
      return (value / 1_000).toFixed(0) + 'K';
    }
    return value.toLocaleString('fa-IR');
  };

  const lineChartOptions = useMemo(() => ({
      responsive: true,
      maintainAspectRatio: false,
      // FIX: Cast interaction mode to const to fix type error
      interaction: { intersect: false, mode: 'index' as const },
      scales: {
          x: {
              ticks: {
                  font: { family: "'Vazirmatn', sans-serif" },
                  autoSkip: true,
                  maxRotation: 45,
                  minRotation: 0,
              }
          },
          y: {
              ticks: {
                  font: { family: "'Vazirmatn', sans-serif" },
                  callback: function(value: number | string) {
                      return formatLargeNumber(typeof value === 'string' ? parseFloat(value) : value);
                  }
              }
          }
      },
      plugins: {
          legend: { display: false },
          tooltip: {
              bodyFont: { family: "'Vazirmatn', sans-serif" },
              titleFont: { family: "'Vazirmatn', sans-serif" },
              callbacks: {
                  label: function(context: any) {
                      let label = context.dataset.label || '';
                      if (label) {
                          label += ': ';
                      }
                      if (context.parsed.y !== null) {
                          label += context.parsed.y.toLocaleString('fa-IR');
                      }
                      return label;
                  }
              }
          }
      }
  }), []);

  const doughnutChartOptions = useMemo(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
          legend: {
              // FIX: Cast legend position to const to fix type error
              position: 'right' as const,
              labels: { font: { family: "'Vazirmatn', sans-serif" }}
          },
          tooltip: {
              bodyFont: { family: "'Vazirmatn', sans-serif" },
              titleFont: { family: "'Vazirmatn', sans-serif" },
              callbacks: {
                  label: function(context: any) {
                      let label = context.label || '';
                      if (label) {
                          label += ': ';
                      }
                      const total = context.chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
                      const value = context.parsed;
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';

                      return `${label}: ${value.toLocaleString('fa-IR')} (${percentage})`;
                  }
              }
          }
      }
  }), []);


  useEffect(() => {
    if (spendingTimeChartInstance.current) spendingTimeChartInstance.current.destroy();
    if (spendingTimeChartRef.current && summaryData?.charts?.spendingOverTime) {
      try {
        const styles = getComputedStyle(document.documentElement);
        const accentColor = styles.getPropertyValue('--color-accent').trim();
        const accentSoftColor = styles.getPropertyValue('--color-accent-soft').trim();

        const ctx = spendingTimeChartRef.current.getContext('2d');
        if (ctx && summaryData.charts.spendingOverTime.labels && summaryData.charts.spendingOverTime.data) {
          spendingTimeChartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: summaryData.charts.spendingOverTime.labels,
              datasets: [{
                label: t.totalSpend,
                data: summaryData.charts.spendingOverTime.data,
                borderColor: accentColor,
                backgroundColor: accentSoftColor,
                fill: true,
                tension: 0.3,
              }],
            },
            options: lineChartOptions,
          });
        }
      } catch (error) {
        console.error('Error rendering spending time chart:', error);
      }
    }
    return () => {
      if (spendingTimeChartInstance.current) {
        spendingTimeChartInstance.current.destroy();
        spendingTimeChartInstance.current = null;
      }
    };
  }, [summaryData, lineChartOptions, t.totalSpend]);

  useEffect(() => {
    if (spendingCategoryChartInstance.current) spendingCategoryChartInstance.current.destroy();
    if (spendingCategoryChartRef.current && summaryData?.charts?.spendingByCategory) {
      try {
        const styles = getComputedStyle(document.documentElement);
        const palette = [
          styles.getPropertyValue('--color-chart-1').trim(),
          styles.getPropertyValue('--color-chart-2').trim(),
          styles.getPropertyValue('--color-chart-3').trim(),
          styles.getPropertyValue('--color-chart-4').trim(),
          styles.getPropertyValue('--color-chart-5').trim(),
        ];

        const ctx = spendingCategoryChartRef.current.getContext('2d');
        if (ctx && summaryData.charts.spendingByCategory.labels && summaryData.charts.spendingByCategory.data) {
          spendingCategoryChartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: summaryData.charts.spendingByCategory.labels,
              datasets: [{
                label: t.totalSpend,
                data: summaryData.charts.spendingByCategory.data,
                backgroundColor: palette,
                borderWidth: 0,
              }],
            },
            options: doughnutChartOptions,
          });
        }
      } catch (error) {
        console.error('Error rendering spending category chart:', error);
      }
    }
    return () => {
      if (spendingCategoryChartInstance.current) {
        spendingCategoryChartInstance.current.destroy();
        spendingCategoryChartInstance.current = null;
      }
    };
  }, [summaryData, doughnutChartOptions, t.totalSpend]);

  const PeriodButton: React.FC<{ value: Period, label: string }> = ({ value, label }) => (
    <button
      onClick={() => setPeriod(value)}
      disabled={isUpdating}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${period === value ? 'bg-accent text-accent-text' : 'bg-surface hover:bg-border'} disabled:opacity-50 disabled:cursor-wait`}
    >
      {label}
    </button>
  );

  const renderContent = () => {
    if (isInitialLoading) {
      return <SkeletonLoader lines={10} />;
    }
    if (!summaryData) {
      return (
        <div className="text-center py-16 px-6 bg-surface rounded-xl border border-border">
          <p className="text-secondary text-lg">{t.noDataForSummary}</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard title={t.totalSpend} value={<CurrencyDisplay value={summaryData.kpis.totalSpend} />} />
          <KpiCard title={t.avgDailyExpense} value={<CurrencyDisplay value={summaryData.kpis.avgDailySpend} />} />
          <KpiCard title={t.itemsPurchased} value={summaryData.kpis.totalItems.toLocaleString('fa-IR')} />
          <KpiCard title={t.topSpendingCategory} value={summaryData.kpis.topCategory?.name || '-'} />
          <KpiCard title={t.topSpendingVendor} value={summaryData.kpis.topVendor?.name || '-'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card title={t.spendingOverTime} className="lg:col-span-3">
              <div className="relative h-[300px]">
                {isUpdating && <LoadingOverlay />}
                <canvas ref={spendingTimeChartRef}></canvas>
              </div>
            </Card>
            <Card title={t.spendingByCategory} className="lg:col-span-2">
              <div className="relative h-[300px]">
                {isUpdating && <LoadingOverlay />}
                <canvas ref={spendingCategoryChartRef}></canvas>
              </div>
            </Card>
        </div>

        <Card title={t.aiExecutiveSummary}>
            {isAiLoading ? <SkeletonLoader lines={5} /> : <p className="text-primary whitespace-pre-wrap leading-relaxed">{aiSummary}</p>}
        </Card>
      </div>
    );
  };

  const { setActions } = usePageActions();

  // Register page actions with Navbar
  useEffect(() => {
    const actions = (
      <>
        <Button key="export-json" variant="ghost" size="sm" onClick={handleExportJson} disabled={!summaryData} fullWidth>
          {t.exportJson}
        </Button>
      </>
    );
    setActions(actions);
    return () => {
      setTimeout(() => setActions(null), 0);
    };
  }, [setActions, handleExportJson, summaryData]);

  return (
    <>
      <Header title={t.executiveSummary} onBack={onBack} backText={t.backToDashboard} hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          <PeriodButton value="7d" label={t.last7Days} />
          <PeriodButton value="30d" label={t.last30Days} />
          <PeriodButton value="mtd" label={t.thisMonth} />
          <PeriodButton value="ytd" label={t.thisYear} />
          <PeriodButton value="all" label={t.allTime} />
        </div>
        {renderContent()}
      </main>
    </>
  );
};

const KpiCard: React.FC<{ title: string; value: React.ReactNode }> = ({ title, value }) => (
    <div className="bg-surface p-4 rounded-xl border border-border text-center">
        <p className="text-sm text-secondary mb-1">{title}</p>
        <div className="text-xl font-bold text-primary truncate">{value}</div>
    </div>
);

export default SummaryDashboard;
