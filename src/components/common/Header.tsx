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

const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

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
    <header className={`bg-surface/80 backdrop-blur-lg sticky top-0 z-20 border-b border-border transition-shadow duration-300 ${isScrolled ? 'shadow-header-scrolled' : ''}`}>
      <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* RIGHT Group (Logo & Title) */}
          <div className="flex items-center gap-3">
             <h1 className="text-lg font-bold text-primary tracking-tight text-right">
                {title}
             </h1>
             <SafeSVG svgContent={logoSvg} className="w-10 h-10" />
          </div>

          {/* LEFT Group (Back button & Theme toggle) */}
          <div className="flex items-center justify-end gap-2">
            {onBack && (
              <button onClick={onBack} className="text-accent hover:underline transition-colors text-sm font-medium">
                &larr; {backText}
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
