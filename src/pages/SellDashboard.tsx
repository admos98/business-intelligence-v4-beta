import React, { useState, useMemo, useEffect, useRef } from 'react';
import { POSItem, SellTransaction, SellTransactionItem, PaymentMethod, Unit } from '../../shared/types';
import Header from '../components/common/Header';
import { useShoppingStore } from '../store/useShoppingStore';
import { useToast } from '../components/common/Toast';
import { toJalaliDateString } from '../../shared/jalali';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { usePageActions } from '../contexts/PageActionsContext';

interface SellDashboardProps {
  onViewSellAnalysis: () => void;
}

const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;

const SellDashboard: React.FC<SellDashboardProps> = ({ onViewSellAnalysis }) => {
  const store = useShoppingStore();
  const { posItems, getPOSItemsByCategory, getFrequentPOSItems, addSellTransaction, addPOSItem, addCategory } = store;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<Map<string, { posItemId: string; name: string; quantity: number; unitPrice: number; customizations: Record<string, string | number> }>>(new Map());
  const [itemSearch, setItemSearch] = useState<string>('');
  const [rushMode, setRushMode] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
  const { setActions } = usePageActions();

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
  const frequentItems = getFrequentPOSItems(12);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Focus search on Ctrl+F or /
      if ((e.ctrlKey && e.key === 'f') || e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Number keys 1-9 for frequent items
      if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const idx = parseInt(e.key, 10) - 1;
        const item = frequentItems[idx];
        if (item) {
          if (rushMode) {
            handleAddToCart(item);
          } else {
            openCustomizationModal(item);
          }
        }
      }

      // Enter to complete sale when cart has items
      if (e.key === 'Enter' && cartArray.length > 0 && !modalItem && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleCompleteSale();
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        if (modalItem) closeModal();
        if (showNewItemForm) setShowNewItemForm(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [frequentItems, rushMode, cartArray.length, modalItem, showNewItemForm]);

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

  // Register page actions with Navbar
  useEffect(() => {
    const actions = (
      <>
        <Button key="export-csv" variant="ghost" size="sm" onClick={handleExportTransactionsCsv} fullWidth>
          صادر CSV
        </Button>
        <Button key="export-json" variant="ghost" size="sm" onClick={handleExportTransactionsJson} fullWidth>
          صادر JSON
        </Button>
        <Button key="print-cart" variant="primary" size="sm" onClick={handlePrintCart} fullWidth>
          چاپ سبد
        </Button>
        <Button key="sell-analysis" variant="secondary" size="sm" onClick={onViewSellAnalysis} fullWidth>
          تحلیل فروش
        </Button>
      </>
    );
    setActions(actions);
    return () => {
      // Use setTimeout to ensure cleanup happens after render
      setTimeout(() => setActions(null), 0);
    };
  }, [setActions, handleExportTransactionsCsv, handleExportTransactionsJson, handlePrintCart, onViewSellAnalysis]);

  return (
    <>
      <Header title="فروش و سفارش (POS)" hideMenu={true} />

      <main className="p-4 sm:p-6 md:p-8 max-w-[1800px] mx-auto">
        {/* CATEGORIES BAR - Top of screen for quick access */}
        <div className="mb-4 flex flex-wrap gap-2 items-center animate-fade-in">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="جستجوی کالا... (Ctrl+F یا /)"
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-lg"
          />
          <div className="flex flex-wrap gap-2">
            {posCategories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "primary" : "secondary"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="animate-fade-in"
              >
                {cat}
              </Button>
            ))}
            <input
              placeholder="دسته جدید..."
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm"
              id="new-pos-category"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const el = e.target as HTMLInputElement;
                  const val = el.value?.trim();
                  if (val) {
                    addCategory(val);
                    el.value = '';
                  }
                }
              }}
            />
          </div>
          <Button
            variant={rushMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setRushMode(prev => !prev)}
          >
            {rushMode ? 'Rush: روشن' : 'Rush: خاموش'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT: ITEMS (Larger - 3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Frequent Items - Quick Access */}
            {frequentItems.length > 0 && !itemSearch && (
              <Card title="دسترسی سریع" className="bg-accent/5 animate-fade-in">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                  {frequentItems.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.variants && item.variants.length > 0) {
                          openCustomizationModal(item);
                        } else {
                          handleAddToCart(item);
                        }
                      }}
                      className="p-3 bg-surface border border-border rounded-lg hover:bg-accent/10 hover:border-accent hover-lift transition-all text-center group animate-fade-in"
                      style={{ animationDelay: `${idx * 30}ms` }}
                      title={`${item.name} (${idx + 1})`}
                    >
                      <div className="text-xs text-secondary mb-1">{idx + 1}</div>
                      <div className="text-sm font-semibold text-primary truncate">{item.name}</div>
                      <div className="text-xs text-accent mt-1"><CurrencyDisplay value={item.sellPrice} /></div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Items Grid - Large buttons for speed */}
            <Card title={`${selectedCategory || 'همه'} (${currentCategoryItems.length})`} className="animate-fade-in">
              {currentCategoryItems.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-secondary text-lg mb-4">هیچ کالایی در این دسته وجود ندارد</p>
                  <Button
                    onClick={() => setShowNewItemForm(true)}
                    variant="primary"
                  >
                    افزودن کالای جدید
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {currentCategoryItems.map((item, idx) => {
                    const inCart = Array.from(cart.keys()).some(k => k.startsWith(item.id));
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.variants && item.variants.length > 0) {
                            openCustomizationModal(item);
                          } else {
                            handleAddToCart(item);
                          }
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-center hover-lift animate-fade-in ${
                          inCart
                            ? 'bg-accent/20 border-accent shadow-lg scale-105'
                            : 'bg-surface border-border hover:border-accent hover:bg-accent/5'
                        }`}
                        style={{ animationDelay: `${idx * 20}ms` }}
                      >
                        <div className="font-bold text-base text-primary mb-1 truncate">{item.name}</div>
                        <div className="text-sm text-accent font-semibold"><CurrencyDisplay value={item.sellPrice} /></div>
                        {inCart && (
                          <div className="text-xs text-accent mt-1">
                            {cartArray.find(c => c.posItemId === item.id)?.quantity || 0}×
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
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

            {/* New/Edit Item Form */}
            {showNewItemForm && (
              <Card title="افزودن کالای جدید" className="animate-fade-in">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-primary block mb-1">نام کالا</label>
                      <input
                        type="text"
                        placeholder="مثال: قهوه لاته"
                        value={newItemForm.name}
                        onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-primary block mb-1">دسته‌بندی</label>
                      <select
                        value={newItemForm.category}
                        onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">انتخاب دسته</option>
                        {posCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-primary block mb-1">قیمت پایه (ریال)</label>
                      <input
                        type="number"
                        placeholder="قیمت پایه"
                        value={newItemForm.sellPrice || ''}
                        onChange={(e) => setNewItemForm({ ...newItemForm, sellPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* VARIANTS EDITOR */}
                  <div className="mt-3">
                    <label className="text-sm font-medium text-primary block mb-2">ورژن‌های آماده (اختیاری)</label>
                    <div className="space-y-2">
                      {newItemVariants.map((v, idx) => (
                        <div key={v.id} className="flex gap-2">
                          <input
                            value={v.name}
                            onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                            className="flex-1 px-2 py-1 bg-surface border border-border rounded"
                            placeholder="نام ورژن"
                          />
                          <input
                            type="number"
                            value={String(v.priceModifier)}
                            onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? { ...p, priceModifier: parseFloat(e.target.value) || 0 } : p))}
                            className="w-28 px-2 py-1 bg-surface border border-border rounded"
                            placeholder="+500"
                          />
                          <Button variant="danger" size="sm" onClick={() => setNewItemVariants(prev => prev.filter((_, i) => i !== idx))}>
                            حذف
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <input id="new-variant-name" placeholder="نام ورژن (مثال: دوبل)" className="flex-1 px-2 py-1 bg-surface border border-border rounded" />
                        <input id="new-variant-price" type="number" placeholder="+500" className="w-28 px-2 py-1 bg-surface border border-border rounded" />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const nEl = document.getElementById('new-variant-name') as HTMLInputElement | null;
                            const pEl = document.getElementById('new-variant-price') as HTMLInputElement | null;
                            if (!nEl) return;
                            const name = nEl.value.trim();
                            const price = pEl ? parseFloat(pEl.value) || 0 : 0;
                            if (!name) return;
                            setNewItemVariants(prev => [...prev, { id: `var-${Date.now()}-${Math.random()}`, name, priceModifier: price }]);
                            nEl.value = '';
                            if (pEl) pEl.value = '';
                          }}
                        >
                          افزودن ورژن
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowNewItemForm(false);
                        setNewItemForm({ name: '', category: '', sellPrice: 0 });
                        setNewItemVariants([]);
                      }}
                      fullWidth
                    >
                      انصراف
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleAddNewPOSItem}
                      fullWidth
                    >
                      افزودن کالا
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT: CART & PAYMENT (1 column) */}
          <div className="lg:col-span-1 space-y-4 sticky top-4 h-fit">
            <Card title={`سبد خرید (${cartArray.length})`} className="bg-accent/5 animate-fade-in">
              <div className="space-y-2 max-h-[400px] overflow-y-auto border-b border-border pb-3">
                {cartArray.length === 0 ? (
                  <p className="text-center text-secondary py-8">سبد خرید خالی است</p>
                ) : (
                  cartArray.map((item, idx) => {
                    const cartKey = Array.from(cart.keys())[idx];
                    return (
                      <div
                        key={cartKey}
                        className="bg-surface p-3 rounded-lg border border-border hover-lift animate-fade-in transition-all"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-primary text-sm">{item.name}</p>
                            <CurrencyDisplay value={item.unitPrice} className="text-xs text-secondary" />
                          </div>
                          <button
                            onClick={() => handleRemoveFromCart(item.posItemId)}
                            className="text-danger hover:text-danger/80 transition-colors p-1 hover:bg-danger/10 rounded"
                            aria-label="حذف از سبد"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 bg-background rounded-lg p-1">
                            <button
                              onClick={() => handleUpdateCartQuantity(item.posItemId, item.quantity - 1)}
                              className="p-1 hover:bg-border rounded transition-colors"
                              aria-label="کاهش تعداد"
                            >
                              <MinusIcon />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateCartQuantity(item.posItemId, item.quantity + 1)}
                              className="p-1 hover:bg-border rounded transition-colors"
                              aria-label="افزایش تعداد"
                            >
                              <PlusIcon />
                            </button>
                          </div>
                          <CurrencyDisplay value={item.quantity * item.unitPrice} className="font-bold text-primary" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* TOTALS */}
              {cartArray.length > 0 && (
                <div className="space-y-3 mt-3 pt-3 border-t border-border">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-secondary">جمع:</span>
                    <CurrencyDisplay value={cartTotal} className="font-semibold text-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-secondary block mb-1">تخفیف (ریال)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xl font-bold bg-accent/10 p-3 rounded-lg">
                    <span>نهایی:</span>
                    <CurrencyDisplay value={finalTotal} className="text-accent" />
                  </div>
                </div>
              )}
            </Card>

            {/* PAYMENT */}
            {cartArray.length > 0 && (
              <Card title="پرداخت" className="animate-fade-in">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-primary block mb-2">روش پرداخت</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Transfer].map(method => (
                        <button
                          key={method}
                          onClick={() => setPaymentMethod(method)}
                          className={`px-3 py-3 text-sm font-medium rounded-lg border-2 transition-colors ${
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

                  <Button
                    variant="success"
                    size="lg"
                    onClick={handleCompleteSale}
                    disabled={cartArray.length === 0}
                    fullWidth
                    icon={<CheckIcon />}
                    className="animate-fade-in"
                  >
                    تایید و ثبت فروش
                  </Button>
                  <p className="text-xs text-secondary text-center">Enter برای ثبت سریع</p>
                </div>
              </Card>
            )}

            {/* RECENT TRANSACTIONS */}
            <RecentTransactionsCard store={store} />
          </div>
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
            <div key={trans.id} className="p-2 bg-background rounded border border-border text-xs hover-lift transition-all animate-fade-in">
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
