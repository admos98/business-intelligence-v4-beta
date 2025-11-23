import React, { memo, useCallback } from 'react';

/**
 * Props for the Card component
 */
interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Optional title displayed at the top */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show hover effect */
  hover?: boolean;
  /** Click handler (makes card clickable) */
  onClick?: () => void;
  /** Action buttons or elements to display in the header */
  actions?: React.ReactNode;
}

/**
 * Card component for displaying content in a contained box
 *
 * Provides a consistent card layout with optional title, actions, and hover effects.
 * Supports clickable cards with proper keyboard navigation and ARIA attributes.
 *
 * @example
 * ```tsx
 * <Card title="My Card" actions={<Button>Action</Button>}>
 *   Card content here
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = memo(({
  children,
  title,
  className = '',
  hover = false,
  onClick,
  actions
}) => {
  const baseClasses = 'bg-surface p-5 sm:p-6 rounded-xl border border-border shadow-subtle transition-all duration-200 animate-fade-in';
  const hoverClasses = hover || onClick ? 'hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer' : '';
  const clickableClasses = onClick ? 'focus-visible-ring' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick && title ? title : undefined}
      onKeyDown={onClick ? useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }, [onClick]) : undefined}
    >
      {title && (
        <div className="flex justify-between items-center mb-4 animate-fade-in-down">
          <h3 className="font-bold text-md text-primary">
            {title}
          </h3>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="animate-fade-in-up">
        {children}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Memo comparison: re-render only if props change
  return (
    prevProps.children === nextProps.children &&
    prevProps.title === nextProps.title &&
    prevProps.className === nextProps.className &&
    prevProps.hover === nextProps.hover &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.actions === nextProps.actions
  );
});

Card.displayName = 'Card';

export default Card;
