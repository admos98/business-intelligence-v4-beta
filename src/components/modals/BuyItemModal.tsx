import React, { useState, useMemo, useEffect } from 'react';
// FIX: Add .ts extension to fix module import errors
import { ShoppingItem, PaymentMethod, PaymentStatus } from '../../../shared/types.ts';
import { t } from '../../../shared/translations.ts';
import CurrencyDisplay from '../common/CurrencyDisplay';
// FIX: Add .ts extension to fix module import errors
import { useShoppingStore } from '../../store/useShoppingStore.ts';


interface BuyItemModalProps {
  item: ShoppingItem;
  onClose: () => void;
  onConfirm: (
    itemId: string, purchasedAmount: number, totalPrice: number,
    vendorName?: string, paymentMethod?: PaymentMethod, paymentStatus?: PaymentStatus
  ) => void;
}

const BuyItemModal: React.FC<BuyItemModalProps> = ({ item, onClose, onConfirm }) => {
  const { vendors, categoryVendorMap, getLatestPurchaseInfo } = useShoppingStore();
  const [isOpen, setIsOpen] = useState(false);
  const [purchasedAmount, setPurchasedAmount] = useState<number | ''>(item.amount);
  const [pricePerUnit, setPricePerUnit] = useState<number | ''>('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Card);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.Paid);

  useEffect(() => {
    setIsOpen(true);
    const latestInfo = getLatestPurchaseInfo(item.name, item.unit);

    if (latestInfo.pricePerUnit) {
        setPricePerUnit(latestInfo.pricePerUnit);
    }

    if (latestInfo.vendorId) {
        const latestVendor = vendors.find(v => v.id === latestInfo.vendorId);
        if (latestVendor) {
            setVendor(latestVendor.name);
            return; // Prioritize item-specific vendor
        }
    }

    // Fallback to category-based vendor
    const suggestedVendorId = categoryVendorMap[item.category];
    if (suggestedVendorId) {
        const suggestedVendor = vendors.find(v => v.id === suggestedVendorId);
        if (suggestedVendor) {
            setVendor(suggestedVendor.name);
        }
    }
  }, [item, getLatestPurchaseInfo, vendors, categoryVendorMap]);


  const totalPrice = useMemo(() => (Number(purchasedAmount) || 0) * (Number(pricePerUnit) || 0), [purchasedAmount, pricePerUnit]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchasedAmount !== '' && Number(purchasedAmount) > 0 && pricePerUnit !== '' && Number(pricePerUnit) >= 0) {
      onConfirm(item.id, Number(purchasedAmount), totalPrice, vendor, paymentMethod, paymentStatus);
      handleClose();
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-surface p-6 rounded-xl border border-border w-full max-w-md transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
        <h2 className="text-xl font-bold text-primary mb-2">{t.confirmPurchaseTitle}</h2>
        <p className="text-md text-secondary mb-6">{item.name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t.quantityPurchased} ({item.unit})</label>
                <input
                  type="number"
                  value={purchasedAmount}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseFloat(e.target.value);
                    if (value === '' || (typeof value === 'number' && value > 0 && value <= 10000)) {
                      setPurchasedAmount(value);
                    }
                  }}
                  min="0.01"
                  max="10000"
                  step="0.01"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                  required
                />
                {typeof purchasedAmount === 'number' && purchasedAmount > 10000 && (
                  <p className="text-xs text-danger mt-1">مقدار نمی‌تواند بیشتر از ۱۰۰۰۰ باشد</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t.pricePerUnitLabel}</label>
                <input
                  type="number"
                  value={pricePerUnit}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseFloat(e.target.value);
                    if (value === '' || (typeof value === 'number' && value >= 0 && value <= 10000000)) {
                      setPricePerUnit(value);
                    }
                  }}
                  min="0"
                  max="10000000"
                  step="1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
                {typeof pricePerUnit === 'number' && pricePerUnit > 10000000 && (
                  <p className="text-xs text-danger mt-1">قیمت نمی‌تواند بیشتر از ۱۰ میلیون ریال باشد</p>
                )}
              </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t.vendor}</label>
                <input type="text" list="vendors" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={t.vendorPlaceholder} className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"/>
                 <datalist id="vendors">
                    {vendors.map(v => <option key={v.id} value={v.name} />)}
                 </datalist>
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t.paymentMethod}</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent">
                  {/* FIX: Add explicit type to map callback to resolve key error */}
                  {Object.values(PaymentMethod).map((method: string) => <option key={method} value={method}>{method}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t.paymentStatus}</label>
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)} className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent">
                  {/* FIX: Add explicit type to map callback to resolve key error */}
                  {Object.values(PaymentStatus).map((status: string) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-background p-3 rounded-lg text-center">
              <span className="text-sm text-secondary">{t.calculatedTotal}: </span>
              <CurrencyDisplay value={totalPrice} className="font-bold text-lg text-accent" />
            </div>

          <div className="mt-6 flex justify-end gap-3">
             <button type="button" onClick={handleClose} className="px-4 py-2 bg-border text-primary font-medium rounded-lg hover:bg-border/70 transition-colors">{t.cancel}</button>
            <button type="submit" className="px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity">{t.confirm}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BuyItemModal;
