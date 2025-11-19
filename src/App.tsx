import React, { useState, useEffect, Suspense, lazy } from 'react';
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
import LoginPage from './pages/LoginPage';
import Navbar from './components/common/Navbar';
import { ToastProvider } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import { SafeSVG } from './components/common/SafeSVG';
import { useTheme } from './hooks/useTheme';
import { useShoppingStore } from './store/useShoppingStore';
import { t } from '../shared/translations';
import { logoSvg } from './assets/logo';
import { PageActionsProvider, usePageActions } from './contexts/PageActionsContext';
import './styles/animations.css';

type View = 'dashboard' | 'list' | 'analysis' | 'vendors' | 'summary' | 'items' | 'sell' | 'recipes' | 'sellAnalysis' | 'financial';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const { currentUser, login, logout, hydrateFromCloud, isHydrating } = useShoppingStore();
  useTheme();

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
          <ShoppingView
            listId={activeListId}
            onBack={() => handleNavigate('dashboard')}
            {...commonProps}
          />
        ) : null;
      case 'analysis':
        return <AnalysisDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} />;
      case 'vendors':
        return <VendorsDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} />;
      case 'items':
        return <ItemsDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} />;
      case 'summary':
        return <SummaryDashboard onBack={() => handleNavigate('dashboard')} {...commonProps} />;
      case 'sell':
        return <SellDashboard onLogout={handleLogout} onViewSellAnalysis={() => handleNavigate('sellAnalysis')} />;
      case 'recipes':
        return <RecipeDashboard onLogout={handleLogout} />;
      case 'sellAnalysis':
        return <SellAnalysisDashboard onLogout={handleLogout} />;
      case 'financial':
        return <FinancialDashboard onLogout={handleLogout} />;
      case 'dashboard':
      default:
        return (
          <Dashboard
            onSelectList={handleSelectList}
            onViewAnalysis={() => handleNavigate('analysis')}
            onViewVendors={() => handleNavigate('vendors')}
            onViewItems={() => handleNavigate('items')}
            onViewSummary={() => handleNavigate('summary')}
            {...commonProps}
          />
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
          <div className="min-h-screen bg-background text-primary font-sans flex md:flex-row transition-all">
            <AppContent
              view={view}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              renderView={renderView}
            />
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
        onNavigate={onNavigate}
        onLogout={onLogout}
        pageActions={actions}
      />
      <main className={`flex-1 w-full animate-fade-in transition-all duration-300`}>
        <Suspense fallback={<LoadingSpinner size="lg" className="min-h-screen" text="در حال بارگذاری..." />}>
          {renderView()}
        </Suspense>
      </main>
    </>
  );
};

export default App;
