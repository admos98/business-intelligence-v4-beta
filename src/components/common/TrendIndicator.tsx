import React from 'react';

interface TrendIndicatorProps {
  current: number;
  previous: number;
  format?: 'currency' | 'number' | 'percent';
  showArrow?: boolean;
  className?: string;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  current,
  previous,
  format = 'number',
  showArrow = true,
  className = '',
}) => {
  if (previous === 0) return null;

  const change = current - previous;
  const percentChange = (change / previous) * 100;
  const isPositive = change >= 0;

  const formatValue = (val: number) => {
    switch (format) {
      case 'currency':
        return `${Math.abs(val).toLocaleString('fa-IR')} تومان`;
      case 'percent':
        return `${Math.abs(percentChange).toFixed(1)}%`;
      default:
        return Math.abs(val).toLocaleString('fa-IR');
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showArrow && (
        <span className={isPositive ? 'text-success' : 'text-danger'}>
          {isPositive ? '↑' : '↓'}
        </span>
      )}
      <span className={isPositive ? 'text-success' : 'text-danger'}>
        {formatValue(change)}
      </span>
      {format !== 'percent' && (
        <span className="text-xs text-secondary">
          ({percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%)
        </span>
      )}
    </div>
  );
};

export default TrendIndicator;
