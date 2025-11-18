import React from 'react';
import CurrencyDisplay from './CurrencyDisplay';
import Card from './Card';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'accent' | 'default';
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = 'default',
  className = '',
}) => {
  const variantClasses = {
    primary: 'border-primary/20 bg-primary/5',
    success: 'border-success/20 bg-success/5',
    danger: 'border-danger/20 bg-danger/5',
    accent: 'border-accent/20 bg-accent/5',
    default: 'border-border bg-surface',
  };

  const trendColors = {
    up: 'text-success',
    down: 'text-danger',
    neutral: 'text-secondary',
  };

  return (
    <Card className={`${variantClasses[variant]} ${className} hover-lift animate-fade-in`} hover>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-secondary mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            {typeof value === 'number' ? (
              <CurrencyDisplay value={value} className="text-2xl font-bold text-primary" />
            ) : (
              <span className="text-2xl font-bold text-primary">{value}</span>
            )}
            {trend && trendValue && (
              <span className={`text-xs font-medium ${trendColors[trend]}`}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-secondary mt-1 animate-fade-in-up">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-accent animate-scale-in">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
