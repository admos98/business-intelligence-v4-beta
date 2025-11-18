import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  title,
  className = '',
  hover = false,
  onClick
}) => {
  const baseClasses = 'bg-surface p-4 sm:p-6 rounded-xl border border-border shadow-sm transition-all animate-fade-in';
  const hoverClasses = hover || onClick ? 'hover-lift cursor-pointer' : '';
  const clickableClasses = onClick ? 'focus-visible-ring' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${clickableClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {title && (
        <h3 className="font-bold text-md text-primary mb-4 animate-fade-in-down">
          {title}
        </h3>
      )}
      <div className="animate-fade-in-up">
        {children}
      </div>
    </div>
  );
};

export default Card;
