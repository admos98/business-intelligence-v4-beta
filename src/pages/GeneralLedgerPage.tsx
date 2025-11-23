import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useShoppingStore } from '../store/useShoppingStore';
import { AccountType } from '../../shared/types';
import { t } from '../../shared/translations';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { toJalaliDateString } from '../../shared/jalali';

interface GeneralLedgerPageProps {
  onBack: () => void;
}

const GeneralLedgerPage: React.FC<GeneralLedgerPageProps> = ({ onBack }) => {
  const { accounts, getGeneralLedger } = useShoppingStore();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<AccountType | 'all'>('all');

  const filteredAccounts = useMemo(() => {
    if (selectedType === 'all') {
      return accounts.filter(a => a.isActive);
    }
    return accounts.filter(a => a.isActive && a.type === selectedType);
  }, [accounts, selectedType]);

  const ledgerData = useMemo(() => {
    if (!selectedAccountId) {
      return getGeneralLedger();
    }
    return getGeneralLedger(selectedAccountId);
  }, [selectedAccountId, getGeneralLedger]);

  const selectedAccount = selectedAccountId
    ? accounts.find(a => a.id === selectedAccountId)
    : null;

  return (
    <>
      <Header title={t.generalLedger} onBack={onBack} />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Account Selector */}
        <Card title="انتخاب حساب">
          <div className="space-y-4">
            {/* Type Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedType === 'all' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedType('all')}
              >
                همه حساب‌ها
              </Button>
              {Object.values(AccountType).map(type => (
                <Button
                  key={type}
                  variant={selectedType === type ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>

            {/* Account List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedAccountId(null)}
                className={`p-3 rounded-lg text-right transition-colors ${
                  selectedAccountId === null
                    ? 'bg-accent text-accent-text'
                    : 'bg-surface hover:bg-border text-primary'
                }`}
              >
                <div className="font-medium">همه حساب‌ها</div>
                <div className="text-xs opacity-80">نمایش کلیه حساب‌ها</div>
              </button>
              {filteredAccounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`p-3 rounded-lg text-right transition-colors ${
                    selectedAccountId === account.id
                      ? 'bg-accent text-accent-text'
                      : 'bg-surface hover:bg-border text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono opacity-80">{account.code}</span>
                    <span className="font-medium">{account.name}</span>
                  </div>
                  <div className="text-xs opacity-80 mt-1">
                    مانده: <CurrencyDisplay value={Math.abs(account.balance)} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Selected Account Info */}
        {selectedAccount && (
          <Card className="bg-accent/10 border-accent border-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-primary mb-2">
                  حساب انتخاب شده: {selectedAccount.name}
                </h3>
                <div className="text-sm text-secondary space-y-1">
                  <p><span className="font-medium">کد:</span> {selectedAccount.code}</p>
                  <p><span className="font-medium">نوع:</span> {selectedAccount.type}</p>
                  {selectedAccount.description && (
                    <p><span className="font-medium">توضیحات:</span> {selectedAccount.description}</p>
                  )}
                  <p><span className="font-medium">مانده:</span> <CurrencyDisplay value={Math.abs(selectedAccount.balance)} /></p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccountId(null)}
                className="px-4 py-2 bg-surface hover:bg-border rounded-lg transition-colors text-sm font-medium"
              >
                نمایش همه حساب‌ها
              </button>
            </div>
          </Card>
        )}

        {/* General Ledger Display */}
        {ledgerData.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-secondary">
              <p>هنوز هیچ تراکنشی ثبت نشده است</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {ledgerData.map((ledger) => (
              <Card
                key={ledger.account.id}
                title={ledger.account.code + ' - ' + ledger.account.name}
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{ledger.account.code}</span>
                    <span>{ledger.account.name}</span>
                    <span className="text-sm text-secondary">({ledger.account.type})</span>
                  </div>
                  <div className="text-sm text-secondary">
                    مانده: <CurrencyDisplay value={Math.abs(ledger.closingBalance)} />
                  </div>
                </div>
                {ledger.entries.length === 0 ? (
                  <p className="text-center text-secondary py-4">
                    هیچ تراکنشی برای این حساب وجود ندارد
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface">
                          <th className="p-3 text-right">{t.journalDate}</th>
                          <th className="p-3 text-right">{t.journalDescription}</th>
                          <th className="p-3 text-right">{t.journalReference}</th>
                          <th className="p-3 text-right">{t.debit}</th>
                          <th className="p-3 text-right">{t.credit}</th>
                          <th className="p-3 text-right">{t.balance}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.entries.map((entry, index) => (
                          <tr
                            key={index}
                            className="border-b border-border hover:bg-surface transition-colors"
                          >
                            <td className="p-3 text-secondary">
                              {toJalaliDateString(entry.date)}
                            </td>
                            <td className="p-3">{entry.description}</td>
                            <td className="p-3 text-xs text-secondary font-mono">
                              {entry.reference?.substring(0, 8) || '-'}
                            </td>
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
                        {/* Summary Row */}
                        <tr className="bg-accent/10 font-bold">
                          <td colSpan={3} className="p-3 text-right">
                            مانده پایانی
                          </td>
                          <td className="p-3 text-left">
                            {ledger.entries.reduce((sum, e) => sum + e.debit, 0) > 0 && (
                              <CurrencyDisplay
                                value={ledger.entries.reduce((sum, e) => sum + e.debit, 0)}
                              />
                            )}
                          </td>
                          <td className="p-3 text-left">
                            {ledger.entries.reduce((sum, e) => sum + e.credit, 0) > 0 && (
                              <CurrencyDisplay
                                value={ledger.entries.reduce((sum, e) => sum + e.credit, 0)}
                              />
                            )}
                          </td>
                          <td className="p-3 text-left">
                            <CurrencyDisplay value={Math.abs(ledger.closingBalance)} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
};

export default GeneralLedgerPage;
