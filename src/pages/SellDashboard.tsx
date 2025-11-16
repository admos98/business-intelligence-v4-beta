import React, { useState, useMemo } from 'react';
import { POSItem, SellTransaction, SellTransactionItem, PaymentMethod, Unit } from '../../shared/types';
import Header from '../components/common/Header';
import { useShoppingStore } from '../store/useShoppingStore';

import { useToast } from '../components/common/Toast';
import { toJalaliDateString } from '../../shared/jalali';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';

interface SellDashboardProps {
  onLogout: () => void;
  onViewSellAnalysis: () => void;
}

const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;

const SellDashboard: React.FC<SellDashboardProps> = ({ onLogout, onViewSellAnalysis }) => {
  const store = useShoppingStore();
  const { posItems, getPOSItemsByCategory, getFrequentPOSItems, addSellTransaction, addPOSItem } = store;
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<Map<string, { posItemId: string; name: string; quantity: number; unitPrice: number; customizations: Record<string, string | number> }>>(new Map());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', category: '', sellPrice: 0 });
  const { addToast } = useToast();

  // Get POS categories
  const posCategories = useMemo(() => {
    const cats = new Set<string>();
    posItems.forEach(item => cats.add(item.category));
    return Array.from(cats).sort();
  }, [posItems]);

  // Set initial category
  React.useEffect(() => {
    if (!selectedCategory && posCategories.length > 0) {
      setSelectedCategory(posCategories[0]);
    }
  }, [posCategories, selectedCategory]);

  const currentCategoryItems = selectedCategory ? getPOSItemsByCategory(selectedCategory) : [];
  const frequentItems = getFrequentPOSItems(6);

  const cartArray = Array.from(cart.values());
  const cartTotal = cartArray.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  const handleAddToCart = (posItem: POSItem) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(posItem.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        newCart.set(posItem.id, {
          posItemId: posItem.id,
          name: posItem.name,
          quantity: 1,
          unitPrice: posItem.sellPrice,
          customizations: {},
        });
      }
      return newCart;
    });
  };

  const handleUpdateCartQuantity = (posItemId: string, quantity: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      if (quantity <= 0) {
        newCart.delete(posItemId);
      } else {
        const item = newCart.get(posItemId);
        if (item) {
          item.quantity = quantity;
        }
      }
      return newCart;
    });
  };

  const handleRemoveFromCart = (posItemId: string) => {
    setCart(prev => {
      const newCart = new Map(prev);
      newCart.delete(posItemId);
      return newCart;
    });
  };

  const handleCompleteSale = () => {
    if (cartArray.length === 0) {
      addToast('سبد خرید خالی است', 'error');
      return;
    }

    const items: SellTransactionItem[] = cartArray.map(cartItem => ({
      id: `item-${Date.now()}-${Math.random()}`,
      posItemId: cartItem.posItemId,
      name: cartItem.name,
      quantity: cartItem.quantity,
      unitPrice: cartItem.unitPrice,
      totalPrice: cartItem.quantity * cartItem.unitPrice,
      customizationChoices: cartItem.customizations,
    }));

    const transaction: Omit<SellTransaction, 'id' | 'date'> = {
      items,
      totalAmount: finalTotal,
      paymentMethod,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
    };

    addSellTransaction(transaction);
    setCart(new Map());
    setDiscountAmount(0);
    addToast('فروش ثبت شد', 'success');
  };

  const handleAddNewPOSItem = () => {
    if (!newItemForm.name || !newItemForm.category || newItemForm.sellPrice <= 0) {
      addToast('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    addPOSItem({
      name: newItemForm.name,
      category: newItemForm.category,
      sellPrice: newItemForm.sellPrice,
      unit: Unit.Piece,
    });

    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setShowNewItemForm(false);
    addToast('کالای جدید اضافه شد', 'success');
  };

  const handlePrintCart = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('دسترسی به چاپ رد شد', 'error');
      return;
    }

    const itemsHtml = cartArray.map(item => `
      <tr>
        <td style="padding: 0.5rem; border: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${item.unitPrice.toLocaleString()}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${(item.quantity * item.unitPrice).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>رسید فروش</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; margin: 1rem; }
          h1 { text-align: center; color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
          th { background-color: #f0f0f0; padding: 0.5rem; border: 1px solid #ddd; text-align: right; }
          .total { font-size: 1.2rem; font-weight: bold; text-align: left; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <h1>رسید فروش کافه</h1>
        <p style="text-align: center;">تاریخ: ${new Date().toLocaleDateString('fa-IR')}</p>
        <table>
          <thead>
            <tr>
              <th>نام کالا</th>
              <th>تعداد</th>
              <th>قیمت واحد</th>
              <th>مجموع</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="total">
          مجموع کل: ${finalTotal.toLocaleString()} تومان
          ${discountAmount > 0 ? `<br>تخفیف: ${discountAmount.toLocaleString()} تومان` : ''}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportTransactionsJson = () => {
    const transactions = store.sellTransactions || [];
    const dataString = JSON.stringify(transactions, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sell_transactions_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('فروش‌ها با موفقیت صادر شدند', 'success');
  };

  const handleExportTransactionsCsv = () => {
    const transactions = store.sellTransactions || [];
    if (transactions.length === 0) {
      addToast('فروش برای صادر کردن وجود ندارد', 'info');
      return;
    }
    const headers = ['id', 'date', 'totalAmount', 'paymentMethod', 'discountAmount', 'itemsCount', 'items'];
    const rows = transactions.map(t => {
      const itemsStr = t.items.map(i => `${i.name} x${i.quantity} @${i.unitPrice}`).join(' | ');
      return [t.id, new Date(t.date).toISOString(), String(t.totalAmount), String(t.paymentMethod), String(t.discountAmount || ''), String(t.items.length), `"${itemsStr}"`];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sell_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV فروش‌ها صادر شد', 'success');
  };

  return (
    <>
      <Header title="فروش و سفارش (POS)" onLogout={onLogout}>
        <button onClick={handleExportTransactionsCsv} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر کردن CSV
        </button>
        <button onClick={handleExportTransactionsJson} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر کردن JSON
        </button>
        <button onClick={handlePrintCart} className="px-3 py-1.5 text-sm bg-primary text-background font-medium rounded-lg hover:opacity-90 transition-opacity">
          چاپ سبد
        </button>
        <button
          onClick={onViewSellAnalysis}
          className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border shadow-subtle"
        >
          تحلیل فروش
        </button>
      </Header>

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-screen">
        {/* LEFT: CATEGORIES & ITEMS */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="دسته‌بندی‌ها">
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {posCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full px-4 py-2 rounded-lg text-left font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-accent text-accent-text'
                      : 'bg-surface border border-border text-primary hover:bg-border'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setShowNewItemForm(!showNewItemForm)}
                className="w-full px-4 py-2 rounded-lg text-left font-medium bg-success/10 text-success hover:bg-success/20 transition-colors border border-success/30"
              >
                + افزودن کالای جدید
              </button>
            </div>

            {showNewItemForm && (
              <div className="mt-4 p-4 bg-background rounded-lg border border-border space-y-3">
                <input
                  type="text"
                  placeholder="نام کالا"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <select
                  value={newItemForm.category}
                  onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">انتخاب دسته‌بندی</option>
                  {posCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="قیمت فروش (ریال)"
                  value={newItemForm.sellPrice || ''}
                  onChange={(e) => setNewItemForm({ ...newItemForm, sellPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  onClick={handleAddNewPOSItem}
                  className="w-full px-3 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  افزودن
                </button>
              </div>
            )}
          </Card>

          <Card title={`اقلام (${currentCategoryItems.length})`}>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentCategoryItems.length === 0 ? (
                <p className="text-center text-secondary py-4">هیچ کالایی در این دسته وجود ندارد</p>
              ) : (
                currentCategoryItems.map(item => (
                  <POSItemCard
                    key={item.id}
                    item={item}
                    onAdd={() => handleAddToCart(item)}
                    inCart={cart.has(item.id)}
                  />
                ))
              )}
            </div>
          </Card>

          {frequentItems.length > 0 && (
            <Card title="اقلام پرفروش">
              <div className="grid grid-cols-2 gap-2">
                {frequentItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className="p-3 bg-success/10 text-success text-sm font-medium rounded-lg hover:bg-success/20 transition-colors border border-success/30 text-center truncate"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* RIGHT: CART & PAYMENT */}
        <div className="lg:col-span-2 space-y-4 sticky top-4 h-fit">
          <Card title={`سبد خرید (${cartArray.length})`} className="bg-accent/5">
            <div className="space-y-3 max-h-96 overflow-y-auto border-b border-border pb-3">
              {cartArray.length === 0 ? (
                <p className="text-center text-secondary py-6">سبد خرید خالی است</p>
              ) : (
                cartArray.map(item => (
                  <div key={item.posItemId} className="bg-surface p-3 rounded-lg border border-border">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-primary text-sm">{item.name}</p>
                        <CurrencyDisplay value={item.unitPrice} className="text-xs text-secondary" />
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.posItemId)}
                        className="text-danger hover:text-danger/80 transition-colors p-1"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 bg-background rounded-lg p-1">
                        <button
                          onClick={() => handleUpdateCartQuantity(item.posItemId, item.quantity - 1)}
                          className="p-1 hover:bg-border rounded transition-colors"
                        >
                          <MinusIcon />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateCartQuantity(item.posItemId, item.quantity + 1)}
                          className="p-1 hover:bg-border rounded transition-colors"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                      <CurrencyDisplay value={item.quantity * item.unitPrice} className="font-semibold text-primary text-sm" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* TOTALS */}
            {cartArray.length > 0 && (
              <div className="space-y-2 mt-3 pt-3 border-t border-border">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-secondary">جمع:</span>
                  <CurrencyDisplay value={cartTotal} className="font-semibold text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="تخفیف (ریال)"
                    value={discountAmount || ''}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1 px-2 py-1 bg-surface border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <span className="text-xs text-secondary">تخفیف:</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold bg-accent/10 p-2 rounded-lg">
                  <span>نهایی:</span>
                  <CurrencyDisplay value={finalTotal} className="text-accent" />
                </div>
              </div>
            )}
          </Card>

          {/* PAYMENT */}
          <Card title="پرداخت">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-primary block mb-2">روش پرداخت</label>
                <div className="grid grid-cols-3 gap-2">
                  {[PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Transfer].map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-2 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        paymentMethod === method
                          ? 'bg-accent text-accent-text border-accent'
                          : 'bg-surface text-primary border-border hover:bg-border'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCompleteSale}
                disabled={cartArray.length === 0}
                className="w-full px-4 py-3 bg-success text-success-text font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckIcon />
                تایید و ثبت فروش
              </button>
            </div>
          </Card>

          {/* RECENT TRANSACTIONS */}
          <RecentTransactionsCard store={store} />
        </div>
      </main>
    </>
  );
};

const POSItemCard: React.FC<{ item: POSItem; onAdd: () => void; inCart: boolean }> = ({ item, onAdd, inCart }) => (
  <button
    onClick={onAdd}
    className={`w-full p-3 rounded-lg border text-left transition-colors ${
      inCart
        ? 'bg-accent/10 border-accent'
        : 'bg-surface border-border hover:bg-border'
    }`}
  >
    <div className="flex justify-between items-start mb-1">
      <p className="font-semibold text-sm text-primary">{item.name}</p>
      <CurrencyDisplay value={item.sellPrice} className="text-sm font-medium text-accent" />
    </div>
    <p className="text-xs text-secondary">{item.category}</p>
  </button>
);

const RecentTransactionsCard: React.FC<{ store: any }> = ({ store }) => {
  const { sellTransactions } = store as { sellTransactions: SellTransaction[] };
  const recentTransactions = sellTransactions.slice(-5).reverse();

  return (
    <Card title={`آخرین فروش‌ها (${sellTransactions.length})`}>
      {recentTransactions.length === 0 ? (
        <p className="text-center text-secondary py-4">هیچ فروشی ثبت نشده است</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {recentTransactions.map((trans: SellTransaction) => (
            <div key={trans.id} className="p-2 bg-background rounded border border-border text-xs">
              <div className="flex justify-between items-start mb-1">
                <span className="text-secondary">{toJalaliDateString(trans.date)}</span>
                <CurrencyDisplay value={trans.totalAmount} className="font-semibold text-primary" />
              </div>
              <p className="text-secondary">
                {trans.items.length} کالا • {trans.paymentMethod}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default SellDashboard;
