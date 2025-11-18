import React from 'react';

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
  variant?: 'text' | 'card' | 'list' | 'table';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 3,
  className = '',
  variant = 'text'
}) => {
  if (variant === 'card') {
    return (
      <div className={`bg-surface border border-border rounded-lg p-4 animate-pulse ${className}`}>
        <div className="h-6 bg-background rounded w-3/4 mb-3 skeleton"></div>
        <div className="h-4 bg-background rounded w-full mb-2 skeleton"></div>
        <div className="h-4 bg-background rounded w-5/6 skeleton"></div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-12 w-12 bg-background rounded skeleton"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-background rounded w-3/4 skeleton"></div>
              <div className="h-3 bg-background rounded w-1/2 skeleton"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="h-4 bg-background rounded flex-1 skeleton"></div>
            <div className="h-4 bg-background rounded w-24 skeleton"></div>
            <div className="h-4 bg-background rounded w-32 skeleton"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-background rounded skeleton ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;
