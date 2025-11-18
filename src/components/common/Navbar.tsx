import React, { useState, useEffect } from 'react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  pageActions?: React.ReactNode; // Page-specific actions (export, print, etc.)
}

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

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const navItems = [
  { id: 'dashboard', label: 'خریدها', icon: '📊' },
  { id: 'analysis', label: 'تحلیل خریدها', icon: '📈' },
  { id: 'items', label: 'اقلام', icon: '📦' },
  { id: 'vendors', label: 'تامین‌کنندگان', icon: '🏪' },
  { id: 'summary', label: 'خلاصه', icon: '📋' },
  { id: 'sell', label: 'فروش (POS)', icon: '🛒' },
  { id: 'recipes', label: 'دستورات', icon: '🍳' },
  { id: 'sellAnalysis', label: 'تحلیل فروش', icon: '💰' },
  { id: 'financial', label: 'مالی', icon: '💼' },
];

const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onLogout, pageActions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('navbar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('navbar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const handleNavClick = (viewId: string) => {
    onNavigate(viewId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <div className="md:hidden fixed top-0 right-0 z-50 p-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-surface border border-border rounded-lg hover:bg-border transition-colors shadow-lg"
        >
          {isOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Sidebar - visible on desktop, toggleable on mobile */}
      <aside
        className={`fixed md:static inset-y-0 right-0 bg-surface border-l border-border transition-all duration-300 z-40 ${
          isCollapsed ? 'w-16' : 'w-64'
        } ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        } overflow-y-auto shadow-lg`}
      >
        <nav className="flex flex-col h-full">
          {/* Logo/Title section with toggle button */}
          <div className="p-4 border-b border-border flex items-center justify-between gap-2">
            {!isCollapsed && (
              <div className="flex-1">
                <h1 className="text-lg font-bold text-primary">مدیریت کافه</h1>
                <p className="text-xs text-secondary mt-1">هوشمند و تحلیلی</p>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-border transition-colors text-secondary hover:text-primary"
              title={isCollapsed ? 'باز کردن منو' : 'بستن منو'}
            >
              {isCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </button>
          </div>

          {/* Navigation items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isCollapsed ? 'justify-center' : 'text-right'
                } ${
                  currentView === item.id
                    ? 'bg-accent text-accent-text font-semibold'
                    : 'text-primary hover:bg-border'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!isCollapsed && <span className="text-sm">{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Page-specific actions */}
          {pageActions && !isCollapsed && (
            <div className="p-4 border-t border-border">
              <div className="space-y-2">
                {pageActions}
              </div>
            </div>
          )}

          {/* Logout button */}
          <div className="p-4 border-t border-border">
            <button
              onClick={() => {
                onLogout();
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors text-sm font-medium ${
                isCollapsed ? 'justify-center' : ''
              }`}
              title={isCollapsed ? 'خروج' : undefined}
            >
              <LogoutIcon />
              {!isCollapsed && <span>خروج</span>}
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;
