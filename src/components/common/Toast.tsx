import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, memo } from 'react';

/** Types of toast messages */
type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Represents a toast message
 */
interface ToastMessage {
  /** Unique identifier for the toast */
  id: number;
  /** The message to display */
  message: string;
  /** The type of toast */
  type: ToastType;
}

/**
 * Context type for toast functionality
 */
interface ToastContextType {
  /**
   * Add a new toast message
   * @param message - The message to display
   * @param type - The type of toast (success, error, info, warning)
   */
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Hook to access toast functionality
 *
 * @returns The toast context with `addToast` function
 * @throws Error if used outside of ToastProvider
 *
 * @example
 * ```tsx
 * const { addToast } = useToast();
 * addToast('Operation successful', 'success');
 * ```
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Individual toast component
 *
 * Automatically dismisses after 3 seconds or can be manually closed.
 *
 * @param toast - The toast message to display
 * @param onRemove - Callback function to remove the toast
 */
const Toast: React.FC<{ toast: ToastMessage; onRemove: (id: number) => void }> = memo(({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, 3000);

        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    const toastColors: Record<ToastType, string> = {
        success: 'bg-success text-success-soft',
        error: 'bg-danger text-danger-soft',
        info: 'bg-secondary text-primary',
        warning: 'bg-warning text-warning-text',
    };

    return (
        <div
          className={`p-4 rounded-lg shadow-lg flex items-center justify-between text-sm font-medium transition-all duration-300 ${toastColors[toast.type]} ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => { setIsExiting(true); setTimeout(() => onRemove(toast.id), 300); }}
            className="ml-4 text-xl leading-none"
            aria-label="Close toast"
          >&times;</button>
        </div>
    );
}, (prevProps, nextProps) => {
  // Memo comparison: only re-render if toast data changes
  return prevProps.toast.id === nextProps.toast.id &&
         prevProps.toast.message === nextProps.toast.message &&
         prevProps.toast.type === nextProps.toast.type;
});

Toast.displayName = 'Toast';

/**
 * ToastProvider component that manages toast notifications
 *
 * Provides toast functionality to all child components through context.
 * All toasts are displayed in a fixed position at the bottom-right of the screen.
 *
 * @param children - Child components that can use the useToast hook
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 space-y-3 w-72">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
      </div>
    </ToastContext.Provider>
  );
};
