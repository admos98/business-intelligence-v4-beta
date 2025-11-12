// FILE: src/hooks/useTheme.ts

import { useState, useEffect, useCallback } from 'react';
import { logoSvg } from '../assets/logo'; // Assuming this path is correct

type Theme = 'light' | 'dark';

export const useTheme = (): [Theme, () => void] => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Your initial state logic is good and concise.
    return (localStorage.getItem('theme') as Theme | null) ||
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const updateFavicon = useCallback((currentTheme: Theme) => {
    // Your favicon logic is clever and will continue to work. No changes needed here.
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    if (favicon) {
      const isDark = currentTheme === 'dark';
      const bg = isDark ? '#778DA9' : '#263238';
      const fg = isDark ? '#0D1B2A' : '#FFFFFF';
      const themedSvg = logoSvg.replace('var(--logo-bg)', bg).replace('var(--logo-fg)', fg);
      const svgBlob = new Blob([themedSvg], { type: 'image/svg+xml' });
      const oldUrl = favicon.href;
      favicon.href = URL.createObjectURL(svgBlob);
      if (oldUrl && oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // THE KEY FIX: Use classList to add/remove classes safely.
    if (theme === 'dark') {
      root.classList.remove('theme-light');
      root.classList.add('theme-dark');
    } else {
      root.classList.remove('theme-dark');
      root.classList.add('theme-light');
    }
    // This is a much more robust way to manage the classes.

    localStorage.setItem('theme', theme);
    setTimeout(() => updateFavicon(theme), 50);
  }, [theme, updateFavicon]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  return [theme, toggleTheme];
};
