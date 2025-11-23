import React, { useState, useMemo } from 'react';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { useShoppingStore } from '../store/useShoppingStore';
import { Account, AccountType } from '../../shared/types';
import { t } from '../../shared/translations';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import AccountModal from '../components/modals/AccountModal';

interface ChartOfAccountsPageProps {
  onBack: () => void;
}

const ChartOfAccountsPage: React.FC<ChartOfAccountsPageProps> = ({ onBack }) => {
  const { accounts, getAccountsByType, initializeDefaultAccounts } = useShoppingStore();
  const [selectedType, setSelectedType] = useState<AccountType | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | undefined>(undefined);

  // Initialize accounts if empty
  React.useEffect(() => {
    if (accounts.length === 0) {
      initializeDefaultAccounts();
    }
  }, [accounts.length, initializeDefaultAccounts]);

  const filteredAccounts = useMemo(() => {
    if (selectedType === 'all') {
      return accounts.filter(a => a.isActive);
    }
    return getAccountsByType(selectedType);
  }, [accounts, selectedType, getAccountsByType]);

  // Group accounts by type
  const accountsByType = useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      [AccountType.Asset]: [],
      [AccountType.Liability]: [],
      [AccountType.Equity]: [],
      [AccountType.Revenue]: [],
      [AccountType.COGS]: [],
      [AccountType.Expense]: [],
    };

    filteredAccounts.forEach(acc => {
      if (groups[acc.type]) {
        groups[acc.type].push(acc);
      }
    });

    return groups;
  }, [filteredAccounts]);

  const accountTypeColors: Record<AccountType, string> = {
    [AccountType.Asset]: 'bg-blue-100 dark:bg-blue-900/30 border-blue-500',
    [AccountType.Liability]: 'bg-red-100 dark:bg-red-900/30 border-red-500',
    [AccountType.Equity]: 'bg-purple-100 dark:bg-purple-900/30 border-purple-500',
    [AccountType.Revenue]: 'bg-green-100 dark:bg-green-900/30 border-green-500',
    [AccountType.COGS]: 'bg-orange-100 dark:bg-orange-900/30 border-orange-500',
    [AccountType.Expense]: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500',
  };

  return (
    <>
      <Header title={t.chartOfAccounts} onBack={onBack} />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header with Add Button */}
        <div className="flex justify-between items-center">
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
          <Button variant="primary" size="sm" onClick={() => { setAccountToEdit(undefined); setShowAddModal(true); }}>
            + افزودن حساب
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(AccountType).map(([key, type]) => {
            const typeAccounts = accountsByType[type];
            const totalBalance = typeAccounts.reduce((sum, acc) => sum + acc.balance, 0);
            return (
              <Card key={key} className="text-center">
                <p className="text-xs text-secondary mb-1">{type}</p>
                <p className="text-lg font-bold text-primary">
                  {typeAccounts.length}
                </p>
                <p className="text-xs text-secondary mt-1">
                  <CurrencyDisplay value={Math.abs(totalBalance)} />
                </p>
              </Card>
            );
          })}
        </div>

        {/* Accounts by Type */}
        {selectedType === 'all' ? (
          <div className="space-y-6">
            {Object.entries(AccountType).map(([key, type]) => {
              const typeAccounts = accountsByType[type];
              if (typeAccounts.length === 0) return null;

              return (
                <Card key={key} title={type} className={`border-r-4 ${accountTypeColors[type]}`}>
                  <div className="space-y-2">
                    {typeAccounts.map(account => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-border transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-secondary">{account.code}</span>
                            <span className="font-medium text-primary">{account.name}</span>
                            {account.nameEn && (
                              <span className="text-xs text-secondary">({account.nameEn})</span>
                            )}
                          </div>
                          {account.description && (
                            <p className="text-xs text-secondary mt-1">{account.description}</p>
                          )}
                        </div>
                        <div className="text-left flex items-center gap-2">
                          <p className="font-bold text-primary">
                            <CurrencyDisplay value={Math.abs(account.balance)} />
                          </p>
                          <p className="text-xs text-secondary">
                            {account.balance >= 0 ? t.debit : t.credit}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAccountToEdit(account);
                              setShowAddModal(true);
                            }}
                            className="p-1 text-secondary hover:text-primary transition-colors"
                            title="ویرایش"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card title={selectedType} className={`border-r-4 ${accountTypeColors[selectedType]}`}>
            <div className="space-y-2">
              {filteredAccounts.map(account => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-border transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-secondary">{account.code}</span>
                      <span className="font-medium text-primary">{account.name}</span>
                      {account.nameEn && (
                        <span className="text-xs text-secondary">({account.nameEn})</span>
                      )}
                    </div>
                    {account.description && (
                      <p className="text-xs text-secondary mt-1">{account.description}</p>
                    )}
                  </div>
                  <div className="text-left flex items-center gap-2">
                    <p className="font-bold text-primary">
                      <CurrencyDisplay value={Math.abs(account.balance)} />
                    </p>
                    <p className="text-xs text-secondary">
                      {account.balance >= 0 ? t.debit : t.credit}
                    </p>
                    <button
                      onClick={() => {
                        setAccountToEdit(account);
                        setShowAddModal(true);
                      }}
                      className="p-1 text-secondary hover:text-primary transition-colors"
                      title="ویرایش"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Accounting Equation */}
        <Card title="معادله حسابداری" className="bg-accent/5">
          <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
            <div className="text-center">
              <p className="text-secondary mb-1">{t.asset}</p>
              <p className="text-2xl font-bold text-primary">
                <CurrencyDisplay
                  value={accountsByType[AccountType.Asset].reduce((sum, a) => sum + a.balance, 0)}
                />
              </p>
            </div>
            <span className="text-3xl font-bold text-secondary">=</span>
            <div className="text-center">
              <p className="text-secondary mb-1">{t.liability}</p>
              <p className="text-2xl font-bold text-primary">
                <CurrencyDisplay
                  value={accountsByType[AccountType.Liability].reduce((sum, a) => sum + a.balance, 0)}
                />
              </p>
            </div>
            <span className="text-3xl font-bold text-secondary">+</span>
            <div className="text-center">
              <p className="text-secondary mb-1">{t.equity}</p>
              <p className="text-2xl font-bold text-primary">
                <CurrencyDisplay
                  value={accountsByType[AccountType.Equity].reduce((sum, a) => sum + a.balance, 0)}
                />
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-xs text-secondary">
              {Math.abs(
                accountsByType[AccountType.Asset].reduce((sum, a) => sum + a.balance, 0) -
                (accountsByType[AccountType.Liability].reduce((sum, a) => sum + a.balance, 0) +
                  accountsByType[AccountType.Equity].reduce((sum, a) => sum + a.balance, 0))
              ) < 0.01 ? (
                <span className="text-success font-bold">✓ {t.booksBalanced}</span>
              ) : (
                <span className="text-danger font-bold">✗ {t.booksNotBalanced}</span>
              )}
            </p>
          </div>
        </Card>
      </main>
      {showAddModal && (
        <AccountModal
          accountToEdit={accountToEdit}
          onClose={() => {
            setShowAddModal(false);
            setAccountToEdit(undefined);
          }}
        />
      )}
    </>
  );
};

export default ChartOfAccountsPage;
