import React, { useState, useMemo, useEffect } from 'react';
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
  const { posItems, getPOSItemsByCategory, getFrequentPOSItems, addSellTransaction, addPOSItem, addCategory } = store;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<Map<string, { posItemId: string; name: string; quantity: number; unitPrice: number; customizations: Record<string, string | number> }>>(new Map());
  const [itemSearch, setItemSearch] = useState<string>('');
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [rushMode, setRushMode] = useState<boolean>(false);

  // Customization modal state
  const [modalItem, setModalItem] = useState<POSItem | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalVariantId, setModalVariantId] = useState<string | undefined>(undefined);
  const [modalCustomizations, setModalCustomizations] = useState<Record<string, string | number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', category: '', sellPrice: 0 });
  const { addToast } = useToast();

  // Get POS categories
  const posCategories = useMemo(() => {
    const cats = new Set<string>();
    posItems.forEach(item => cats.add(item.category));
    // Add custom categories from the store
    store.customCategories.forEach(cat => cats.add(cat));
    return Array.from(cats).sort();
  }, [posItems, store.customCategories]); // Add store.customCategories to dependencies


  // Set initial category
  React.useEffect(() => {
    if (!selectedCategory && posCategories.length > 0) {
      setSelectedCategory(posCategories[0]);
    }
  }, [posCategories, selectedCategory]);

  const currentCategoryItems = useMemo(() => {
    const items = selectedCategory ? getPOSItemsByCategory(selectedCategory) : posItems;
    if (!itemSearch.trim()) return items;
    const q = itemSearch.trim().toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [selectedCategory, getPOSItemsByCategory, posItems, itemSearch]);
  const frequentItems = getFrequentPOSItems(6);

  const cartArray = Array.from(cart.values());
  const cartTotal = cartArray.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  const handleAddToCart = (posItem: POSItem, opts?: { variantId?: string; customizations?: Record<string, string | number>; quantity?: number }) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const key = opts && (opts.variantId || Object.keys(opts.customizations || {}).length > 0)
        ? `${posItem.id}::${opts.variantId || ''}::${JSON.stringify(opts.customizations || {})}`
        : posItem.id;

      const existing = newCart.get(key);
      const variant = opts?.variantId ? (posItem.variants || []).find(v => v.id === opts.variantId) : undefined;
      const customizationPrice = (opts?.customizations && Object.keys(opts.customizations).length > 0 && posItem.customizations)
        ? Object.entries(opts!.customizations!).reduce((s, [k, v]) => {
            const cust = posItem.customizations!.find(c => c.name === k);
            return s + (cust?.priceModifier || 0) * (typeof v === 'number' ? Number(v) : 1);
          }, 0)
        : 0;

      const unitPrice = posItem.sellPrice + (variant ? variant.priceModifier : 0) + customizationPrice;

      if (existing) {
        existing.quantity += opts?.quantity || 1;
        existing.unitPrice = unitPrice; // update to latest price
      } else {
        newCart.set(key, {
          posItemId: posItem.id,
          name: posItem.name + (variant ? ` (${variant.name})` : ''),
          quantity: opts?.quantity || 1,
          unitPrice,
          customizations: opts?.customizations || {},
        });
      }
      return newCart;
    });
  };

  // Open customization modal for an item (slower path for complex orders)
  const openCustomizationModal = (item: POSItem) => {
    setModalItem(item);
    setModalQty(1);
    setModalVariantId(item.variants && item.variants.length > 0 ? item.variants[0].id : undefined);
    setModalCustomizations({});
  };

  const closeModal = () => {
    setModalItem(null);
    setModalQty(1);
    setModalVariantId(undefined);
    setModalCustomizations({});
  };

  const confirmModalAdd = () => {
    if (!modalItem) return;
    handleAddToCart(modalItem, { variantId: modalVariantId, customizations: modalCustomizations, quantity: modalQty });
    closeModal();
  };

  // Keyboard shortcuts: 1..9 map to frequent items
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      if (/^[1-9]$/.test(key)) {
        const idx = parseInt(key, 10) - 1;
        const item = frequentItems[idx];
        if (item) {
          if (rushMode) {
            // Rush mode: instant add
            handleAddToCart(item);
          } else {
            // open modal for edits
            openCustomizationModal(item);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [frequentItems, rushMode]);

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

  // New POS item creation supports variants
  const [newItemVariants, setNewItemVariants] = useState<{ id: string; name: string; priceModifier: number }[]>([]);

  const handleAddNewPOSItem = () => {
    if (!newItemForm.name || !newItemForm.category || newItemForm.sellPrice <= 0) {
      addToast('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    const payload: Omit<POSItem, 'id'> = {
      name: newItemForm.name,
      category: newItemForm.category,
      sellPrice: newItemForm.sellPrice,
      unit: Unit.Piece,
      variants: newItemVariants.map(v => ({ id: v.id, name: v.name, priceModifier: v.priceModifier })),
    };

    addPOSItem(payload);

    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemVariants([]);
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
        {/* LEFT: ITEMS (Larger) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              placeholder="جستجوی کالا..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={() => setRushMode(prev => !prev)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${rushMode ? 'bg-accent text-accent-text border-accent' : 'bg-surface text-primary border-border hover:bg-border'}`}
              title="Rush Mode (یک‌لمسی)"
            >
              {rushMode ? 'Rush: روشن' : 'Rush: خاموش'}
            </button>
          </div>
          <Card title={`اقلام (${currentCategoryItems.length})`}>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {currentCategoryItems.length === 0 ? (
                <p className="text-center text-secondary py-4">هیچ کالایی در این دسته وجود ندارد</p>
              ) : (
                <div className={`grid ${rushMode ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-2'} gap-3`}>
                  {currentCategoryItems.map(item => (
                    <POSItemCard
                      key={item.id}
                      item={item}
                      onAdd={() => handleAddToCart(item)}
                      onAddVariant={(variantId: string) => handleAddToCart(item, { variantId })}
                      inCart={Array.from(cart.keys()).some(k => k.startsWith(item.id))}
                      rush={rushMode}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>

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
                {/* VARIANTS EDITOR */}
                <div className="mt-3">
                  <label className="text-sm font-medium text-primary block mb-2">ورنش‌های آماده (اختیاری)</label>
                  <div className="space-y-2">
                    {newItemVariants.map((v, idx) => (
                      <div key={v.id} className="flex gap-2">
                        <input value={v.name} onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))} className="flex-1 px-2 py-1 bg-surface border border-border rounded" />
                        <input type="number" value={String(v.priceModifier)} onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? { ...p, priceModifier: parseFloat(e.target.value) || 0 } : p))} className="w-28 px-2 py-1 bg-surface border border-border rounded" />
                        <button onClick={() => setNewItemVariants(prev => prev.filter((_, i) => i !== idx))} className="px-2 py-1 bg-danger/10 text-danger rounded">حذف</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input id="new-variant-name" placeholder="نام ورژن (مثال: دوبل)" className="flex-1 px-2 py-1 bg-surface border border-border rounded" />
                      <input id="new-variant-price" type="number" placeholder="+500" className="w-28 px-2 py-1 bg-surface border border-border rounded" />
                      <button onClick={() => {
                        const nEl = document.getElementById('new-variant-name') as HTMLInputElement | null;
                        const pEl = document.getElementById('new-variant-price') as HTMLInputElement | null;
                        if (!nEl) return;
                        const name = nEl.value.trim();
                        const price = pEl ? parseFloat(pEl.value) || 0 : 0;
                        if (!name) return;
                        setNewItemVariants(prev => [...prev, { id: `var-${Date.now()}-${Math.random()}`, name, priceModifier: price }]);
                        nEl.value = '';
                        if (pEl) pEl.value = '';
                      }} className="px-3 py-1 bg-accent text-accent-text rounded">افزودن ورژن</button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleAddNewPOSItem}
                  className="w-full px-3 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  افزودن
                </button>
              </div>
            )}

          {frequentItems.length > 0 && (
            <Card title="اقلام پرفروش">
              <div className="grid grid-cols-4 gap-2">
                {frequentItems.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => rushMode ? handleAddToCart(item) : openCustomizationModal(item)}
                    className="p-3 bg-success/10 text-success text-sm font-medium rounded-lg hover:bg-success/20 transition-colors border border-success/30 text-center truncate"
                  >
                    <span className="font-bold mr-1">{idx < 9 ? idx + 1 : ''}</span>
                    {item.name}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
        {/* RIGHT: CATEGORIES (narrow) + CART & PAYMENT */}
        <div className="lg:col-span-1 space-y-4 sticky top-4 h-fit">
          <Card title="دسته‌بندی‌ها">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="جستجوی دسته..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg mb-2"
              />
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {posCategories.filter(c => !categorySearch.trim() || c.toLowerCase().includes(categorySearch.trim().toLowerCase())).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full px-3 py-2 rounded-lg text-left font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-accent text-accent-text'
                        : 'bg-surface border border-border text-primary hover:bg-border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input placeholder="دسته جدید..." className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg" id="new-pos-category" />
                <button onClick={() => {
                    const el = document.getElementById('new-pos-category') as HTMLInputElement | null;
                    if (!el) return;
                    const val = el.value?.trim();
                    if (!val) return;
                    addCategory(val);
                    el.value = '';
                  }} className="px-3 py-2 bg-primary text-background rounded-lg">افزودن دسته</button>
              </div>
              <button
                onClick={() => setShowNewItemForm(!showNewItemForm)}
                className="w-full mt-2 px-4 py-2 rounded-lg text-left font-medium bg-success/10 text-success hover:bg-success/20 transition-colors border border-success/30"
              >
                + افزودن کالای جدید
              </button>
            </div>
          </Card>

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
      {/* Customization Modal */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-background rounded-lg p-4 border border-border">
            <h3 className="font-bold text-lg mb-2">سفارشی‌سازی: {modalItem.name}</h3>
            <div className="space-y-2">
              {modalItem.variants && modalItem.variants.length > 0 && (
                <div>
                  <label className="text-sm text-secondary block mb-1">ورژن</label>
                  <select value={modalVariantId} onChange={e => setModalVariantId(e.target.value)} className="w-full px-2 py-1 bg-surface border border-border rounded">
                    {modalItem.variants.map(v => (<option key={v.id} value={v.id}>{v.name} {v.priceModifier !== 0 ? `(${v.priceModifier > 0 ? '+' : ''}${v.priceModifier})` : ''}</option>))}
                  </select>
                </div>
              )}

              {modalItem.customizations && modalItem.customizations.length > 0 && (
                <div>
                  <label className="text-sm text-secondary block mb-1">سفارشی‌سازی‌ها</label>
                  <div className="space-y-2">
                    {modalItem.customizations.map(c => (
                      <div key={c.name} className="flex items-center gap-2">
                        <label className="flex-1 text-sm">{c.name} ({(c.priceModifier ?? 0) > 0 ? `+${c.priceModifier ?? 0}` : (c.priceModifier ?? 0)})</label>
                        <input type="number" value={String(modalCustomizations[c.name] || 0)} onChange={e => setModalCustomizations(prev => ({ ...prev, [c.name]: parseFloat(e.target.value) || 0 }))} className="w-24 px-2 py-1 bg-surface border border-border rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-sm">تعداد</label>
                <input type="number" value={modalQty} onChange={e => setModalQty(parseInt(e.target.value, 10) || 1)} className="w-20 px-2 py-1 bg-surface border border-border rounded" />
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button onClick={closeModal} className="px-3 py-2 bg-surface border border-border rounded">انصراف</button>
                <button onClick={confirmModalAdd} className="px-3 py-2 bg-accent text-accent-text rounded">افزودن به سبد</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const POSItemCard: React.FC<{ item: POSItem; onAdd: () => void; onAddVariant?: (variantId: string) => void; inCart: boolean; rush?: boolean }> = ({ item, onAdd, onAddVariant, inCart, rush }) => (
  <div className={`w-full ${rush ? 'p-4' : 'p-3'} rounded-lg border transition-colors ${
      inCart
        ? 'bg-accent/10 border-accent'
        : 'bg-surface border-border'
    }`}>
    <div className="flex justify-between items-start mb-1">
      <div>
        <p className={`${rush ? 'font-bold text-base' : 'font-semibold text-sm'} text-primary`}>{item.name}</p>
        {!rush && <p className="text-xs text-secondary">{item.category}</p>}
      </div>
      <div className="text-right">
        <CurrencyDisplay value={item.sellPrice} className="text-sm font-medium text-accent" />
      </div>
    </div>

    <div className="mt-2 flex flex-wrap gap-2">
      <button onClick={onAdd} className={`${rush ? 'w-full py-3 text-lg' : 'px-3 py-1 text-sm'} bg-accent/10 text-accent rounded hover:bg-accent/20`}>+ افزودن</button>
      {item.variants && item.variants.length > 0 && onAddVariant && (
        <div className="flex gap-2 flex-wrap">
          {item.variants.map(v => (
            <button key={v.id} onClick={() => onAddVariant(v.id)} className={`px-2 py-1 ${rush ? 'text-sm' : 'text-xs'} bg-surface text-primary rounded border border-border hover:bg-border`}>
              {v.name} {v.priceModifier ? `(${v.priceModifier > 0 ? '+' : ''}${v.priceModifier})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
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
