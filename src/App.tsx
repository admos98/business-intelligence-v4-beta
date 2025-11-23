import React, { useState, useEffect, Suspense } from 'react';
import Dashboard from './pages/Dashboard';
import ShoppingView from './pages/ShoppingView';
import AnalysisDashboard from './pages/AnalysisDashboard';
import VendorsDashboard from './pages/VendorsDashboard';
import SummaryDashboard from './pages/SummaryDashboard';
import ItemsDashboard from './pages/ItemsDashboard';
import SellDashboard from './pages/SellDashboard';
import RecipeDashboard from './pages/RecipeDashboard';
import SellAnalysisDashboard from './pages/SellAnalysisDashboard';
import FinancialDashboard from './pages/FinancialDashboard';
import ChartOfAccountsPage from './pages/ChartOfAccountsPage';
import GeneralLedgerPage from './pages/GeneralLedgerPage';
import TrialBalancePage from './pages/TrialBalancePage';
import BalanceSheetPage from './pages/BalanceSheetPage';
import IncomeStatementPage from './pages/IncomeStatementPage';
import CashFlowStatementPage from './pages/CashFlowStatementPage';
import { TaxSettingsPage } from './pages/TaxSettingsPage';
import { TaxReportsPage } from './pages/TaxReportsPage';
import { CustomersPage } from './pages/CustomersPage';
import { AgingReportsPage } from './pages/AgingReportsPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { DataValidationPage } from './pages/DataValidationPage';
import { BackupRestorePage } from './pages/BackupRestorePage';
import { UserManagementPage } from './pages/UserManagementPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/common/Navbar';
import { ToastProvider } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { SafeSVG } from './components/common/SafeSVG';
import { useTheme } from './hooks/useTheme';
import { useShoppingStore } from './store/useShoppingStore';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { t } from '../shared/translations';
import { logoSvg } from './assets/logo';
import { PageActionsProvider, usePageActions } from './contexts/PageActionsContext';
import './styles/animations.css';

type View = 'dashboard' | 'list' | 'analysis' | 'vendors' | 'summary' | 'items' | 'sell' | 'recipes' | 'sellAnalysis' | 'financial' | 'chartOfAccounts' | 'generalLedger' | 'trialBalance' | 'balanceSheet' | 'incomeStatement' | 'cashFlow' | 'taxSettings' | 'taxReports' | 'customers' | 'agingReports' | 'auditLog' | 'dataValidation' | 'backupRestore' | 'userManagement';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const { currentUser, login, logout, hydrateFromCloud, isHydrating } = useShoppingStore();
  useTheme();

  // Session timeout: 30 minutes with 5 minute warning
  useSessionTimeout({
    timeoutMinutes: 30,
    warningMinutes: 5,
    onTimeout: () => {
      setView('dashboard');
    },
  });

  useEffect(() => {
    if (currentUser) {
      hydrateFromCloud();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // hydrateFromCloud is stable from zustand store


  const handleSelectList = (listId: string) => {
    setActiveListId(listId);
    setView('list');
  };

  const handleNavigate = (targetView: View) => {
    setActiveListId(null);
    setView(targetView);
  };

  const handleLogout = () => {
    logout();
    setView('dashboard'); // Reset to default view on logout
  };

  const commonProps = {};

  const renderView = () => {
    if (isHydrating) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center animate-fade-in">
            <SafeSVG svgContent={logoSvg} className="w-20 h-20 mb-4 animate-pulse" />
            <LoadingSpinner size="lg" className="my-4" />
            <h2 className="text-xl font-semibold text-primary mb-2">{t.loadingData}</h2>
            <p className="text-secondary">{t.syncingData}</p>
        </div>
      );
    }

    switch (view) {
      case 'list':
        return activeListId ? (
          <ErrorBoundary>
            <ShoppingView
              listId={activeListId}
              onBack={() => handleNavigate('dashboard')}
              onLogout={handleLogout}
              {...commonProps}
            />
          </ErrorBoundary>
        ) : null;
      case 'analysis':
        return <ErrorBoundary><AnalysisDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} /></ErrorBoundary>;
      case 'vendors':
        return <ErrorBoundary><VendorsDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} /></ErrorBoundary>;
      case 'items':
        return <ErrorBoundary><ItemsDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} /></ErrorBoundary>;
      case 'summary':
        return <ErrorBoundary><SummaryDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} /></ErrorBoundary>;
      case 'sell':
        return <ErrorBoundary><SellDashboard onViewSellAnalysis={() => handleNavigate('sellAnalysis')} /></ErrorBoundary>;
      case 'recipes':
        return <ErrorBoundary><RecipeDashboard /></ErrorBoundary>;
      case 'sellAnalysis':
        return <ErrorBoundary><SellAnalysisDashboard /></ErrorBoundary>;
      case 'financial':
        return <ErrorBoundary><FinancialDashboard onLogout={handleLogout} onNavigate={(view) => handleNavigate(view as View)} /></ErrorBoundary>;
      case 'chartOfAccounts':
        return <ErrorBoundary><ChartOfAccountsPage onBack={() => handleNavigate('dashboard')} /></ErrorBoundary>;
      case 'generalLedger':
        return <ErrorBoundary><GeneralLedgerPage onBack={() => handleNavigate('dashboard')} /></ErrorBoundary>;
      case 'trialBalance':
        return <ErrorBoundary><TrialBalancePage onBack={() => handleNavigate('dashboard')} /></ErrorBoundary>;
      case 'balanceSheet':
        return <ErrorBoundary><BalanceSheetPage onBack={() => handleNavigate('dashboard')} /></ErrorBoundary>;
      case 'incomeStatement':
        return <ErrorBoundary><IncomeStatementPage onBack={() => handleNavigate('dashboard')} /></ErrorBoundary>;
      case 'cashFlow':
        return <ErrorBoundary><CashFlowStatementPage onBack={() => handleNavigate('dashboard')} /></ErrorBoundary>;
      case 'taxSettings':
        return <ErrorBoundary><TaxSettingsPage /></ErrorBoundary>;
      case 'taxReports':
        return <ErrorBoundary><TaxReportsPage /></ErrorBoundary>;
      case 'customers':
        return <ErrorBoundary><CustomersPage /></ErrorBoundary>;
      case 'agingReports':
        return <ErrorBoundary><AgingReportsPage /></ErrorBoundary>;
      case 'auditLog':
        return <ErrorBoundary><AuditLogPage /></ErrorBoundary>;
      case 'dataValidation':
        return <ErrorBoundary><DataValidationPage /></ErrorBoundary>;
      case 'backupRestore':
        return <ErrorBoundary><BackupRestorePage /></ErrorBoundary>;
      case 'userManagement':
        return <ErrorBoundary><UserManagementPage /></ErrorBoundary>;
      case 'dashboard':
      default:
        return (
          <ErrorBoundary>
            <Dashboard
              onSelectList={handleSelectList}
              onViewAnalysis={() => handleNavigate('analysis')}
              onViewVendors={() => handleNavigate('vendors')}
              onViewItems={() => handleNavigate('items')}
              onViewSummary={() => handleNavigate('summary')}
              onLogout={handleLogout}
              {...commonProps}
            />
          </ErrorBoundary>
        );
    }
  };

  if (!currentUser) {
    return (
      <ErrorBoundary>
        <ToastProvider>
          <div className="min-h-screen bg-background text-primary font-sans animate-fade-in">
            <LoginPage onLogin={login} />
          </div>
        </ToastProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <PageActionsProvider>
          <div className="min-h-screen bg-background text-primary font-sans flex flex-col md:flex-row transition-all">
            <AppContent
              view={view}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              renderView={renderView}
            />
            <OfflineIndicator />
          </div>
        </PageActionsProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

const AppContent: React.FC<{
  view: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  renderView: () => React.ReactNode;
}> = ({ view, onNavigate, onLogout, renderView }) => {
  const { actions } = usePageActions();

  return (
    <>
      <Navbar
        currentView={view}
        onNavigate={(viewId: string) => onNavigate(viewId as View)}
        onLogout={onLogout}
        pageActions={actions}
      />
      <main className={`flex-1 w-full min-w-0 animate-fade-in transition-all duration-300 overflow-x-hidden`}>
        <Suspense fallback={<LoadingSpinner size="lg" className="min-h-screen" text="در حال بارگذاری..." />}>
          {renderView()}
        </Suspense>
      </main>
    </>
  );
};

export default App;
