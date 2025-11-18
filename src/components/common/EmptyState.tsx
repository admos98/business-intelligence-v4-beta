import React from 'react';
import Button from './Button';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`text-center py-16 px-6 animate-fade-in ${className}`}>
      {icon && (
        <div className="mb-4 flex justify-center animate-scale-in">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-primary mb-2 animate-fade-in-down">
        {title}
      </h3>
      <p className="text-secondary mb-6 max-w-md mx-auto animate-fade-in-up">
        {message}
      </p>
      {action && (
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <Button variant="primary" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
