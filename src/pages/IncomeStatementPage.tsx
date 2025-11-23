import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';
import { exportIncomeStatement } from '../lib/excelExport';
import { PieChart, PieChartData } from '../components/charts/PieChart';
import { BarChart, BarChartData } from '../components/charts/BarChart';

interface IncomeStatementPageProps {
  onBack: () => void;
}

const IncomeStatementPage: React.FC<IncomeStatementPageProps> = ({ onBack }) => {
  const { getIncomeStatement } = useShoppingStore();
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showCharts, setShowCharts] = useState(true);

  const incomeStatement = useMemo(() => {
    return getIncomeStatement(startDate, endDate);
  }, [startDate, endDate, getIncomeStatement]);

  // Prepare chart data
  const revenueBreakdownData: PieChartData[] = useMemo(() => {
    const data: PieChartData[] = [];
    if (incomeStatement.grossProfit > 0) {
      data.push({ label: t.grossProfit, value: incomeStatement.grossProfit, color: '#10b981' });
    }
    if (incomeStatement.cogs.total > 0) {
      data.push({ label: t.cogs, value: incomeStatement.cogs.total, color: '#f59e0b' });
    }
    return data;
  }, [incomeStatement]);

  const expensesChartData: BarChartData[] = useMemo(() => {
    return incomeStatement.expenses.accounts.map((exp: { account: { name: string }; amount: number }, idx: number) => ({
      label: exp.account.name,
      value: exp.amount,
      color: ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'][idx % 5],
    }));
  }, [incomeStatement]);

  const handleExportExcel = () => {
    exportIncomeStatement({
      revenue: incomeStatement.revenue.total,
      cogs: incomeStatement.cogs.total,
      grossProfit: incomeStatement.grossProfit,
      expenses: incomeStatement.expenses.accounts.map(exp => ({
        name: exp.account.name,
        amount: exp.amount,
      })),
      netIncome: incomeStatement.netIncome,
      period: {
        start: toJalaliDateString(startDate.toISOString()),
        end: toJalaliDateString(endDate.toISOString()),
      },
    });
  };

  const handleExportJson = () => {
    const dataString = JSON.stringify(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        data: incomeStatement,
      },
      null,
      2
    );
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `income_statement_${startDate.toISOString().split('T')[0]}_to_${
      endDate.toISOString().split('T')[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header title={t.incomeStatement} onBack={onBack} />

      <main className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Controls */}
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-secondary mb-2">
                از تاریخ
              </label>
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-secondary mb-2">
                تا تاریخ
              </label>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value))}
                className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="self-end flex gap-2">
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
              {t.forPeriod(
                toJalaliDateString(startDate.toISOString()),
                toJalaliDateString(endDate.toISOString())
              )}
            </p>
          </div>
        </Card>

        {/* Charts */}
        {showCharts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="ترکیب درآمد">
              {revenueBreakdownData.length > 0 ? (
                <PieChart data={revenueBreakdownData} width={300} height={300} />
              ) : (
                <p className="text-center py-8 text-gray-500">داده‌ای برای نمایش وجود ندارد</p>
              )}
            </Card>
            <Card title="هزینه‌های عملیاتی">
              {expensesChartData.length > 0 ? (
                <BarChart data={expensesChartData} width={500} height={300} />
              ) : (
                <p className="text-center py-8 text-gray-500">هزینه‌ای ثبت نشده است</p>
              )}
            </Card>
          </div>
        )}

        {/* Income Statement */}
        <Card>
          <div className="space-y-6">
            {/* REVENUE */}
            <div>
              <h3 className="text-lg font-bold text-primary mb-3 pb-2 border-b-2 border-green-500">
                {t.revenue}
              </h3>
              {incomeStatement.revenue.accounts.length > 0 ? (
                <div className="space-y-2">
                  {incomeStatement.revenue.accounts.map((item) => (
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
                      <span className="font-bold text-success">
                        <CurrencyDisplay value={item.amount} />
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded font-bold">
                    <span>جمع درآمد</span>
                    <span className="text-success">
                      <CurrencyDisplay value={incomeStatement.revenue.total} />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm">هیچ درآمدی ثبت نشده است</p>
              )}
            </div>

            {/* COST OF GOODS SOLD */}
            <div>
              <h3 className="text-lg font-bold text-primary mb-3 pb-2 border-b-2 border-orange-500">
                {t.cogs}
              </h3>
              {incomeStatement.cogs.accounts.length > 0 ? (
                <div className="space-y-2">
                  {incomeStatement.cogs.accounts.map((item) => (
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
                      <span className="font-bold text-danger">
                        <CurrencyDisplay value={item.amount} />
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded font-bold">
                    <span>جمع بهای تمام شده</span>
                    <span className="text-danger">
                      <CurrencyDisplay value={incomeStatement.cogs.total} />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm">هیچ بهای تمام شده‌ای ثبت نشده است</p>
              )}
            </div>

            {/* GROSS PROFIT */}
            <div className="bg-accent/10 p-4 rounded-lg border-2 border-accent">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xl font-bold text-primary">{t.grossProfit}</span>
                <span className={`text-2xl font-bold ${incomeStatement.grossProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  <CurrencyDisplay value={incomeStatement.grossProfit} />
                </span>
              </div>
              <div className="text-sm text-secondary text-center">
                {t.grossMargin}: {incomeStatement.grossMargin.toFixed(1)}%
              </div>
            </div>

            {/* OPERATING EXPENSES */}
            <div>
              <h3 className="text-lg font-bold text-primary mb-3 pb-2 border-b-2 border-yellow-500">
                {t.operatingExpenses}
              </h3>
              {incomeStatement.expenses.accounts.length > 0 ? (
                <div className="space-y-2">
                  {incomeStatement.expenses.accounts.map((item) => (
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
                      <span className="font-bold text-danger">
                        <CurrencyDisplay value={item.amount} />
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded font-bold">
                    <span>جمع هزینه‌های عملیاتی</span>
                    <span className="text-danger">
                      <CurrencyDisplay value={incomeStatement.expenses.total} />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm">هیچ هزینه‌ای ثبت نشده است</p>
              )}
            </div>

            {/* NET INCOME */}
            <div className={`p-6 rounded-lg border-4 ${incomeStatement.netIncome >= 0 ? 'bg-success/10 border-success' : 'bg-danger/10 border-danger'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-2xl font-bold text-primary">{t.netIncome}</span>
                <span className={`text-4xl font-bold ${incomeStatement.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                  <CurrencyDisplay value={incomeStatement.netIncome} />
                </span>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm text-secondary">
                  {t.netMargin}: {incomeStatement.netMargin.toFixed(1)}%
                </p>
                <p className={`text-sm font-bold ${incomeStatement.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                  {incomeStatement.netIncome >= 0 ? '✓ سودآوری' : '✗ زیان‌ده'}
                </p>
              </div>
            </div>

            {/* Summary Metrics */}
            <Card className="bg-accent/5">
              <h4 className="font-bold text-primary mb-4">خلاصه شاخص‌ها</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-secondary mb-1">درآمد</p>
                  <p className="text-lg font-bold text-primary">
                    <CurrencyDisplay value={incomeStatement.revenue.total} />
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-secondary mb-1">بهای تمام شده</p>
                  <p className="text-lg font-bold text-primary">
                    <CurrencyDisplay value={incomeStatement.cogs.total} />
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-secondary mb-1">هزینه‌های عملیاتی</p>
                  <p className="text-lg font-bold text-primary">
                    <CurrencyDisplay value={incomeStatement.expenses.total} />
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-secondary mb-1">سود خالص</p>
                  <p className={`text-lg font-bold ${incomeStatement.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={incomeStatement.netIncome} />
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </Card>
      </main>
    </>
  );
};

export default IncomeStatementPage;
