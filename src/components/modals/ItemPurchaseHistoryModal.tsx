import React, { useState, useEffect, useMemo } from 'react';
import { Unit } from '../../../shared/types';
import { useShoppingStore } from '../../store/useShoppingStore';
import CurrencyDisplay from '../common/CurrencyDisplay';
import { toJalaliDateString } from '../../../shared/jalali';
import Card from '../common/Card';

interface ItemPurchaseHistoryModalProps {
  itemName: string;
  itemUnit: Unit;
  onClose: () => void;
}

const ItemPurchaseHistoryModal: React.FC<ItemPurchaseHistoryModalProps> = ({ itemName, itemUnit, onClose }) => {
  const { getAllPurchasesForItem, getItemPriceHistory } = useShoppingStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const purchases = useMemo(() => getAllPurchasesForItem(itemName, itemUnit), [getAllPurchasesForItem, itemName, itemUnit]);
  const priceHistory = useMemo(() => getItemPriceHistory(itemName, itemUnit), [getItemPriceHistory, itemName, itemUnit]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  // Calculate inflation for each purchase
  const purchasesWithInflation = useMemo(() => {
    if (purchases.length < 2) return purchases.map(p => ({ ...p, inflation: null }));

    return purchases.map((purchase, index) => {
      if (index === 0) return { ...purchase, inflation: null };

      const previousPurchase = purchases[index - 1];
      const priceChange = purchase.pricePerUnit - previousPurchase.pricePerUnit;
      const inflationPercent = previousPurchase.pricePerUnit > 0
        ? ((priceChange / previousPurchase.pricePerUnit) * 100).toFixed(1)
        : '0';

      return {
        ...purchase,
        inflation: {
          percent: parseFloat(inflationPercent),
          isIncrease: priceChange > 0
        }
      };
    });
  }, [purchases]);

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-surface p-6 rounded-xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-primary">تاریخچه خرید: {itemName}</h2>
          <button onClick={handleClose} className="text-secondary hover:text-primary text-2xl leading-none">×</button>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto space-y-4">
          {purchases.length === 0 ? (
            <p className="text-center text-secondary py-8">هیچ خرید ثبت شده‌ای برای این کالا وجود ندارد</p>
          ) : (
            <>
              <Card title="خلاصه">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-secondary text-xs mb-1">تعداد خرید</p>
                    <p className="font-bold text-primary">{purchases.length}</p>
                  </div>
                  <div>
                    <p className="text-secondary text-xs mb-1">میانگین قیمت</p>
                    <CurrencyDisplay
                      value={purchases.reduce((sum, p) => sum + p.pricePerUnit, 0) / purchases.length}
                      className="font-bold text-primary"
                    />
                  </div>
                  <div>
                    <p className="text-secondary text-xs mb-1">آخرین قیمت</p>
                    <CurrencyDisplay
                      value={purchases[0]?.pricePerUnit || 0}
                      className="font-bold text-primary"
                    />
                  </div>
                  <div>
                    <p className="text-secondary text-xs mb-1">تغییر قیمت</p>
                    {priceHistory.length >= 2 && (
                      <p className={`font-bold ${purchasesWithInflation[0]?.inflation?.isIncrease ? 'text-danger' : 'text-success'}`}>
                        {purchasesWithInflation[0]?.inflation?.isIncrease ? '+' : ''}{purchasesWithInflation[0]?.inflation?.percent || 0}%
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              <Card title="لیست خریدها">
                <div className="space-y-2">
                  {purchasesWithInflation.map((purchase, index) => (
                    <div key={index} className="p-3 bg-background rounded-lg border border-border">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-primary">{toJalaliDateString(purchase.date.toISOString(), { format: 'long' })}</p>
                          {purchase.vendorName && (
                            <p className="text-sm text-secondary mt-1">از: {purchase.vendorName}</p>
                          )}
                        </div>
                        <div className="text-left">
                          <CurrencyDisplay value={purchase.totalPrice} className="font-bold text-accent text-lg" />
                          <p className="text-xs text-secondary mt-1">
                            {purchase.amount.toLocaleString('fa-IR')} {itemUnit} × <CurrencyDisplay value={purchase.pricePerUnit} className="text-xs" />
                          </p>
                        </div>
                      </div>
                      {purchase.inflation && (
                        <div className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                          purchase.inflation.isIncrease ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                        }`}>
                          {purchase.inflation.isIncrease ? '↑' : '↓'} {Math.abs(purchase.inflation.percent)}% تغییر نسبت به خرید قبلی
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end flex-shrink-0">
          <button onClick={handleClose} className="px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity">
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemPurchaseHistoryModal;
