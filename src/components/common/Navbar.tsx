import React, { useState, useEffect, useMemo } from 'react';
import { SafeSVG } from './SafeSVG';
import { logoSvg } from '../../assets/logo';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  pageActions?: React.ReactNode;
}

// Modern SVG Icons
const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

// Icon components for navigation items
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const AnalysisIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PackageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const StoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const ShoppingCartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const RecipeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const MoneyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const ScaleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);

const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ReceiptIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const UserGroupIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SearchDocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

// Icon mapping
const iconMap: Record<string, React.ComponentType> = {
  dashboard: DashboardIcon,
  analysis: AnalysisIcon,
  items: PackageIcon,
  vendors: StoreIcon,
  summary: ClipboardIcon,
  sell: ShoppingCartIcon,
  recipes: RecipeIcon,
  sellAnalysis: MoneyIcon,
  financial: BriefcaseIcon,
  chartOfAccounts: BookIcon,
  generalLedger: BookIcon,
  trialBalance: ScaleIcon,
  balanceSheet: DocumentIcon,
  incomeStatement: ReceiptIcon,
  cashFlow: ReceiptIcon,
  taxSettings: CogIcon,
  taxReports: SearchDocumentIcon,
  customers: UserGroupIcon,
  agingReports: CalendarIcon,
  auditLog: SearchDocumentIcon,
  dataValidation: SearchDocumentIcon,
  backupRestore: DatabaseIcon,
  userManagement: UserIcon,
};

interface NavItem {
  id: string;
  label: string;
  icon?: string;
  isSeparator?: boolean;
  group?: string;
}

const navItems: NavItem[] = [
  // Main
  { id: 'dashboard', label: 'خریدها', group: 'main' },
  { id: 'analysis', label: 'تحلیل خریدها', group: 'main' },
  { id: 'items', label: 'اقلام', group: 'main' },
  { id: 'vendors', label: 'تامین‌کنندگان', group: 'main' },
  { id: 'summary', label: 'خلاصه', group: 'main' },

  // Sales
  { id: 'sell', label: 'فروش (POS)', group: 'sales' },
  { id: 'recipes', label: 'دستورات', group: 'sales' },
  { id: 'sellAnalysis', label: 'تحلیل فروش', group: 'sales' },

  // Financial
  { id: 'financial', label: 'مالی', group: 'financial' },
  { id: 'separator1', label: 'حسابداری', isSeparator: true, group: 'accounting' },
  { id: 'chartOfAccounts', label: 'دفتر حساب‌ها', group: 'accounting' },
  { id: 'generalLedger', label: 'دفتر کل', group: 'accounting' },
  { id: 'trialBalance', label: 'تراز آزمایشی', group: 'accounting' },
  { id: 'separator2', label: 'صورت‌های مالی', isSeparator: true, group: 'statements' },
  { id: 'balanceSheet', label: 'ترازنامه', group: 'statements' },
  { id: 'incomeStatement', label: 'سود و زیان', group: 'statements' },
  { id: 'cashFlow', label: 'جریان وجوه نقد', group: 'statements' },

  // Tax
  { id: 'separator3', label: 'مالیات', isSeparator: true, group: 'tax' },
  { id: 'taxSettings', label: 'تنظیمات مالیات', group: 'tax' },
  { id: 'taxReports', label: 'گزارش‌های مالیاتی', group: 'tax' },

  // Receivables
  { id: 'separator4', label: 'دریافت/پرداخت', isSeparator: true, group: 'receivables' },
  { id: 'customers', label: 'مشتریان', group: 'receivables' },
  { id: 'agingReports', label: 'گزارش قدمت بدهی', group: 'receivables' },

  // System
  { id: 'separator5', label: 'سیستم', isSeparator: true, group: 'system' },
  { id: 'auditLog', label: 'گزارش لاگ', group: 'system' },
  { id: 'dataValidation', label: 'اعتبارسنجی داده', group: 'system' },
  { id: 'backupRestore', label: 'پشتیبان‌گیری', group: 'system' },
  { id: 'userManagement', label: 'مدیریت کاربران', group: 'system' },
];

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onLogout, pageActions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('navbar-collapsed');
    return saved === 'true';
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    localStorage.setItem('navbar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const handleNavClick = (viewId: string) => {
    if (viewId.startsWith('separator')) return;
    onNavigate(viewId);
    setIsOpen(false);
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const query = searchQuery.toLowerCase().trim();
    return navItems.filter(item =>
      item.label.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-72';

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 right-4 z-50 p-3 bg-surface border border-border rounded-xl hover:bg-border transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95"
        aria-label="Toggle menu"
      >
        {isOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 right-0 bg-surface border-l border-border-strong transition-all duration-300 ease-in-out z-40 ${sidebarWidth} ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        } flex flex-col shadow-elevated md:shadow-none`}
      >
        {/* Logo/Header Section */}
        <div className="p-5 border-b border-border flex items-center justify-between gap-3 bg-surface-elevated">
          {!isCollapsed && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <SafeSVG svgContent={logoSvg} className="w-8 h-8 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-primary truncate">مدیریت کافه</h1>
                <p className="text-xs text-secondary">هوشمند و تحلیلی</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <SafeSVG svgContent={logoSvg} className="w-8 h-8 mx-auto" />
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-border transition-all duration-200 text-secondary hover:text-primary active:scale-95 flex-shrink-0"
            title={isCollapsed ? 'باز کردن منو' : 'بستن منو'}
            aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {isCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </button>
        </div>

        {/* Search Bar (only when not collapsed) */}
        {!isCollapsed && (
          <div className="p-4 border-b border-border bg-surface-elevated">
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                placeholder="جستجو در منو..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-3 py-2 bg-background border border-border rounded-lg text-sm text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none">
                <SearchIcon />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 smooth-scroll">
          {filteredItems.map((item) => {
            if (item.isSeparator) {
              return (
                <div key={item.id} className="pt-4 pb-2">
                  {!isCollapsed && (
                    <div className="px-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                      {item.label}
                    </div>
                  )}
                  {isCollapsed && (
                    <div className="border-t border-border my-2" />
                  )}
                </div>
              );
            }

            const IconComponent = iconMap[item.id] || DashboardIcon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isCollapsed ? 'justify-center' : 'text-right'
                } ${
                  isActive
                    ? 'bg-accent text-accent-text shadow-md scale-[1.02]'
                    : 'text-primary hover:bg-border active:scale-[0.98]'
                }`}
                title={isCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-accent-text' : 'text-secondary group-hover:text-primary'}`}>
                  <IconComponent />
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium flex-1 truncate">
                    {item.label}
                  </span>
                )}
                {isActive && !isCollapsed && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-text flex-shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Page-specific actions */}
        {pageActions && !isCollapsed && (
          <div className="p-4 border-t border-border bg-surface-elevated space-y-2">
            {pageActions}
          </div>
        )}

        {/* Logout button */}
        <div className="p-3 border-t border-border-strong bg-surface-elevated">
          <button
            onClick={() => {
              onLogout();
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 active:scale-[0.98] transition-all duration-200 text-sm font-medium ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={isCollapsed ? 'خروج' : undefined}
          >
            <LogoutIcon />
            {!isCollapsed && <span>خروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
