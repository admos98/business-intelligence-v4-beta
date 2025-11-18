import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
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
};

export default LoadingSpinner;
