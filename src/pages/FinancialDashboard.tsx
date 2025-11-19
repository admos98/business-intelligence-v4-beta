import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Header from '../components/common/Header';
import { useShoppingStore } from '../store/useShoppingStore';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';
import SkeletonLoader from '../components/common/SkeletonLoader';
import Button from '../components/common/Button';
import { usePageActions } from '../contexts/PageActionsContext';

interface FinancialDashboardProps {}

type SummaryPeriod = '7d' | '30d' | 'mtd' | 'ytd' | 'all';

const TrendUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8L5.586 19.414M7 13v8m0 0H3m4 0v-4" /></svg>;
const TrendDownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17H3m0 0v-8m0 8l14.858-14.858M17 11v8m0 0h4m-4 0v-4" /></svg>;

const FinancialDashboard: React.FC<FinancialDashboardProps> = () => {
  const store = useShoppingStore();
  const { getFinancialOverview } = store;

  const [period, setPeriod] = useState<SummaryPeriod>('mtd');

  const financialData = useMemo(() => {
    return getFinancialOverview(period);
  }, [period, getFinancialOverview]);

  const handleExportFinancialJson = useCallback(() => {
    if (!financialData) {
      return;
    }
    const dataString = JSON.stringify({ period, data: financialData }, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${period}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [financialData, period]);

  const handleExportFinancialCsv = useCallback(() => {
    if (!financialData) {
      return;
    }
    const headers = ['Category', 'Metric', 'Value'];
    const rows: (string | number)[][] = [
      ['Buy Side', 'Total Spend', financialData.buy.totalSpend],
      ['Buy Side', 'Item Count', financialData.buy.itemCount],
      ['Buy Side', 'Avg Daily Spend', financialData.buy.avgDailySpend],
      ['Sell Side', 'Total Revenue', financialData.sell.totalRevenue],
      ['Sell Side', 'Transaction Count', financialData.sell.transactionCount],
      ['Sell Side', 'Avg Transaction Value', financialData.sell.avgTransactionValue],
      ['Recipes', 'Total Cost of Goods', financialData.recipes.totalCostOfGoods],
      ['Profit', 'Gross Profit', financialData.profitAnalysis.grossProfit],
      ['Profit', 'Gross Margin %', (financialData.profitAnalysis.grossMargin || 0).toFixed(2)],
      ['Profit', 'Net Profit', financialData.profitAnalysis.netProfit],
    ];
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [financialData, period]);

  const { setActions } = usePageActions();

  // Register page actions with Navbar
  useEffect(() => {
    const actions = (
      <>
        <Button key="export-csv" variant="ghost" size="sm" onClick={handleExportFinancialCsv} fullWidth>
          صادر CSV
        </Button>
        <Button key="export-json" variant="ghost" size="sm" onClick={handleExportFinancialJson} fullWidth>
          صادر JSON
        </Button>
      </>
    );
    setActions(actions);
    return () => {
      setActions(null);
    };
  }, [setActions, handleExportFinancialCsv, handleExportFinancialJson]);

  return (
    <>
      <Header title="تقرير مالی و حسابداری" hideMenu={true} />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
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

        {!financialData ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonLoader key={i} lines={3} />
            ))}
          </div>
        ) : (
          <>
            {/* MAIN KPI CARDS - 4 COLUMNS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* BUY SIDE */}
              <Card className="bg-danger/5 border-l-4 border-l-danger">
                <div>
                  <p className="text-xs font-medium text-secondary mb-2">هزینه خرید (پرداختی)</p>
                  <p className="text-2xl font-bold text-danger mb-3">
                    <CurrencyDisplay value={financialData.buy.totalSpend} />
                  </p>
                  <div className="space-y-1 text-xs text-secondary">
                    <p>• {financialData.buy.itemCount} کالا خریداری</p>
                    <p>• میانگین روزانه: <CurrencyDisplay value={financialData.buy.avgDailySpend} /></p>
                  </div>
                </div>
              </Card>

              {/* SELL SIDE */}
              <Card className="bg-success/5 border-l-4 border-l-success">
                <div>
                  <p className="text-xs font-medium text-secondary mb-2">درآمد فروش</p>
                  <p className="text-2xl font-bold text-success mb-3">
                    <CurrencyDisplay value={financialData.sell.totalRevenue} />
                  </p>
                  <div className="space-y-1 text-xs text-secondary">
                    <p>• {financialData.sell.transactionCount} تراکنش</p>
                    <p>• متوسط: <CurrencyDisplay value={financialData.sell.avgTransactionValue} /></p>
                  </div>
                </div>
              </Card>

              {/* COGS */}
              <Card className="bg-warning/5 border-l-4 border-l-yellow-500">
                <div>
                  <p className="text-xs font-medium text-secondary mb-2">هزینه کالای فروخته (COGS)</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-3">
                    <CurrencyDisplay value={financialData.recipes.totalCostOfGoods} />
                  </p>
                  <div className="space-y-1 text-xs text-secondary">
                    <p>• بر اساس دستور‌های پخت</p>
                    <p>• واقعی: {financialData.sell.totalRevenue > 0 ? ((financialData.recipes.totalCostOfGoods / financialData.sell.totalRevenue) * 100).toFixed(1) : '0'}% درآمد</p>
                  </div>
                </div>
              </Card>

              {/* PROFIT */}
              <Card className={`border-l-4 ${financialData.profitAnalysis.grossProfit >= 0 ? 'bg-accent/5 border-l-accent' : 'bg-danger/5 border-l-danger'}`}>
                <div>
                  <p className="text-xs font-medium text-secondary mb-2">سود ناخالص (Gross Profit)</p>
                  <p className={`text-2xl font-bold mb-3 ${financialData.profitAnalysis.grossProfit >= 0 ? 'text-accent' : 'text-danger'}`}>
                    <CurrencyDisplay value={financialData.profitAnalysis.grossProfit} />
                  </p>
                  <div className="space-y-1 text-xs text-secondary">
                    <p>• حاشیه سود: <span className={financialData.profitAnalysis.grossMargin >= 0 ? 'text-accent' : 'text-danger'}>{financialData.profitAnalysis.grossMargin.toFixed(1)}%</span></p>
                    <p>• {financialData.profitAnalysis.grossProfit >= 0 ? '✓' : '✗'} {financialData.profitAnalysis.grossProfit >= 0 ? 'سود دارید' : 'زیان دارید'}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* BREAKDOWN ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* INCOME BREAKDOWN */}
              <Card title="تقسیم درآمدها">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-primary">درآمد فروش</span>
                      <CurrencyDisplay value={financialData.sell.totalRevenue} className="font-bold text-success" />
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div className="bg-success rounded-full h-2 w-full" />
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-secondary">
                    <p>• شامل {financialData.sell.transactionCount} فروش</p>
                    <p>• متوسط هر فروش: <CurrencyDisplay value={financialData.sell.avgTransactionValue} /></p>
                  </div>
                </div>
              </Card>

              {/* EXPENSE BREAKDOWN */}
              <Card title="تقسیم هزینه‌ها">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-primary">هزینه خریدها</span>
                      <CurrencyDisplay value={financialData.buy.totalSpend} className="font-bold text-danger" />
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div className="bg-danger rounded-full h-2 w-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-primary">هزینه COGS (فروخته شده)</span>
                      <CurrencyDisplay value={financialData.recipes.totalCostOfGoods} className="font-bold text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="w-full bg-background rounded-full h-2">
                      <div className="bg-yellow-500 rounded-full h-2" style={{ width: `${financialData.buy.totalSpend > 0 ? Math.min((financialData.recipes.totalCostOfGoods / financialData.buy.totalSpend) * 100, 100) : 0}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-secondary">
                    <p>• خریدهای انجام شده: {financialData.buy.itemCount} کالا</p>
                    <p>• متوسط روزانه: <CurrencyDisplay value={financialData.buy.avgDailySpend} /></p>
                  </div>
                </div>
              </Card>
            </div>

            {/* PROFIT ANALYSIS */}
            <Card title="تحلیل سود و ضایعات">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-background p-4 rounded-lg border border-border text-center">
                  <p className="text-xs font-medium text-secondary mb-2">درآمد کل</p>
                  <p className="text-2xl font-bold text-primary mb-3">
                    <CurrencyDisplay value={financialData.sell.totalRevenue} />
                  </p>
                  <p className="text-xs text-secondary">۱۰۰%</p>
                </div>

                <div className="bg-background p-4 rounded-lg border border-border text-center">
                  <p className="text-xs font-medium text-secondary mb-2">منهای: COGS</p>
                  <p className="text-2xl font-bold text-danger mb-3">
                    <CurrencyDisplay value={financialData.recipes.totalCostOfGoods} />
                  </p>
                  <p className="text-xs text-secondary">
                    {financialData.sell.totalRevenue > 0 ? ((financialData.recipes.totalCostOfGoods / financialData.sell.totalRevenue) * 100).toFixed(1) : '0'}% درآمد
                  </p>
                </div>

                <div className={`bg-background p-4 rounded-lg border-2 text-center ${financialData.profitAnalysis.grossProfit >= 0 ? 'border-success' : 'border-danger'}`}>
                  <p className="text-xs font-medium text-secondary mb-2">= سود ناخالص</p>
                  <p className={`text-2xl font-bold mb-3 ${financialData.profitAnalysis.grossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={financialData.profitAnalysis.grossProfit} />
                  </p>
                  <p className={`text-xs font-bold ${financialData.profitAnalysis.grossMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                    {financialData.profitAnalysis.grossMargin.toFixed(1)}% حاشیه
                  </p>
                </div>
              </div>

              {/* EFFICIENCY METRICS */}
              <div className="mt-6 pt-6 border-t border-border space-y-3">
                <h4 className="font-bold text-primary text-sm">شاخص‌های کارایی:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    {financialData.sell.totalRevenue > financialData.buy.totalSpend ? (
                      <TrendUpIcon />
                    ) : (
                      <TrendDownIcon />
                    )}
                    <div>
                      <p className="text-sm text-secondary">نسبت درآمد به هزینه</p>
                      <p className="font-bold text-primary">
                        {(financialData.sell.totalRevenue / Math.max(financialData.buy.totalSpend, 1)).toFixed(2)}x
                      </p>
                      <p className="text-xs text-secondary">
                        برای هر ۱ تومان هزینه {((financialData.sell.totalRevenue / Math.max(financialData.buy.totalSpend, 1)) - 1).toFixed(2)} تومان سود خالص
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {financialData.profitAnalysis.grossMargin >= 30 ? (
                      <TrendUpIcon />
                    ) : (
                      <TrendDownIcon />
                    )}
                    <div>
                      <p className="text-sm text-secondary">حاشیه سود</p>
                      <p className="font-bold text-primary">
                        {financialData.profitAnalysis.grossMargin.toFixed(1)}%
                      </p>
                      <p className="text-xs text-secondary">
                        {financialData.profitAnalysis.grossMargin >= 30 ? '✓ سالم' : '⚠ نیاز به بهبود'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* SUMMARY NOTE */}
            <Card className="bg-accent/5 border-accent border-l-4">
              <div className="text-sm space-y-2">
                <p>
                  <span className="font-bold text-primary">خلاصه:</span>{' '}
                  {financialData.profitAnalysis.grossProfit > 0
                    ? `در این دوره، شما ${financialData.sell.totalRevenue > 0 ? ((financialData.profitAnalysis.grossProfit / financialData.sell.totalRevenue) * 100).toFixed(1) : '0'}% حاشیه سود کسب کرده‌اید.`
                    : 'در این دوره، هزینه‌ها بیشتر از درآمد است. لطفاً استراتژی قیمت‌گذاری خود را بررسی کنید.'}
                </p>
                <p className="text-secondary text-xs">
                  نکته: این تقرير بر اساس هزینه کالای فروخته (COGS) محاسبه شده است و شامل سایر هزینه‌های عملیاتی نیست.
                </p>
              </div>
            </Card>
          </>
        )}
      </main>
    </>
  );
};

export default FinancialDashboard;
