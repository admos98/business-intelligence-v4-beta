import React, { ReactNode, memo } from 'react';
import { t } from '../../../shared/translations';

/**
 * Props for the Button component
 */
interface ButtonProps {
  /** Button content */
  children: ReactNode;
  /** Click handler function */
  onClick?: () => void;
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Whether the button should take full width */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** HTML button type */
  type?: 'button' | 'submit' | 'reset';
  /** Optional icon to display before the content */
  icon?: ReactNode;
}

/**
 * Button component with multiple variants and states
 *
 * Supports multiple visual styles, sizes, and states including loading.
 * Includes proper accessibility attributes and keyboard navigation.
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick} loading={isLoading}>
 *   Click me
 * </Button>
 * ```
 */
const Button: React.FC<ButtonProps> = memo(({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  type = 'button',
  icon,
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all duration-200 focus-visible-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden';

  const variantClasses = {
    primary: 'bg-accent text-accent-text hover:bg-accent-hover hover:shadow-md hover:scale-[1.02] active:scale-[0.98] shadow-sm',
    secondary: 'bg-surface border border-border-strong text-primary hover:bg-border hover:border-border hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]',
    danger: 'bg-danger text-white hover:bg-danger/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] shadow-sm',
    success: 'bg-success text-white hover:bg-success/90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] shadow-sm',
    ghost: 'bg-transparent text-primary hover:bg-surface hover:border-border hover:border hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      aria-label={typeof children === 'string' ? children : undefined}
      aria-busy={loading}
      aria-disabled={disabled || loading}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{t.processing}</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  // Memo comparison: re-render only if props change
  return (
    prevProps.children === nextProps.children &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.variant === nextProps.variant &&
    prevProps.size === nextProps.size &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.loading === nextProps.loading &&
    prevProps.fullWidth === nextProps.fullWidth &&
    prevProps.className === nextProps.className &&
    prevProps.type === nextProps.type &&
    prevProps.icon === nextProps.icon
  );
});

Button.displayName = 'Button';

export default Button;
