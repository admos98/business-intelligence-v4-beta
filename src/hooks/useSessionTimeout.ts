// src/hooks/useSessionTimeout.ts
// Session timeout hook for auto-logout

import { useEffect, useRef, useCallback } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { useToast } from '../components/common/Toast';

/**
 * Options for configuring session timeout behavior
 */
interface UseSessionTimeoutOptions {
  /** Timeout duration in minutes (default: 30) */
  timeoutMinutes?: number;
  /** Warning time before timeout in minutes (default: 5) */
  warningMinutes?: number;
  /** Callback function to execute when timeout occurs */
  onTimeout?: () => void;
}

/**
 * Hook for managing session timeout with automatic logout
 *
 * Monitors user activity and automatically logs out the user after a period of inactivity.
 * Shows a warning toast before the timeout occurs.
 *
 * @param options - Configuration options for the session timeout
 * @returns An object with `resetTimeout` function and `lastActivity` timestamp
 *
 * @example
 * ```tsx
 * useSessionTimeout({
 *   timeoutMinutes: 30,
 *   warningMinutes: 5,
 *   onTimeout: () => {
 *     // Handle timeout
 *   }
 * });
 * ```
 */
export const useSessionTimeout = (options: UseSessionTimeoutOptions = {}) => {
  const { timeoutMinutes = 30, warningMinutes = 5, onTimeout } = options;
  const { logout, currentUser } = useShoppingStore();
  const { addToast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);

  const resetTimeout = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }
    warningShownRef.current = false;

    if (!currentUser) {
      return;
    }

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

    // Set warning timeout
    warningRef.current = setTimeout(() => {
      if (currentUser) {
        warningShownRef.current = true;
        addToast(
          `جلسه شما در ${warningMinutes} دقیقه دیگر منقضی می‌شود. برای ادامه کار کلیک کنید.`,
          'warning'
        );
      }
    }, warningMs);

    // Set logout timeout
    timeoutRef.current = setTimeout(() => {
      if (currentUser) {
        addToast('جلسه شما منقضی شد. لطفاً دوباره وارد شوید.', 'error');
        logout();
        if (onTimeout) {
          onTimeout();
        }
      }
    }, timeoutMs);

    lastActivityRef.current = Date.now();
  }, [timeoutMinutes, warningMinutes, currentUser, logout, addToast, onTimeout]);

  const handleActivity = useCallback(() => {
    // Reset timeout on any user activity
    if (currentUser) {
      resetTimeout();
    }
  }, [currentUser, resetTimeout]);

  useEffect(() => {
    if (!currentUser) {
      // Clear timeouts when logged out
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
      return;
    }

    // Set initial timeout
    resetTimeout();

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
    };
  }, [currentUser, resetTimeout, handleActivity]);

  return {
    resetTimeout: handleActivity,
    lastActivity: lastActivityRef.current,
  };
};
