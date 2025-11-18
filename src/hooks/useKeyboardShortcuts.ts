import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const matchesKey = shortcut.key === e.key || shortcut.key.toLowerCase() === e.key.toLowerCase();
        const matchesCtrl = shortcut.ctrlKey === undefined ? true : shortcut.ctrlKey === e.ctrlKey;
        const matchesAlt = shortcut.altKey === undefined ? true : shortcut.altKey === e.altKey;
        const matchesShift = shortcut.shiftKey === undefined ? true : shortcut.shiftKey === e.shiftKey;

        // Don't trigger if user is typing in an input
        const isInputFocused =
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable;

        if (matchesKey && matchesCtrl && matchesAlt && matchesShift && !isInputFocused) {
          e.preventDefault();
          shortcut.handler(e);
        }
      });
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}
