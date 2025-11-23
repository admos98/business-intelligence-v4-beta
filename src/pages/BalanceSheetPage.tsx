import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';
import { exportBalanceSheet } from '../lib/excelExport';
import { PieChart, PieChartData } from '../components/charts/PieChart';

interface BalanceSheetPageProps {
  onBack: () => void;
}

const BalanceSheetPage: React.FC<BalanceSheetPageProps> = ({ onBack }) => {
  const { getBalanceSheet } = useShoppingStore();
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const [showCharts, setShowCharts] = useState(true);

  const balanceSheet = useMemo(() => {
    return getBalanceSheet(asOfDate);
  }, [asOfDate, getBalanceSheet]);

  // Chart data
  const assetLiabilityEquityData: PieChartData[] = useMemo(() => {
    return [
      { label: t.asset, value: balanceSheet.assets.total, color: '#10b981' },
      { label: t.liability, value: balanceSheet.liabilities.total, color: '#f59e0b' },
      { label: t.equity, value: balanceSheet.equity.total, color: '#3b82f6' },
    ].filter(d => d.value > 0);
  }, [balanceSheet]);

  const handleExportExcel = () => {
    exportBalanceSheet({
      assets: [...balanceSheet.assets.current, ...balanceSheet.assets.nonCurrent].map(a => ({ name: a.account.name, balance: a.amount })),
      liabilities: [...balanceSheet.liabilities.current, ...balanceSheet.liabilities.nonCurrent].map(l => ({ name: l.account.name, balance: l.amount })),
      equity: balanceSheet.equity.accounts.map(e => ({ name: e.account.name, balance: e.amount })),
      totalAssets: balanceSheet.assets.total,
      totalLiabilities: balanceSheet.liabilities.total,
      totalEquity: balanceSheet.equity.total,
      asOfDate: toJalaliDateString(asOfDate.toISOString()),
    });
  };

  const handleExportJson = () => {
    const dataString = JSON.stringify({ asOfDate: asOfDate.toISOString(), data: balanceSheet }, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance_sheet_${asOfDate.toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header title={t.balanceSheet} onBack={onBack} />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Controls */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                تاریخ گزارش
              </label>
              <input
                type="date"
                value={asOfDate.toISOString().split('T')[0]}
                onChange={(e) => setAsOfDate(new Date(e.target.value))}
                className="px-4 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleExportExcel}>
                📊 {t.exportToExcel}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportJson}>
                JSON
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
          <div className="mt-4 text-center">
            <p className="text-sm text-secondary">
              {t.asOf(toJalaliDateString(asOfDate.toISOString()))}
            </p>
            {balanceSheet.balanced ? (
              <p className="text-success font-bold mt-2">✓ ترازنامه متوازن است</p>
            ) : (
              <p className="text-danger font-bold mt-2">✗ خطا: ترازنامه متوازن نیست!</p>
            )}
          </div>
        </Card>

        {/* Charts */}
        {showCharts && assetLiabilityEquityData.length > 0 && (
          <Card title="توزیع دارایی‌ها، بدهی‌ها و حقوق صاحبان سهام">
            <div className="flex justify-center">
              <PieChart data={assetLiabilityEquityData} width={400} height={400} />
            </div>
          </Card>
        )}

        {/* Balance Sheet Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ASSETS */}
          <div className="space-y-4">
            <Card
              title={t.asset}
              className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
            >
              {/* Current Assets */}
              {balanceSheet.assets.current.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-sm text-secondary mb-3">{t.currentAssets}</h4>
                  <div className="space-y-2">
                    {balanceSheet.assets.current.map((item) => (
                      <div
                        key={item.account.id}
                        className="flex justify-between items-center p-2 bg-surface rounded"
                      >
                        <div>
                          <span className="text-sm font-mono text-secondary">
                            {item.account.code}
                          </span>
                          <span className="text-sm font-medium text-primary mr-2">
                            {item.account.name}
                          </span>
                        </div>
                        <span className="font-bold text-primary">
                          <CurrencyDisplay value={item.amount} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-Current Assets */}
              {balanceSheet.assets.nonCurrent.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-sm text-secondary mb-3">
                    {t.nonCurrentAssets}
                  </h4>
                  <div className="space-y-2">
                    {balanceSheet.assets.nonCurrent.map((item) => (
                      <div
                        key={item.account.id}
                        className="flex justify-between items-center p-2 bg-surface rounded"
                      >
                        <div>
                          <span className="text-sm font-mono text-secondary">
                            {item.account.code}
                          </span>
                          <span className="text-sm font-medium text-primary mr-2">
                            {item.account.name}
                          </span>
                        </div>
                        <span className="font-bold text-primary">
                          <CurrencyDisplay value={item.amount} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Assets */}
              <div className="pt-4 border-t-2 border-blue-500">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-primary">{t.totalAssets}</span>
                  <span className="text-2xl font-bold text-primary">
                    <CurrencyDisplay value={balanceSheet.assets.total} />
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* LIABILITIES & EQUITY */}
          <div className="space-y-4">
            {/* LIABILITIES */}
            <Card
              title={t.liability}
              className="bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500"
            >
              {/* Current Liabilities */}
              {balanceSheet.liabilities.current.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-sm text-secondary mb-3">
                    {t.currentLiabilities}
                  </h4>
                  <div className="space-y-2">
                    {balanceSheet.liabilities.current.map((item) => (
                      <div
                        key={item.account.id}
                        className="flex justify-between items-center p-2 bg-surface rounded"
                      >
                        <div>
                          <span className="text-sm font-mono text-secondary">
                            {item.account.code}
                          </span>
                          <span className="text-sm font-medium text-primary mr-2">
                            {item.account.name}
                          </span>
                        </div>
                        <span className="font-bold text-primary">
                          <CurrencyDisplay value={item.amount} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Liabilities */}
              <div className="pt-4 border-t-2 border-red-500">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-primary">
                    {t.totalLiabilities}
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    <CurrencyDisplay value={balanceSheet.liabilities.total} />
                  </span>
                </div>
              </div>
            </Card>

            {/* EQUITY */}
            <Card
              title={t.equity}
              className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500"
            >
              <div className="space-y-2 mb-6">
                {balanceSheet.equity.accounts.map((item) => (
                  <div
                    key={item.account.id}
                    className="flex justify-between items-center p-2 bg-surface rounded"
                  >
                    <div>
                      <span className="text-sm font-mono text-secondary">
                        {item.account.code}
                      </span>
                      <span className="text-sm font-medium text-primary mr-2">
                        {item.account.name}
                      </span>
                    </div>
                    <span className="font-bold text-primary">
                      <CurrencyDisplay value={item.amount} />
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Equity */}
              <div className="pt-4 border-t-2 border-purple-500">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-primary">{t.totalEquity}</span>
                  <span className="text-2xl font-bold text-primary">
                    <CurrencyDisplay value={balanceSheet.equity.total} />
                  </span>
                </div>
              </div>
            </Card>

            {/* Total Liabilities + Equity */}
            <Card className="bg-accent/10 border-2 border-accent">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-primary">
                  {t.totalLiabilitiesAndEquity}
                </span>
                <span className="text-2xl font-bold text-primary">
                  <CurrencyDisplay
                    value={balanceSheet.liabilities.total + balanceSheet.equity.total}
                  />
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* Accounting Equation */}
        <Card title="معادله حسابداری" className="bg-accent/5">
          <div className="flex items-center justify-center gap-4 text-center flex-wrap">
            <div>
              <p className="text-sm text-secondary mb-2">{t.totalAssets}</p>
              <p className="text-3xl font-bold text-primary">
                <CurrencyDisplay value={balanceSheet.assets.total} />
              </p>
            </div>
            <span className="text-4xl font-bold text-secondary">=</span>
            <div>
              <p className="text-sm text-secondary mb-2">{t.totalLiabilities}</p>
              <p className="text-3xl font-bold text-primary">
                <CurrencyDisplay value={balanceSheet.liabilities.total} />
              </p>
            </div>
            <span className="text-4xl font-bold text-secondary">+</span>
            <div>
              <p className="text-sm text-secondary mb-2">{t.totalEquity}</p>
              <p className="text-3xl font-bold text-primary">
                <CurrencyDisplay value={balanceSheet.equity.total} />
              </p>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
};

export default BalanceSheetPage;
