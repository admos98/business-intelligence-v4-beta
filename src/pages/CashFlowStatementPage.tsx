import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';

interface CashFlowStatementPageProps {
  onBack: () => void;
}

const CashFlowStatementPage: React.FC<CashFlowStatementPageProps> = ({ onBack }) => {
  const { getCashFlowStatement } = useShoppingStore();
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(new Date());

  const cashFlowStatement = useMemo(() => {
    return getCashFlowStatement(startDate, endDate);
  }, [startDate, endDate, getCashFlowStatement]);

  const handleExportJson = () => {
    const dataString = JSON.stringify(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        data: cashFlowStatement,
      },
      null,
      2
    );
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_flow_${startDate.toISOString().split('T')[0]}_to_${
      endDate.toISOString().split('T')[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header title={t.cashFlowStatement} onBack={onBack} />

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
            <div className="self-end">
              <Button variant="ghost" size="sm" onClick={handleExportJson}>
                صادر JSON
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

        {/* Cash Flow Statement */}
        <Card>
          <div className="space-y-6">
            {/* OPERATING ACTIVITIES */}
            <div>
              <h3 className="text-lg font-bold text-primary mb-3 pb-2 border-b-2 border-blue-500">
                {t.operatingActivities}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 bg-surface rounded">
                  <span className="text-sm font-medium text-primary">سود (زیان) خالص</span>
                  <span className={`font-bold ${cashFlowStatement.operatingActivities.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={cashFlowStatement.operatingActivities.netIncome} />
                  </span>
                </div>

                {cashFlowStatement.operatingActivities.adjustments.length > 0 && (
                  <>
                    <div className="pr-4 text-sm text-secondary font-medium mt-3 mb-2">
                      تعدیلات:
                    </div>
                    {cashFlowStatement.operatingActivities.adjustments.map((adj, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-surface rounded pr-8"
                      >
                        <span className="text-sm text-secondary">{adj.description}</span>
                        <span className={`font-bold ${adj.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                          <CurrencyDisplay value={adj.amount} />
                        </span>
                      </div>
                    ))}
                  </>
                )}

                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded font-bold mt-4">
                  <span>خالص جریان نقدی از فعالیت‌های عملیاتی</span>
                  <span className={cashFlowStatement.operatingActivities.total >= 0 ? 'text-success' : 'text-danger'}>
                    <CurrencyDisplay value={cashFlowStatement.operatingActivities.total} />
                  </span>
                </div>
              </div>
            </div>

            {/* INVESTING ACTIVITIES */}
            <div>
              <h3 className="text-lg font-bold text-primary mb-3 pb-2 border-b-2 border-purple-500">
                {t.investingActivities}
              </h3>
              {cashFlowStatement.investingActivities.items.length > 0 ? (
                <div className="space-y-2">
                  {cashFlowStatement.investingActivities.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-surface rounded"
                    >
                      <span className="text-sm text-secondary">{item.description}</span>
                      <span className={`font-bold ${item.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                        <CurrencyDisplay value={item.amount} />
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded font-bold">
                    <span>خالص جریان نقدی از فعالیت‌های سرمایه‌گذاری</span>
                    <span className={cashFlowStatement.investingActivities.total >= 0 ? 'text-success' : 'text-danger'}>
                      <CurrencyDisplay value={cashFlowStatement.investingActivities.total} />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm">هیچ فعالیت سرمایه‌گذاری در این دوره ثبت نشده است</p>
              )}
            </div>

            {/* FINANCING ACTIVITIES */}
            <div>
              <h3 className="text-lg font-bold text-primary mb-3 pb-2 border-b-2 border-orange-500">
                {t.financingActivities}
              </h3>
              {cashFlowStatement.financingActivities.items.length > 0 ? (
                <div className="space-y-2">
                  {cashFlowStatement.financingActivities.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-2 bg-surface rounded"
                    >
                      <span className="text-sm text-secondary">{item.description}</span>
                      <span className={`font-bold ${item.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                        <CurrencyDisplay value={item.amount} />
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded font-bold">
                    <span>خالص جریان نقدی از فعالیت‌های تامین مالی</span>
                    <span className={cashFlowStatement.financingActivities.total >= 0 ? 'text-success' : 'text-danger'}>
                      <CurrencyDisplay value={cashFlowStatement.financingActivities.total} />
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-secondary text-sm">هیچ فعالیت تامین مالی در این دوره ثبت نشده است</p>
              )}
            </div>

            {/* NET CASH FLOW */}
            <div className={`p-4 rounded-lg border-2 ${cashFlowStatement.netCashFlow >= 0 ? 'bg-success/10 border-success' : 'bg-danger/10 border-danger'}`}>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-primary">{t.netCashFlow}</span>
                <span className={`text-2xl font-bold ${cashFlowStatement.netCashFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                  <CurrencyDisplay value={cashFlowStatement.netCashFlow} />
                </span>
              </div>
            </div>

            {/* CASH RECONCILIATION */}
            <Card className="bg-accent/5">
              <h4 className="font-bold text-primary mb-4">تطبیق وجوه نقد</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-sm font-medium text-primary">{t.beginningCash}</span>
                  <span className="font-bold text-primary">
                    <CurrencyDisplay value={cashFlowStatement.beginningCash} />
                  </span>
                </div>

                <div className="text-center text-2xl font-bold text-secondary">+</div>

                <div className="flex justify-between items-center p-3 bg-surface rounded">
                  <span className="text-sm font-medium text-primary">{t.netCashFlow}</span>
                  <span className={`font-bold ${cashFlowStatement.netCashFlow >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={cashFlowStatement.netCashFlow} />
                  </span>
                </div>

                <div className="text-center text-2xl font-bold text-secondary">=</div>

                <div className="flex justify-between items-center p-4 bg-accent/20 rounded border-2 border-accent">
                  <span className="text-lg font-bold text-primary">{t.endingCash}</span>
                  <span className="text-2xl font-bold text-primary">
                    <CurrencyDisplay value={cashFlowStatement.endingCash} />
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-secondary text-center">
                  تفاوت محاسبه شده:{' '}
                  <span className={Math.abs(cashFlowStatement.endingCash - (cashFlowStatement.beginningCash + cashFlowStatement.netCashFlow)) < 0.01 ? 'text-success' : 'text-danger'}>
                    <CurrencyDisplay value={Math.abs(cashFlowStatement.endingCash - (cashFlowStatement.beginningCash + cashFlowStatement.netCashFlow))} />
                  </span>
                  {Math.abs(cashFlowStatement.endingCash - (cashFlowStatement.beginningCash + cashFlowStatement.netCashFlow)) < 0.01 ? ' ✓' : ' ✗'}
                </p>
              </div>
            </Card>

            {/* Summary */}
            <Card className="bg-accent/5">
              <h4 className="font-bold text-primary mb-4">خلاصه شاخص‌ها</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-surface rounded">
                  <p className="text-xs text-secondary mb-1">فعالیت‌های عملیاتی</p>
                  <p className={`text-lg font-bold ${cashFlowStatement.operatingActivities.total >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={cashFlowStatement.operatingActivities.total} />
                  </p>
                </div>
                <div className="text-center p-3 bg-surface rounded">
                  <p className="text-xs text-secondary mb-1">فعالیت‌های سرمایه‌گذاری</p>
                  <p className={`text-lg font-bold ${cashFlowStatement.investingActivities.total >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={cashFlowStatement.investingActivities.total} />
                  </p>
                </div>
                <div className="text-center p-3 bg-surface rounded">
                  <p className="text-xs text-secondary mb-1">فعالیت‌های تامین مالی</p>
                  <p className={`text-lg font-bold ${cashFlowStatement.financingActivities.total >= 0 ? 'text-success' : 'text-danger'}`}>
                    <CurrencyDisplay value={cashFlowStatement.financingActivities.total} />
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

export default CashFlowStatementPage;
