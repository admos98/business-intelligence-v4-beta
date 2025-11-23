import React, { useState, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import ThemeToggleButton from './ThemeToggleButton';
import { SafeSVG } from './SafeSVG';
import { logoSvg } from '../../assets/logo';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  backText?: string;
  hideMenu?: boolean; // Always true now - actions are in Navbar
}

// MenuIcon removed - no longer used (actions are in Navbar)

const Header: React.FC<HeaderProps> = ({ title, onBack, backText }) => {
  const [theme, toggleTheme] = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
        setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`bg-surface/95 backdrop-blur-xl sticky top-0 z-20 border-b border-border-strong transition-all duration-300 ${isScrolled ? 'shadow-lg shadow-black/5' : ''}`}>
      <div className="max-w-[1920px] mx-auto py-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* RIGHT Group (Logo & Title) */}
          <div className="flex items-center gap-3 min-w-0">
             <SafeSVG svgContent={logoSvg} className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" />
             <h1 className="text-base sm:text-lg font-bold text-primary tracking-tight text-right truncate">
                {title}
             </h1>
          </div>

          {/* LEFT Group (Back button & Theme toggle) */}
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-accent hover:bg-accent-soft rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 flex items-center gap-1"
              >
                <span>&larr;</span>
                <span className="hidden sm:inline">{backText}</span>
              </button>
            )}
            <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
