import React, { memo } from 'react';

/**
 * Props for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Optional text to display below the spinner */
  text?: string;
}

/**
 * LoadingSpinner component for displaying loading states
 *
 * Displays an animated spinner with optional text below it.
 * Includes proper ARIA labels for accessibility.
 *
 * @example
 * ```tsx
 * <LoadingSpinner size="lg" text="در حال بارگذاری..." />
 * ```
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(({
  size = 'md',
  className = '',
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-4 border-accent/20 border-t-accent rounded-full animate-spin`}
        role="status"
        aria-label="در حال بارگذاری"
      />
      {text && (
        <p className="text-sm text-secondary animate-pulse">{text}</p>
      )}
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
