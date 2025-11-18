import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ShoppingList, ItemStatus, SmartSuggestion, PendingPaymentItem } from '../../shared/types';
import Header from '../components/common/Header';
import NewListModal from '../components/modals/NewListModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import ReportsModal from '../components/modals/ReportsModal';
import { t } from '../../shared/translations';
import { useShoppingStore } from '../store/useShoppingStore';
import { useToast } from '../components/common/Toast';
import { toJalaliDateString, gregorianToJalali } from '../../shared/jalali';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useDebounce } from '../hooks/useDebounce';
import { usePageActions } from '../contexts/PageActionsContext';

interface DashboardProps {
  onSelectList: (listId: string) => void;
  onViewAnalysis: () => void;
  onViewVendors: () => void;
  onViewItems: () => void;
  onViewSummary: () => void;
  onLogout: () => void;
}

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
const SearchIcon = ({className}: {className?: string}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const ChevronDownIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>;


const Dashboard: React.FC<DashboardProps> = ({ onSelectList, onViewAnalysis, onViewVendors, onViewItems, onViewSummary }) => {
  const store = useShoppingStore();
  const { lists, createList, deleteList, importData, exportData, getSmartSuggestions, getPendingPayments, vendors, getExpenseForecast, addItemFromSuggestion, isItemInTodaysPendingList } = store;
  const [isNewListModalOpen, setIsNewListModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [expandSuggestions, setExpandSuggestions] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const importInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; listId: string; listName: string; }>({ isOpen: false, listId: '', listName: '' });
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  const vendorMap = React.useMemo(() => new Map(vendors.map(v => [v.id, v.name])), [vendors]);

  const handleCreateAndOpenList = (date: Date) => {
    const listId = createList(date);
    addToast(t.listCreated, 'success');
    setIsNewListModalOpen(false);
    onSelectList(listId);
  };

  const handleAddItemFromSuggestion = (suggestion: SmartSuggestion) => {
    const wasAdded = addItemFromSuggestion(suggestion);
    if (wasAdded) {
        addToast(t.itemAddedToList, 'success');
    } else {
        addToast(t.itemAlreadyInList, 'info');
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const result = e.target?.result;
            if (typeof result === 'string') {
                await importData(result);
                addToast(t.importSuccess, 'success');
                addToast(t.dataSynced, 'success');
            } else {
                throw new Error("File could not be read as text.");
            }
        } catch (error) {
            addToast(t.importError, 'error');
            console.error("Import failed:", error);
            if (error instanceof Error && (error.message.includes('saveData'))) {
                addToast(t.syncError, 'error');
            }
        }
    };
    reader.readAsText(file);
    if(event.target) event.target.value = '';
  };

  const triggerImport = () => {
    importInputRef.current?.click();
  };

  const handleExportData = () => {
    const dataString = exportData();
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `mehrnoosh_cafe_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t.exportSuccess, 'success');
  };

  const handleDelete = (listId: string, listName: string) => {
    setDeleteConfirm({ isOpen: true, listId, listName });
  };

  const confirmDelete = () => {
    deleteList(deleteConfirm.listId);
    addToast(t.listDeleted, 'info');
  };

  const smartSuggestions = getSmartSuggestions();
  const pendingPayments = getPendingPayments();
  const expenseForecast = getExpenseForecast();

  const displayedSuggestions = expandSuggestions ? smartSuggestions : smartSuggestions.slice(0, 6);
  const hiddenSuggestionsCount = Math.max(0, smartSuggestions.length - 6);

  const filteredLists = useMemo(() => {
    const sortedLists = [...lists].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (!debouncedSearchQuery.trim()) {
      return sortedLists;
    }
    const query = debouncedSearchQuery.toLowerCase().trim();
    return sortedLists.filter(list =>
      list.name.toLowerCase().includes(query) ||
      list.items.some(item => item.name.toLowerCase().includes(query))
    );
  }, [debouncedSearchQuery, lists]);

  const { currentMonthLists, pastMonthsGroups } = useMemo(() => {
    const today = new Date();
    const [currentJalaliYear, currentJalaliMonth] = gregorianToJalali(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate());
    const currentMonthKey = `${currentJalaliYear}-${currentJalaliMonth}`;

    const current: ShoppingList[] = [];
    const pastGroups: Record<string, ShoppingList[]> = {};

    filteredLists.forEach(list => {
      const listDate = new Date(list.createdAt);
      const [jy, jm] = gregorianToJalali(listDate.getUTCFullYear(), listDate.getUTCMonth() + 1, listDate.getUTCDate());
      const monthKey = `${jy}-${jm}`;

      if (monthKey === currentMonthKey) {
        current.push(list);
      } else {
        if (!pastGroups[monthKey]) {
          pastGroups[monthKey] = [];
        }
        pastGroups[monthKey].push(list);
      }
    });

    return { currentMonthLists: current, pastMonthsGroups: pastGroups };
  }, [filteredLists]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const newExpanded: Record<string, boolean> = {};
      Object.keys(pastMonthsGroups).forEach(monthKey => {
        newExpanded[monthKey] = true;
      });
      setExpandedMonths(newExpanded);
    } else {
      setExpandedMonths({});
    }
  }, [searchQuery, pastMonthsGroups]);

  const toggleMonthExpansion = (monthKey: string) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  const { setActions } = usePageActions();

  // Register page actions with Navbar
  useEffect(() => {
    const actions = (
      <>
        <Button key="summary" variant="secondary" size="sm" onClick={onViewSummary} fullWidth>
          {t.executiveSummary}
        </Button>
        <Button key="reports" variant="primary" size="sm" onClick={() => setIsReportsModalOpen(true)} fullWidth>
          {t.generateReport}
        </Button>
        <Button key="analysis" variant="ghost" size="sm" onClick={onViewAnalysis} fullWidth>
          {t.analysisDashboard}
        </Button>
        <Button key="vendors" variant="ghost" size="sm" onClick={onViewVendors} fullWidth>
          {t.manageVendors}
        </Button>
        <Button key="items" variant="ghost" size="sm" onClick={onViewItems} fullWidth>
          {t.manageItems}
        </Button>
      </>
    );
    setActions(actions);
    return () => {
      setActions(null);
    };
  }, [setActions, onViewSummary, onViewAnalysis, onViewVendors, onViewItems, setIsReportsModalOpen]);

  return (
    <>
      <Header title={t.appTitle} hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title={t.todaysBriefing} className="lg:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <ExpenseForecastCard forecast={expenseForecast} />
                    </div>
                    <div className="md:col-span-2">
                        <h4 className="font-bold text-primary mb-3">{t.todaysSmartSuggestions}</h4>
                        {smartSuggestions.length > 0 ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {displayedSuggestions.map(s => <SmartSuggestionCard key={s.name+s.unit} suggestion={s} onAdd={handleAddItemFromSuggestion} isAdded={isItemInTodaysPendingList(s.name, s.unit)} />)}
                                </div>
                                {hiddenSuggestionsCount > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        fullWidth
                                        onClick={() => setExpandSuggestions(!expandSuggestions)}
                                        className="mt-3"
                                    >
                                        {expandSuggestions ? t.collapseSuggestions : t.expandSuggestions(hiddenSuggestionsCount)}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <p className="text-center text-secondary py-4">{t.noSuggestions}</p>
                        )}
                    </div>
                </div>
            </Card>
        </div>

        {pendingPayments.length > 0 && (
            <div>
                <h2 className="text-xl font-bold text-primary mb-4">{t.pendingPayments}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingPayments.map(item => <PendingPaymentCard key={item.id} item={item} vendorName={item.vendorId ? vendorMap.get(item.vendorId) : undefined} onGoToList={onSelectList} />)}
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <h1 className="text-2xl font-bold text-primary">{t.myShoppingLists}</h1>
           <div className="relative w-full md:max-w-sm">
              <input
                  type="text"
                  placeholder={t.searchLists}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pr-10 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" />
          </div>
          <div className="flex gap-2 justify-end flex-wrap">
             <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImportData} />
             <Button variant="ghost" size="sm" onClick={() => setImportConfirmOpen(true)}>
               {t.importData}
             </Button>
             <Button variant="ghost" size="sm" onClick={handleExportData}>
               {t.exportData}
             </Button>
            <Button
              onClick={() => setIsNewListModalOpen(true)}
              size="sm"
              icon={<PlusIcon />}
            >
              {t.createNewList}
            </Button>
          </div>
        </div>

        {lists.length === 0 ? (
          <Card className="col-span-full">
            <div className="text-center py-16 px-6 animate-fade-in">
              <div className="text-6xl mb-4 animate-scale-in">📝</div>
              <p className="text-secondary text-lg font-semibold mb-2 animate-fade-in-down">{t.noListsYet}</p>
              <p className="text-secondary mb-6 animate-fade-in-up">{t.getStartedPrompt}</p>
              <Button
                variant="primary"
                onClick={() => setIsNewListModalOpen(true)}
                icon={<PlusIcon />}
                className="animate-fade-in-up"
                style={{ animationDelay: '200ms' }}
              >
                {t.createNewList}
              </Button>
            </div>
          </Card>
        ) : filteredLists.length === 0 ? (
            <Card className="col-span-full">
              <div className="text-center py-16 px-6 animate-fade-in">
                <div className="text-5xl mb-4 animate-scale-in">🔍</div>
                <p className="text-secondary text-lg font-semibold animate-fade-in-down">
                  {t.noListsFoundForSearch(searchQuery)}
                </p>
              </div>
            </Card>
        ) : (
          <div className="space-y-8">
            {currentMonthLists.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentMonthLists.map((list: ShoppingList) => (
                        <ListCard key={list.id} list={list} onSelect={onSelectList} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {Object.keys(pastMonthsGroups).sort().reverse().map(monthKey => {
                const [year, month] = monthKey.split('-').map(Number);
                const monthName = t.jalaliMonths[month - 1];
                const isExpanded = expandedMonths[monthKey] || false;

                return (
                    <div key={monthKey}>
                        <button
                            onClick={() => toggleMonthExpansion(monthKey)}
                            className="w-full flex justify-between items-center p-3 bg-surface rounded-lg border border-border shadow-subtle mb-4"
                        >
                            <h3 className="font-bold text-primary">{t.pastMonthHeader(monthName, year)}</h3>
                            <ChevronDownIcon className={`w-5 h-5 text-secondary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        {isExpanded && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                                {pastMonthsGroups[monthKey].map(list => (
                                    <ListCard key={list.id} list={list} onSelect={onSelectList} onDelete={handleDelete} />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
          </div>
        )}
      </main>
      {isNewListModalOpen && (
        <NewListModal onClose={() => setIsNewListModalOpen(false)} onCreate={handleCreateAndOpenList} />
      )}
      {isReportsModalOpen && <ReportsModal onClose={() => setIsReportsModalOpen(false)} />}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
        onConfirm={confirmDelete}
        title={t.confirmDeleteTitle}
        message={t.confirmDeleteList(deleteConfirm.listName)}
        variant="danger"
      />
      <ConfirmModal
        isOpen={importConfirmOpen}
        onClose={() => setImportConfirmOpen(false)}
        onConfirm={triggerImport}
        title={t.importData}
        message={t.confirmImport}
        confirmText={t.importData}
      />
    </>
  );
};

const ListCard: React.FC<{list: ShoppingList, onSelect: (id: string) => void, onDelete: (id: string, name: string) => void}> = ({ list, onSelect, onDelete }) => {
    const boughtItems = list.items.filter(i => i.status === ItemStatus.Bought).length;
    const totalItems = list.items.length;
    const progress = totalItems > 0 ? (boughtItems / totalItems) * 100 : 0;

    const getStatusPill = () => {
      if (totalItems > 0 && boughtItems === totalItems) {
        return <span className="text-xs font-medium px-2 py-1 bg-success-soft text-success rounded-full animate-scale-in">{t.completed}</span>;
      }
      if (boughtItems > 0) {
        return <span className="text-xs font-medium px-2 py-1 bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 rounded-full animate-scale-in">{t.inProgress}</span>;
      }
      return <span className="text-xs font-medium px-2 py-1 bg-secondary/20 text-secondary rounded-full animate-scale-in">{t.new}</span>;
    };

    return (
      <Card
        className="flex flex-col group hover-lift animate-fade-in p-0 overflow-hidden"
        hover
        onClick={() => onSelect(list.id)}
      >
        <div className="flex-grow p-5">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg font-bold text-primary animate-fade-in-down">{list.name}</h2>
            {getStatusPill()}
          </div>
          <p className="text-sm text-secondary mb-4 animate-fade-in-up">{toJalaliDateString(list.createdAt, { format: 'long' })}</p>
          <div className="text-sm text-secondary space-y-2 animate-fade-in-up">
            <p>{t.totalItems}: <span className="font-medium text-primary">{totalItems}</span></p>
            <p>{t.itemsPurchased}: <span className="font-medium text-primary">{boughtItems}</span></p>
          </div>
        </div>
        <div className="px-5 pb-5 animate-fade-in-up">
          <p className="text-xs text-secondary mb-1">{t.progress}</p>
          <div className="w-full bg-background rounded-full h-2 overflow-hidden">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="p-2 border-t border-border text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(list.id, list.name);
            }}
            className="w-full"
          >
            {t.delete}
          </Button>
        </div>
      </Card>
    );
};


const SmartSuggestionCard: React.FC<{suggestion: SmartSuggestion, onAdd: (suggestion: SmartSuggestion) => void, isAdded: boolean}> = ({ suggestion, onAdd, isAdded }) => {
    const priorityColor: Record<SmartSuggestion['priority'], string> = {
        high: 'border-danger/50 bg-danger/5',
        medium: 'border-yellow-500/50 bg-yellow-500/5',
        low: 'border-transparent bg-background',
    }
    return (
        <div className={`p-3 rounded-lg border ${priorityColor[suggestion.priority]} flex flex-col`}>
            <div className="flex-grow">
                <p className="font-bold text-primary text-sm truncate">{suggestion.name}</p>
                <p className="text-xs text-secondary">{suggestion.category}</p>
                <div className="text-xs text-secondary mt-2 pt-2 border-t border-border">
                    <p className="leading-relaxed">{suggestion.reason}</p>
                </div>
            </div>
            <button
                onClick={() => onAdd(suggestion)}
                disabled={isAdded}
                className="mt-2 w-full flex items-center justify-center gap-2 px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded-md hover:bg-accent/20 transition-colors disabled:bg-success/20 disabled:text-success disabled:cursor-not-allowed"
            >
                {isAdded ? <CheckIcon /> : <PlusIcon />}
                <span>{isAdded ? t.completed : 'افزودن'}</span>
            </button>
        </div>
    );
};

const ExpenseForecastCard: React.FC<{forecast: { daily: number; monthly: number } | null}> = ({ forecast }) => {
    return (
        <div className="h-full bg-background p-4 rounded-lg border border-border flex flex-col justify-center">
            <h4 className="font-bold text-primary mb-3">{t.expenseForecast}</h4>
            {forecast ? (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-secondary">{t.avgDailyExpense}</p>
                        <CurrencyDisplay value={forecast.daily} className="font-bold text-lg text-accent"/>
                    </div>
                     <div>
                        <p className="text-sm text-secondary">{t.estimatedMonthlyExpense}</p>
                        <CurrencyDisplay value={forecast.monthly} className="font-bold text-lg text-accent"/>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-secondary text-center py-4">{t.notEnoughDataForForecast}</p>
            )}
        </div>
    )
}

const PendingPaymentCard: React.FC<{item: PendingPaymentItem, vendorName?: string, onGoToList: (listId: string) => void}> = ({ item, vendorName, onGoToList }) => {
    return (
        <Card>
            <div className="flex flex-col justify-between h-full">
                <div>
                    <div className="flex justify-between items-start">
                        <p className="font-bold text-primary text-md">{item.name}</p>
                        <CurrencyDisplay value={item.paidPrice || 0} className="font-semibold text-danger" />
                    </div>
                    <p className="text-sm text-secondary">{vendorName || 'نامشخص'}</p>
                    <p className="text-xs text-secondary mt-1">{t.purchasedOn(toJalaliDateString(item.purchaseDate, {format: 'long'}))}</p>
                </div>
                <button
                    onClick={() => onGoToList(item.listId)}
                    className="mt-4 w-full text-center px-3 py-1.5 bg-border text-primary text-sm font-medium rounded-md hover:bg-accent hover:text-accent-text transition-colors"
                >
                    {t.goToShoppingList}
                </button>
            </div>
        </Card>
    );
};


export default Dashboard;
