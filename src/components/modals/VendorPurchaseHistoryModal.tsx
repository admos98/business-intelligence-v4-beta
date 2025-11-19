import React, { useState, useEffect, useMemo } from 'react';
import { Vendor } from '../../../shared/types';
import { useShoppingStore } from '../../store/useShoppingStore';
import CurrencyDisplay from '../common/CurrencyDisplay';
import { toJalaliDateString } from '../../../shared/jalali';
import Card from '../common/Card';

interface VendorPurchaseHistoryModalProps {
  vendor: Vendor;
  onClose: () => void;
}

const VendorPurchaseHistoryModal: React.FC<VendorPurchaseHistoryModalProps> = ({ vendor, onClose }) => {
  const { getAllPurchasesForVendor } = useShoppingStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(true);
  }, []);

  const purchases = useMemo(() => getAllPurchasesForVendor(vendor.id), [getAllPurchasesForVendor, vendor.id]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  // Group purchases by item
  const purchasesByItem = useMemo(() => {
    const grouped = new Map<string, typeof purchases>();
    purchases.forEach(p => {
      const key = `${p.itemName}-${p.itemUnit}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(p);
    });
    return grouped;
  }, [purchases]);

  const totalSpent = purchases.reduce((sum, p) => sum + p.totalPrice, 0);
  const avgPricePerPurchase = purchases.length > 0 ? totalSpent / purchases.length : 0;

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-surface p-6 rounded-xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold text-primary">تاریخچه خرید از: {vendor.name}</h2>
          <button onClick={handleClose} className="text-secondary hover:text-primary text-2xl leading-none">×</button>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto space-y-4">
          {purchases.length === 0 ? (
            <p className="text-center text-secondary py-8">هیچ خریدی از این فروشنده ثبت نشده است</p>
          ) : (
            <>
              <Card title="خلاصه">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-secondary text-xs mb-1">تعداد خرید</p>
                    <p className="font-bold text-primary">{purchases.length}</p>
                  </div>
                  <div>
                    <p className="text-secondary text-xs mb-1">مجموع هزینه</p>
                    <CurrencyDisplay value={totalSpent} className="font-bold text-accent" />
                  </div>
                  <div>
                    <p className="text-secondary text-xs mb-1">میانگین هر خرید</p>
                    <CurrencyDisplay value={avgPricePerPurchase} className="font-bold text-primary" />
                  </div>
                  <div>
                    <p className="text-secondary text-xs mb-1">تعداد کالاهای مختلف</p>
                    <p className="font-bold text-primary">{purchasesByItem.size}</p>
                  </div>
                </div>
              </Card>

              <Card title="خریدها بر اساس کالا">
                <div className="space-y-4">
                  {Array.from(purchasesByItem.entries()).map(([itemKey, itemPurchases]) => {
                    const itemName = itemPurchases[0].itemName;
                    const itemUnit = itemPurchases[0].itemUnit;
                    const itemTotal = itemPurchases.reduce((sum, p) => sum + p.totalPrice, 0);
                    const itemAvgPrice = itemPurchases.reduce((sum, p) => sum + p.pricePerUnit, 0) / itemPurchases.length;

                    return (
                      <div key={itemKey} className="p-4 bg-background rounded-lg border border-border">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-primary">{itemName}</p>
                            <p className="text-sm text-secondary mt-1">{itemUnit}</p>
                          </div>
                          <div className="text-left">
                            <CurrencyDisplay value={itemTotal} className="font-bold text-accent" />
                            <p className="text-xs text-secondary mt-1">
                              {itemPurchases.length} خرید • میانگین: <CurrencyDisplay value={itemAvgPrice} className="text-xs" />
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2 mt-3 pt-3 border-t border-border">
                          {itemPurchases.map((purchase, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <span className="text-secondary">{toJalaliDateString(purchase.date.toISOString())}</span>
                              <div className="text-left">
                                <CurrencyDisplay value={purchase.totalPrice} className="font-semibold" />
                                <span className="text-xs text-secondary mr-2">
                                  ({purchase.amount.toLocaleString('fa-IR')} {itemUnit} × <CurrencyDisplay value={purchase.pricePerUnit} className="text-xs" />)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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

export default VendorPurchaseHistoryModal;
