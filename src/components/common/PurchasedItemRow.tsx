import React, { memo } from 'react';
import { ShoppingItem, PaymentStatus } from '../../../shared/types';
import CurrencyDisplay from './CurrencyDisplay';
import Button from './Button';

interface PurchasedItemRowProps {
  item: ShoppingItem;
  vendorName?: string;
  onMarkAsPaid?: () => void;
  onEdit: () => void;
  onMoveToPending: () => void;
}

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l4-4m-4 4l4 4" /></svg>;

const PurchasedItemRow: React.FC<PurchasedItemRowProps> = memo(({
  item,
  vendorName,
  onMarkAsPaid,
  onEdit,
  onMoveToPending
}) => {
  return (
    <li className="bg-surface/70 p-4 rounded-lg border border-border/50 hover-lift animate-fade-in transition-all">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-md text-primary truncate">{item.name}</p>
          <p className="text-sm text-secondary">{item.purchasedAmount ?? item.amount} {item.unit}</p>
          {vendorName && (
            <p className="text-xs text-secondary mt-1 animate-fade-in-up">
              از: {vendorName}
            </p>
          )}
        </div>
        <div className="flex-1 text-left sm:text-center">
          <CurrencyDisplay
            value={item.paidPrice || 0}
            className="font-semibold text-accent text-md"
          />
          <div className="flex items-center gap-2 mt-1 flex-wrap justify-start sm:justify-center">
            {item.paymentStatus && (
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full animate-scale-in ${
                  item.paymentStatus === PaymentStatus.Paid
                    ? 'bg-success-soft text-success'
                    : 'bg-danger-soft text-danger'
                }`}
              >
                {item.paymentStatus}
              </span>
            )}
            {item.paymentMethod && (
              <span className="text-xs text-secondary bg-background px-2 py-1 rounded-full">
                {item.paymentMethod}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end w-full sm:w-auto">
          {onMarkAsPaid && (
            <Button
              variant="success"
              size="sm"
              onClick={onMarkAsPaid}
              className="animate-fade-in"
            >
              پرداخت شد
            </Button>
          )}
          <button
            onClick={onEdit}
            title="ویرایش"
            className="p-1.5 text-secondary hover:text-primary hover:bg-accent/10 rounded transition-colors"
            aria-label="ویرایش"
          >
            <EditIcon />
          </button>
          <button
            onClick={onMoveToPending}
            title="بازگشت به لیست خرید"
            className="p-1.5 text-secondary hover:text-primary hover:bg-accent/10 rounded transition-colors"
            aria-label="بازگشت به لیست خرید"
          >
            <UndoIcon />
          </button>
        </div>
      </div>
    </li>
  );
});

PurchasedItemRow.displayName = 'PurchasedItemRow';

export default PurchasedItemRow;
