import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useShoppingStore } from '../store/useShoppingStore';
import { AccountType } from '../../shared/types';
import { t } from '../../shared/translations';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';

interface TrialBalancePageProps {
  onBack: () => void;
}

const TrialBalancePage: React.FC<TrialBalancePageProps> = ({ onBack }) => {
  const { getTrialBalance } = useShoppingStore();
  const [asOfDate, setAsOfDate] = useState<Date>(new Date());
  const [groupByType, setGroupByType] = useState(true);

  const trialBalance = useMemo(() => {
    return getTrialBalance(asOfDate);
  }, [asOfDate, getTrialBalance]);

  // Group entries by account type
  const groupedEntries = useMemo(() => {
    if (!groupByType) {
      return { all: trialBalance.entries };
    }

    const groups: Record<string, typeof trialBalance.entries> = {
      [AccountType.Asset]: [],
      [AccountType.Liability]: [],
      [AccountType.Equity]: [],
      [AccountType.Revenue]: [],
      [AccountType.COGS]: [],
      [AccountType.Expense]: [],
    };

    trialBalance.entries.forEach(entry => {
      const type = entry.account.type;
      if (groups[type]) {
        groups[type].push(entry);
      }
    });

    return groups;
  }, [trialBalance.entries, groupByType]);

  const accountTypeColors: Record<AccountType, string> = {
    [AccountType.Asset]: 'bg-blue-50 dark:bg-blue-900/20',
    [AccountType.Liability]: 'bg-red-50 dark:bg-red-900/20',
    [AccountType.Equity]: 'bg-purple-50 dark:bg-purple-900/20',
    [AccountType.Revenue]: 'bg-green-50 dark:bg-green-900/20',
    [AccountType.COGS]: 'bg-orange-50 dark:bg-orange-900/20',
    [AccountType.Expense]: 'bg-yellow-50 dark:bg-yellow-900/20',
  };

  return (
    <>
      <Header title={t.trialBalance} onBack={onBack} />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Controls */}
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
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
            <div className="flex items-center gap-2">
              <Button
                variant={groupByType ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setGroupByType(true)}
              >
                گروه‌بندی بر اساس نوع
              </Button>
              <Button
                variant={!groupByType ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setGroupByType(false)}
              >
                لیست ساده
              </Button>
            </div>
          </div>
        </Card>

        {/* Balance Status */}
        <Card className={trialBalance.balanced ? 'bg-success/10 border-success' : 'bg-danger/10 border-danger'}>
          <div className="text-center">
            <p className="text-2xl font-bold mb-2">
              {trialBalance.balanced ? (
                <span className="text-success">✓ {t.booksBalanced}</span>
              ) : (
                <span className="text-danger">✗ {t.booksNotBalanced}</span>
              )}
            </p>
            <p className="text-sm text-secondary">
              {t.asOf(toJalaliDateString(asOfDate.toISOString()))}
            </p>
            {!trialBalance.balanced && (
              <div className="mt-4 p-4 bg-danger/20 rounded-lg">
                <p className="text-danger font-bold">
                  {t.difference}: <CurrencyDisplay value={Math.abs(trialBalance.totalDebit - trialBalance.totalCredit)} />
                </p>
                <p className="text-xs text-secondary mt-1">
                  لطفاً ثبت‌های روزنامه را بررسی کنید
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Trial Balance Table */}
        {groupByType ? (
          <div className="space-y-6">
            {Object.entries(groupedEntries).map(([type, entries]) => {
              if (entries.length === 0) return null;

              const typeDebit = entries.reduce((sum, e) => sum + e.debit, 0);
              const typeCredit = entries.reduce((sum, e) => sum + e.credit, 0);

              return (
                <Card
                  key={type}
                  title={type}
                  className={`border-r-4 ${accountTypeColors[type as AccountType]}`}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface">
                          <th className="p-3 text-right">کد حساب</th>
                          <th className="p-3 text-right">نام حساب</th>
                          <th className="p-3 text-right">{t.debit}</th>
                          <th className="p-3 text-right">{t.credit}</th>
                          <th className="p-3 text-right">{t.balance}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr
                            key={entry.account.id}
                            className="border-b border-border hover:bg-surface transition-colors"
                          >
                            <td className="p-3 font-mono text-secondary">{entry.account.code}</td>
                            <td className="p-3">{entry.account.name}</td>
                            <td className="p-3 text-left">
                              {entry.debit > 0 ? (
                                <CurrencyDisplay value={entry.debit} />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="p-3 text-left">
                              {entry.credit > 0 ? (
                                <CurrencyDisplay value={entry.credit} />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="p-3 text-left font-bold">
                              <CurrencyDisplay value={Math.abs(entry.balance)} />
                            </td>
                          </tr>
                        ))}
                        {/* Subtotal Row */}
                        <tr className="bg-accent/10 font-bold">
                          <td colSpan={2} className="p-3 text-right">
                            جمع {type}
                          </td>
                          <td className="p-3 text-left">
                            <CurrencyDisplay value={typeDebit} />
                          </td>
                          <td className="p-3 text-left">
                            <CurrencyDisplay value={typeCredit} />
                          </td>
                          <td className="p-3 text-left">
                            <CurrencyDisplay value={Math.abs(typeDebit - typeCredit)} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="p-3 text-right">کد حساب</th>
                    <th className="p-3 text-right">نام حساب</th>
                    <th className="p-3 text-right">نوع حساب</th>
                    <th className="p-3 text-right">{t.debit}</th>
                    <th className="p-3 text-right">{t.credit}</th>
                    <th className="p-3 text-right">{t.balance}</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.entries.map((entry) => (
                    <tr
                      key={entry.account.id}
                      className="border-b border-border hover:bg-surface transition-colors"
                    >
                      <td className="p-3 font-mono text-secondary">{entry.account.code}</td>
                      <td className="p-3">{entry.account.name}</td>
                      <td className="p-3 text-sm text-secondary">{entry.account.type}</td>
                      <td className="p-3 text-left">
                        {entry.debit > 0 ? (
                          <CurrencyDisplay value={entry.debit} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-left">
                        {entry.credit > 0 ? (
                          <CurrencyDisplay value={entry.credit} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-left font-bold">
                        <CurrencyDisplay value={Math.abs(entry.balance)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Totals */}
        <Card className="bg-accent/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-secondary mb-2">{t.totalDebits}</p>
              <p className="text-3xl font-bold text-primary">
                <CurrencyDisplay value={trialBalance.totalDebit} />
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-secondary mb-2">{t.totalCredits}</p>
              <p className="text-3xl font-bold text-primary">
                <CurrencyDisplay value={trialBalance.totalCredit} />
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-secondary mb-2">{t.difference}</p>
              <p className={`text-3xl font-bold ${trialBalance.balanced ? 'text-success' : 'text-danger'}`}>
                <CurrencyDisplay value={Math.abs(trialBalance.totalDebit - trialBalance.totalCredit)} />
              </p>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
};

export default TrialBalancePage;
