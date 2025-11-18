import React, { memo } from 'react';
import { ShoppingItem } from '../../../shared/types';
import CurrencyDisplay from './CurrencyDisplay';
import Button from './Button';

interface PendingItemRowProps {
  item: ShoppingItem;
  isSelected: boolean;
  onSelect: () => void;
  onBuy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

const PendingItemRow: React.FC<PendingItemRowProps> = memo(({
  item,
  isSelected,
  onSelect,
  onBuy,
  onEdit,
  onDelete
}) => {
  return (
    <li
      className={`p-3 rounded-lg transition-all duration-300 flex items-center gap-4 group animate-fade-in hover-lift ${
        isSelected
          ? 'bg-accent/10 border-2 border-accent shadow-md'
          : 'bg-surface border border-transparent hover:border-accent/50'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        className="form-checkbox h-5 w-5 rounded bg-background border-border text-accent focus:ring-accent flex-shrink-0 cursor-pointer"
      />
      <div className="flex-grow flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex-1 min-w-0">
          <span className="font-medium text-primary block truncate">
            {item.name} - {item.amount} {item.unit}
          </span>
          <div className="flex items-center gap-2 mt-1">
            {item.estimatedPrice && (
              <CurrencyDisplay
                value={item.estimatedPrice}
                className="text-xs text-secondary/80"
              />
            )}
            <span className="text-xs text-secondary">{item.category}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={onBuy}
            className="animate-scale-in"
          >
            خرید
          </Button>
          <button
            onClick={onEdit}
            title="ویرایش"
            className="p-1.5 text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent/10 rounded"
            aria-label="ویرایش"
          >
            <EditIcon/>
          </button>
          <button
            onClick={onDelete}
            title="حذف"
            className="p-1.5 text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/10 rounded"
            aria-label="حذف"
          >
            <DeleteIcon/>
          </button>
        </div>
      </div>
    </li>
  );
});

PendingItemRow.displayName = 'PendingItemRow';

export default PendingItemRow;
