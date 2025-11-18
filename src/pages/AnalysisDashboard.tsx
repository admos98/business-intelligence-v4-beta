// src/pages/AnalysisDashboard.tsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

// --- CORRECTED IMPORTS ---
// FIX: Changed 'Item' to 'ShoppingItem' as defined in your types.ts
import { ItemStatus, InflationData, InflationDetail, ShoppingList, ShoppingItem, Vendor } from '../../shared/types.ts';
import Header from '../components/common/Header.tsx';
import Card from '../components/common/Card.tsx';
import SkeletonLoader from '../components/common/SkeletonLoader.tsx';
import { t } from '../../shared/translations.ts';
import { useShoppingStore } from '../store/useShoppingStore.ts';
import CurrencyDisplay from '../components/common/CurrencyDisplay.tsx';
import { parseJalaliDate, toJalaliDateString } from '../../shared/jalali.ts';
// FIX: 'useToast' is unused, so it can be commented out or removed.
// import { useToast } from '../components/common/Toast.tsx';

// FIX: Importing from the correct file that contains the Gemini AI functions.
import { getAnalysisInsights, getInflationInsight } from '../lib/gemini.ts';

// --- TYPE DEFINITIONS ---
type Metric = 'totalSpend' | 'totalQuantity' | 'uniquePurchases' | 'avgPricePerUnit';
type GroupBy = 'vendor' | 'category' | 'date' | 'item';
type Tab = 'inflation' | 'ai' | 'reports';

interface AnalysisConfig {
  startDate: string;
  endDate: string;
  metrics: Metric[];
  groupBy: GroupBy | 'none';
  filters: {
    categories: string[];
    vendors: string[];
    items: string[];
  }
}

interface ProcessedData {
    kpis: Record<string, number>;
    chartData: { labels: string[], datasets: any[] };
    tableData: Record<string, any>[];
}

const METRIC_LABELS: Record<Metric, string> = {
  totalSpend: t.totalSpend,
  totalQuantity: t.totalQuantity,
  uniquePurchases: t.uniquePurchases,
  avgPricePerUnit: t.avgPricePerUnit,
};

const GROUP_BY_LABELS: Record<GroupBy | 'none', string> = {
  none: t.noGrouping,
  item: t.itemName,
  category: t.category,
  vendor: t.vendor,
  date: t.date,
};

interface InsightsHubProps {
    onBack: () => void;
    onLogout: () => void;
}

const InsightsHub: React.FC<InsightsHubProps> = ({ onBack, onLogout}) => {
    const [activeTab, setActiveTab] = useState<Tab>('inflation');

    const renderTabContent = () => {
        switch(activeTab) {
            case 'inflation': return <InflationTracker />;
            case 'ai': return <AiBusinessAdvisor />;
            case 'reports': return <CustomReports />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-screen">
            <Header title={t.insightsHub || "Insights Hub"} onBack={onBack} backText={t.backToDashboard} onLogout={onLogout} hideMenu={true} />
            <main className="flex-grow p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
                <div className="mb-6 border-b border-border flex items-center justify-center">
                    <TabButton id="inflation" label={t.inflationTracker || "Inflation"} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="ai" label={t.aiBusinessAdvisor || "AI Advisor"} activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton id="reports" label={t.customReports || "Reports"} activeTab={activeTab} setActiveTab={setActiveTab} />
                </div>
                <div className="animate-fade-in">
                    {renderTabContent()}
                </div>
            </main>
        </div>
    )
}

const TabButton: React.FC<{id: Tab, label: string, activeTab: Tab, setActiveTab: (tab: Tab) => void}> = ({ id, label, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(id)}
        className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === id
                ? 'border-accent text-accent'
                : 'border-transparent text-secondary hover:text-primary'
        }`}
    >
        {label}
    </button>
);


// #region Inflation Tracker Tab
const InflationTracker: React.FC = () => {
    const { getInflationData } = useShoppingStore();
    // FIX: 'setPeriod' was unused and has been removed.
    const [period] = useState<number>(90);
    const [inflationData, setInflationData] = useState<InflationData | null>(null);
    const [aiInsight, setAiInsight] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const chartRef = useRef<HTMLCanvasElement | null>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setIsAiLoading(true);
        setAiInsight('');

        const timeoutId = setTimeout(() => {
            const data = getInflationData(period);
            if (cancelled) return;

            setInflationData(data);
            setIsLoading(false);

            if (data) {
                getInflationInsight(data)
                    .then((result) => {
                        if (!cancelled) {
                            setAiInsight(result);
                        }
                    })
                    .catch(() => {
                        if (!cancelled) {
                            setAiInsight(t.aiError);
                        }
                    })
                    .finally(() => {
                        if (!cancelled) {
                            setIsAiLoading(false);
                        }
                    });
            } else {
                setIsAiLoading(false);
            }
        }, 100);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [period, getInflationData]);

    useEffect(() => {
        if (chartInstance.current) chartInstance.current.destroy();
        if (chartRef.current && inflationData?.priceIndexHistory) {
            try {
                const styles = getComputedStyle(document.documentElement);
                const accentColor = styles.getPropertyValue('--color-accent').trim();
                const accentSoftColor = styles.getPropertyValue('--color-accent-soft').trim();

                const ctx = chartRef.current.getContext('2d');
                if (ctx && inflationData.priceIndexHistory.length > 0) {
                    chartInstance.current = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: inflationData.priceIndexHistory.map((p) => p.period),
                            datasets: [{ data: inflationData.priceIndexHistory.map((p) => p.priceIndex), borderColor: accentColor, backgroundColor: accentSoftColor, fill: true, tension: 0.3 }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                    });
                }
            } catch (error) {
                console.error('Error rendering inflation chart:', error);
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };
    }, [inflationData]);

    if (isLoading) return <div className="text-center py-8"><p>{t.generatingInflationData || "Loading..."}</p></div>;
    if (!inflationData) return <div className="text-center py-8"><p>{t.noDataForPeriod}</p></div>;

    const change = inflationData.overallChange;
    const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 text-center">
                    <h4 className="text-secondary text-sm mb-1">{t.overallInflation || "Overall Inflation"}</h4>
                    <p className={`text-3xl font-bold ${change > 0.5 ? 'text-danger' : change < -0.5 ? 'text-success' : 'text-primary'}`}>{changeText}</p>
                </Card>
                <Card title={t.aiAnalystInsight} className="md:col-span-2">
                    {isAiLoading ? <SkeletonLoader lines={3} /> : <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiInsight}</p>}
                </Card>
            </div>
            <Card title={t.priceIndexHistory || "Price Index"}>
                <div className="h-[250px]"><canvas ref={chartRef}></canvas></div>
            </Card>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card title={t.topPriceRisesItems || "Top Item Rises"}>
                    <RiseList data={inflationData.topItemRises} />
                 </Card>
                 <Card title={t.topPriceRisesCategories || "Top Category Rises"}>
                     <RiseList data={inflationData.topCategoryRises} />
                 </Card>
             </div>
        </div>
    );
};

const RiseList: React.FC<{data: InflationDetail[]}> = ({data}) => {
    if (data.length === 0) return <p className="text-sm text-center text-secondary py-4">{t.noDataForPeriod}</p>;
    return (
        <ul className="space-y-3">
            {data.map(item => (
                <li key={item.name} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-primary">{item.name}</span>
                    <div className="text-right">
                        <span className={`font-bold ${item.changePercentage > 0 ? 'text-danger' : 'text-success'}`}>
                             {item.changePercentage > 0 ? '▲' : '▼'} {Math.abs(item.changePercentage).toFixed(1)}%
                        </span>
                        <div className="text-xs text-secondary">
                            <CurrencyDisplay value={item.startPrice} /> &rarr; <CurrencyDisplay value={item.endPrice} />
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
};
// #endregion

// #region AI Business Advisor Tab
const AiBusinessAdvisor: React.FC = () => {
    const [aiInsight, setAiInsight] = useState('');
    const [aiQuery, setAiQuery] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const { lists } = useShoppingStore();

    const handleAskAI = async () => {
        if (!aiQuery.trim()) return;
        setIsAiLoading(true);
        setAiInsight('');

        try {
            // FIX: Changed 'Item' to 'ShoppingItem'
            const purchasedItems = lists.flatMap((l: ShoppingList) => l.items.filter((i: ShoppingItem) => i.status === ItemStatus.Bought));
            const insight = await getAnalysisInsights(aiQuery, "The user is asking a question about their entire purchase history.", purchasedItems);
            setAiInsight(insight);
        } catch (e) {
            setAiInsight(t.aiError);
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <Card>
                <div className="min-h-[300px] p-4 bg-background rounded-lg mb-4">
                    {isAiLoading ? <SkeletonLoader lines={5} /> : (
                        <p className="text-sm text-primary whitespace-pre-wrap leading-relaxed">
                            {aiInsight || t.aiWelcome}
                        </p>
                    )}
                </div>
                <div className="flex gap-4">
                    <textarea value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder={t.aiPromptPlaceholder} rows={2} className="flex-grow text-sm p-2 bg-background border border-border rounded-lg"></textarea>
                    <button onClick={handleAskAI} disabled={isAiLoading || !aiQuery.trim()} className="px-6 py-2 bg-accent text-accent-text font-bold rounded-lg hover:opacity-90 disabled:opacity-50">{t.ask}</button>
                </div>
            </Card>
        </div>
    );
};
// #endregion

// #region Custom Reports Tab
const CustomReports: React.FC = () => {
  // FIX: Removed unused 'allCategories' and 'addToast'.
  const { lists, vendors } = useShoppingStore();
  const vendorMap = useMemo(() => new Map(vendors.map((v: Vendor) => [v.id, v.name])), [vendors]);

  const initialDateRange = useMemo(() => {
    const today = new Date();
    const sortedLists = [...lists].sort((a: ShoppingList, b: ShoppingList) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const earliestDate = sortedLists.length > 0 ? new Date(sortedLists[0].createdAt) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return {
      start: toJalaliDateString(earliestDate.toISOString()),
      end: toJalaliDateString(today.toISOString()),
    };
  }, [lists]);

  const [config, setConfig] = useState<AnalysisConfig>({
    startDate: initialDateRange.start,
    endDate: initialDateRange.end,
    metrics: ['totalSpend'],
    groupBy: 'category',
    filters: { categories: [], vendors: [], items: [] }
  });

  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const handleConfigChange = <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleRunAnalysis = () => {
    setIsProcessing(true);
    setProcessedData(null);

    setTimeout(() => {
        const start = parseJalaliDate(config.startDate);
        const end = parseJalaliDate(config.endDate);
        if (!start || !end) {
            setIsProcessing(false);
            return;
        }
        end.setHours(23, 59, 59, 999);

        // FIX: Changed 'Item' to 'ShoppingItem'
        type ItemWithDate = ShoppingItem & { purchaseDate: string };

        let filteredItems: ItemWithDate[] = lists.flatMap((l: ShoppingList) =>
            new Date(l.createdAt) >= start && new Date(l.createdAt) <= end
            ? l.items.map((i: ShoppingItem) => ({...i, purchaseDate: toJalaliDateString(l.createdAt)}))
            : []
        ).filter((i: ShoppingItem) => i.status === ItemStatus.Bought);

        if (config.filters.categories.length > 0) filteredItems = filteredItems.filter((i: ShoppingItem) => config.filters.categories.includes(i.category));
        if (config.filters.vendors.length > 0) filteredItems = filteredItems.filter((i: ShoppingItem) => i.vendorId && config.filters.vendors.includes(i.vendorId));
        if (config.filters.items.length > 0) filteredItems = filteredItems.filter((i: ShoppingItem) => config.filters.items.includes(i.name));

        const kpis = {
            totalSpend: filteredItems.reduce((s: number, i: ShoppingItem) => s + (i.paidPrice || 0), 0),
            uniqueItems: new Set(filteredItems.map((i: ShoppingItem) => i.name)).size,
            uniqueVendors: new Set(filteredItems.map((i: ShoppingItem) => i.vendorId).filter(Boolean)).size
        };

        const groupedMap = new Map<string, ItemWithDate[]>();
        if (config.groupBy !== 'none') {
            filteredItems.forEach((item: ItemWithDate) => {
                let key = '';
                 switch (config.groupBy) {
                    case 'category': key = item.category || t.other; break;
                    case 'vendor': key = vendorMap.get(item.vendorId || '') || 'نامشخص'; break;
                    case 'item': key = item.name; break;
                    case 'date': key = item.purchaseDate; break;
                    default: key = 'All';
                }
                if (!groupedMap.has(key)) groupedMap.set(key, []);
                groupedMap.get(key)!.push(item);
            });
        } else {
            groupedMap.set('All Data', filteredItems);
        }

        const tableData: Record<string, any>[] = [];
        const labels = Array.from(groupedMap.keys()).sort((a,b) => a.localeCompare(b, 'fa'));

        labels.forEach(key => {
            const groupItems = groupedMap.get(key)!;
            const row: Record<string, any> = { [config.groupBy]: key };
            if(config.metrics.includes('totalSpend')) row.totalSpend = groupItems.reduce((s: number, i: ShoppingItem) => s + (i.paidPrice || 0), 0);
            if(config.metrics.includes('totalQuantity')) row.totalQuantity = groupItems.reduce((s: number, i: ShoppingItem) => s + (i.purchasedAmount || i.amount || 0), 0);
            if(config.metrics.includes('uniquePurchases')) row.uniquePurchases = groupItems.length;
            if(config.metrics.includes('avgPricePerUnit')) {
                 const totalVal = groupItems.reduce((s: number, i: ShoppingItem) => s + (i.paidPrice || 0), 0);
                 const totalQty = groupItems.reduce((s: number, i: ShoppingItem) => s + (i.purchasedAmount || i.amount || 1), 0);
                 row.avgPricePerUnit = totalQty > 0 ? totalVal / totalQty : 0;
            }
            tableData.push(row);
        });

        const styles = getComputedStyle(document.documentElement);
        const chartColors = [styles.getPropertyValue('--color-chart-1').trim(), styles.getPropertyValue('--color-chart-2').trim(), styles.getPropertyValue('--color-chart-3').trim(), styles.getPropertyValue('--color-chart-4').trim(), styles.getPropertyValue('--color-chart-5').trim()];
        const datasets = config.metrics.map((metric, index) => ({
            label: METRIC_LABELS[metric], data: tableData.map(d => d[metric]),
            backgroundColor: chartColors[index % chartColors.length], borderColor: chartColors[index % chartColors.length], tension: 0.1,
        }));
        setProcessedData({ kpis, chartData: { labels, datasets }, tableData });
        setIsProcessing(false);
    }, 100);
  };

  useEffect(() => {
    if (chartInstance.current) chartInstance.current.destroy();
    if (chartRef.current && processedData?.chartData?.labels && processedData.chartData.labels.length > 0) {
        try {
            let chartType: 'line' | 'bar' | 'pie' = config.groupBy === 'date' ? 'line' : 'bar';
            if (['category', 'vendor', 'item'].includes(config.groupBy) && config.metrics.length === 1 && config.metrics[0] === 'totalSpend') chartType = 'pie';

            const ctx = chartRef.current.getContext('2d');
            if (ctx && processedData.chartData.datasets) {
              chartInstance.current = new Chart(ctx, { type: chartType, data: processedData.chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } } });
            }
        } catch (error) {
            console.error('Error rendering custom report chart:', error);
        }
    }
     return () => {
         if(chartInstance.current) {
             chartInstance.current.destroy();
             chartInstance.current = null;
         }
     };
  }, [processedData, config.groupBy, config.metrics]);

  return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3">
            <Card title={t.exploreData}>
              <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-primary mb-2 text-sm">{t.reportingPeriod}</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={config.startDate} onChange={e => handleConfigChange('startDate', e.target.value)} placeholder={t.startDate} className="w-full text-sm px-2 py-1.5 bg-background border border-border rounded-lg" />
                        <input type="text" value={config.endDate} onChange={e => handleConfigChange('endDate', e.target.value)} placeholder={t.endDate} className="w-full text-sm px-2 py-1.5 bg-background border border-border rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary mb-2 text-sm">{t.selectMetrics}</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {(Object.keys(METRIC_LABELS) as Metric[]).map(metric => (
                        <label key={metric} className="flex items-center gap-2 p-2 bg-background rounded-md">
                          <input type="checkbox" checked={config.metrics.includes(metric)} onChange={e => handleConfigChange('metrics', e.target.checked ? [...config.metrics, metric] : config.metrics.filter(m => m !== metric))} className="form-checkbox h-4 w-4 rounded bg-surface border-border text-accent"/>
                          {METRIC_LABELS[metric]}
                        </label>
                      ))}
                    </div>
                  </div>
                   <div>
                      <h3 className="font-semibold text-primary mb-2 text-sm">{t.groupBy}</h3>
                      <select value={config.groupBy} onChange={e => handleConfigChange('groupBy', e.target.value as GroupBy | 'none')} className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm">
                          {(Object.keys(GROUP_BY_LABELS) as (GroupBy | 'none')[]).map(key => <option key={key} value={key}>{GROUP_BY_LABELS[key]}</option>)}
                      </select>
                   </div>
                  <button onClick={handleRunAnalysis} disabled={isProcessing || config.metrics.length === 0} className="w-full py-2 bg-accent text-accent-text font-bold rounded-lg hover:opacity-90 disabled:opacity-50">{isProcessing ? t.generatingInsights : t.runAnalysis}</button>
              </div>
            </Card>
        </aside>
        <main className="lg:col-span-9 flex flex-col gap-6">
           {processedData ? (
             <>
                <Card>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        <div><p className="text-sm text-secondary">{t.totalSpend}</p><CurrencyDisplay value={processedData.kpis.totalSpend} className="font-bold text-xl text-accent"/></div>
                        <div><p className="text-sm text-secondary">{t.totalItems}</p><p className="font-bold text-xl text-accent">{processedData.kpis.uniqueItems.toLocaleString('fa-IR')}</p></div>
                        <div><p className="text-sm text-secondary">{t.totalVendors}</p><p className="font-bold text-xl text-accent">{processedData.kpis.uniqueVendors.toLocaleString('fa-IR')}</p></div>
                    </div>
                </Card>
                <Card title={t.analysisResults} className="flex-grow min-h-0 flex flex-col">
                    <div className="h-[250px] mb-4"><canvas ref={chartRef}></canvas></div>
                     <div className="overflow-y-auto border-t border-border pt-2 flex-grow"><DataTable data={processedData.tableData} groupBy={config.groupBy} metrics={config.metrics} /></div>
                </Card>
             </>
           ) : (
                <div className="flex items-center justify-center h-full bg-surface rounded-xl border-2 border-dashed border-border text-center text-secondary p-8">
                    <p>{isProcessing ? t.generatingInsights : (t.customReportDescription || "Select criteria and run analysis.")}</p>
                </div>
           )}
        </main>
      </div>
  );
};

const DataTable: React.FC<{data: Record<string, any>[], groupBy: GroupBy | 'none', metrics: Metric[]}> = ({data, groupBy, metrics}) => {
    if (data.length === 0) return <p className="text-center text-secondary py-4">{t.noDataForPeriod}</p>
    const headers = [GROUP_BY_LABELS[groupBy], ...metrics.map(m => METRIC_LABELS[m])];
    const formatValue = (key: string, value: any) => {
        if (typeof value !== 'number') return value;
        if (key === 'totalQuantity' || key === 'uniquePurchases') return value.toLocaleString('fa-IR');
        return <CurrencyDisplay value={value} className="text-sm" />
    };
    return (
        <table className="w-full text-sm text-right">
            <thead className="sticky top-0 bg-surface"><tr>{headers.map(h => <th key={h} className="font-bold p-2 border-b border-border text-right">{h}</th>)}</tr></thead>
            <tbody>{data.map((row, i) => (<tr key={i} className="hover:bg-background"><td className="p-2 border-b border-border/50">{row[groupBy]}</td>{metrics.map(k => (<td key={k} className="p-2 border-b border-border/50">{formatValue(k, row[k])}</td>))}</tr>))}</tbody>
        </table>
    )
}
// #endregion

export default InsightsHub;
