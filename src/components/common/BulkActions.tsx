import React from 'react';
import Button from './Button';

interface BulkActionsProps {
  selectedCount: number;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'success' | 'secondary';
    disabled?: boolean;
  }>;
  className?: string;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  actions = [],
  className = '',
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-lg shadow-lg z-30 border-t border-accent/50 animate-fade-in-up ${className}`}
      role="toolbar"
      aria-label="Bulk actions toolbar"
    >
      <div className="max-w-7xl mx-auto p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-bold text-primary text-lg" aria-live="polite">
            {selectedCount} مورد انتخاب شده
          </span>
          {onSelectAll && (
            <Button variant="ghost" size="sm" onClick={onSelectAll}>
              انتخاب همه
            </Button>
          )}
          {onDeselectAll && (
            <Button variant="ghost" size="sm" onClick={onDeselectAll}>
              لغو انتخاب
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions.map((action, idx) => (
            <Button
              key={idx}
              variant={action.variant || 'primary'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              icon={action.icon}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BulkActions;
