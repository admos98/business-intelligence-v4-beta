import React, { useState, useMemo, useEffect, useRef } from 'react';
import { POSItem, SellTransaction, SellTransactionItem, PaymentMethod, Unit, POSCustomization, POSCustomizationOption } from '../../shared/types';
import Header from '../components/common/Header';
import { useShoppingStore } from '../store/useShoppingStore';
import { useToast } from '../components/common/Toast';
import { toJalaliDateString } from '../../shared/jalali';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Card from '../components/common/Card';
import ConfirmModal from '../components/modals/ConfirmModal';

interface SellDashboardProps {
  onLogout: () => void;
  onViewSellAnalysis: () => void;
}

const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

const SellDashboard: React.FC<SellDashboardProps> = ({ onLogout, onViewSellAnalysis }) => {
  const store = useShoppingStore();
  const { posItems, getPOSItemsByCategory, getFrequentPOSItems, addSellTransaction, addPOSItem, updatePOSItem, deletePOSItem, addPOSCategory, posCategories, sellTransactions, updateSellTransaction, deleteSellTransaction } = store;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<Map<string, { posItemId: string; name: string; quantity: number; unitPrice: number; customizations: Record<string, string | number> }>>(new Map());
  const [itemSearch, setItemSearch] = useState<string>('');
  const [showItemManagement, setShowItemManagement] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  // Customization modal state
  const [modalItem, setModalItem] = useState<POSItem | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalVariantId, setModalVariantId] = useState<string | undefined>(undefined);
  const [modalCustomizations, setModalCustomizations] = useState<Record<string, string | number>>({});

  // Payment and discount
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Item management
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<POSItem | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: '', category: '', sellPrice: 0 });
  const [newItemCustomizations, setNewItemCustomizations] = useState<POSCustomization[]>([]);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<{ isOpen: boolean; item: POSItem | null }>({ isOpen: false, item: null });

  // Transaction management
  const [editingTransaction, setEditingTransaction] = useState<SellTransaction | null>(null);
  const [deleteTransactionConfirm, setDeleteTransactionConfirm] = useState<{ isOpen: boolean; transaction: SellTransaction | null }>({ isOpen: false, transaction: null });

  const { addToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get POS categories (separate from buy categories)
  const allPOSCategories = useMemo(() => {
    const cats = new Set<string>();
    posItems.forEach(item => cats.add(item.category));
    posCategories.forEach(cat => cats.add(cat));
    return Array.from(cats).sort();
  }, [posItems, posCategories]);

  // Set initial category
  useEffect(() => {
    if (!selectedCategory && allPOSCategories.length > 0) {
      setSelectedCategory(allPOSCategories[0]);
    }
  }, [allPOSCategories, selectedCategory]);

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

  // Calculate price with new options system
  const calculateItemPrice = (posItem: POSItem, customizations?: Record<string, string | number>, variantId?: string) => {
    let price = posItem.sellPrice;

    if (variantId) {
      const variant = posItem.variants?.find(v => v.id === variantId);
      if (variant) price += variant.priceModifier;
    }

    if (customizations && posItem.customizations) {
      Object.entries(customizations).forEach(([k, v]) => {
        const cust = posItem.customizations!.find(c => c.name === k);
        if (!cust) return;

        if (cust.options && cust.options.length > 0) {
          const selectedOption = cust.options.find(opt => opt.label === String(v) || opt.id === String(v));
          if (selectedOption) {
            if (selectedOption.isCustomAmount && typeof v === 'number' && selectedOption.pricePerUnit) {
              price += v * selectedOption.pricePerUnit;
            } else {
              price += selectedOption.price;
            }
          }
        } else if (cust.priceModifier) {
          price += cust.priceModifier * (typeof v === 'number' ? Number(v) : 1);
        }
      });
    }

    return price;
  };

  const handleAddToCart = (posItem: POSItem, opts?: { variantId?: string; customizations?: Record<string, string | number>; quantity?: number }) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const key = opts && (opts.variantId || Object.keys(opts.customizations || {}).length > 0)
        ? `${posItem.id}::${opts.variantId || ''}::${JSON.stringify(opts.customizations || {})}`
        : posItem.id;

      const existing = newCart.get(key);
      const unitPrice = calculateItemPrice(posItem, opts?.customizations, opts?.variantId);

      if (existing) {
        existing.quantity += opts?.quantity || 1;
        existing.unitPrice = unitPrice;
      } else {
        const variant = opts?.variantId ? (posItem.variants || []).find(v => v.id === opts.variantId) : undefined;
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

  // Open customization modal
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
          if (item.customizations && item.customizations.length > 0) {
            openCustomizationModal(item);
          } else {
            handleAddToCart(item);
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
        if (editingItem) setEditingItem(null);
        if (editingTransaction) setEditingTransaction(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [frequentItems, cartArray.length, modalItem, showNewItemForm, editingItem, editingTransaction]);

  const handleUpdateCartQuantity = (key: string, quantity: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      if (quantity <= 0) {
        newCart.delete(key);
      } else {
        const item = newCart.get(key);
        if (item) {
          item.quantity = quantity;
        }
      }
      return newCart;
    });
  };

  const handleRemoveFromCart = (key: string) => {
    setCart(prev => {
      const newCart = new Map(prev);
      newCart.delete(key);
      return newCart;
    });
  };

  // Print receipt function
  const printReceipt = (transaction: SellTransaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('دسترسی به چاپ رد شد', 'error');
      return;
    }

    const itemsHtml = transaction.items.map(item => `
      <tr>
        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; text-align: right;">${item.name}</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; text-align: center;">${item.unitPrice.toLocaleString('fa-IR')}</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid #ddd; text-align: center;">${item.totalPrice.toLocaleString('fa-IR')}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>رسید فروش</title>
        <style>
          @media print {
            @page { margin: 0.5cm; size: 80mm auto; }
            body { margin: 0; }
          }
          body { font-family: 'Vazirmatn', Arial, sans-serif; direction: rtl; margin: 1rem; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 0.5rem; margin-bottom: 1rem; }
          h1 { margin: 0; font-size: 18px; color: #333; }
          .info { text-align: center; margin-bottom: 1rem; color: #666; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
          th { background-color: #f0f0f0; padding: 0.5rem; border-bottom: 2px solid #333; text-align: right; font-weight: bold; }
          .total { font-size: 16px; font-weight: bold; text-align: left; margin-top: 1rem; padding-top: 0.5rem; border-top: 2px solid #333; }
          .footer { text-align: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>رسید فروش کافه</h1>
        </div>
        <div class="info">
          <p style="margin: 0.25rem 0;">تاریخ: ${toJalaliDateString(transaction.date)}</p>
          <p style="margin: 0.25rem 0;">روش پرداخت: ${transaction.paymentMethod}</p>
        </div>
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
          ${transaction.discountAmount ? `<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span>جمع:</span><span>${transaction.items.reduce((s, i) => s + i.totalPrice, 0).toLocaleString('fa-IR')}</span></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span>تخفیف:</span><span>${transaction.discountAmount.toLocaleString('fa-IR')}</span></div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span>مجموع کل:</span>
            <span>${transaction.totalAmount.toLocaleString('fa-IR')} تومان</span>
          </div>
        </div>
        <div class="footer">
          <p>با تشکر از خرید شما</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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

    const transactionId = addSellTransaction(transaction);
    const createdTransaction = store.sellTransactions.find(t => t.id === transactionId);

    // Auto-print receipt
    if (createdTransaction) {
      setTimeout(() => printReceipt(createdTransaction), 100);
    }

    setCart(new Map());
    setDiscountAmount(0);
    addToast('فروش ثبت شد و رسید چاپ شد', 'success');
  };

  // Item management functions
  const handleAddNewPOSItem = () => {
    if (!newItemForm.name || !newItemForm.category || newItemForm.sellPrice <= 0) {
      addToast('لطفاً نام، دسته و قیمت پایه را وارد کنید', 'error');
      return;
    }

    const payload: Omit<POSItem, 'id'> = {
      name: newItemForm.name,
      category: newItemForm.category,
      sellPrice: newItemForm.sellPrice,
      unit: Unit.Piece,
      customizations: newItemCustomizations.length > 0 ? newItemCustomizations : undefined,
    };

    addPOSItem(payload);
    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemCustomizations([]);
    setShowNewItemForm(false);
    addToast('کالای جدید اضافه شد', 'success');
  };

  const handleEditPOSItem = (item: POSItem) => {
    setEditingItem(item);
    setNewItemForm({ name: item.name, category: item.category, sellPrice: item.sellPrice });
    setNewItemCustomizations(item.customizations || []);
    setShowNewItemForm(true);
  };

  const handleUpdatePOSItem = () => {
    if (!editingItem) return;
    if (!newItemForm.name || !newItemForm.category || newItemForm.sellPrice <= 0) {
      addToast('لطفاً نام، دسته و قیمت پایه را وارد کنید', 'error');
      return;
    }

    updatePOSItem(editingItem.id, {
      name: newItemForm.name,
      category: newItemForm.category,
      sellPrice: newItemForm.sellPrice,
      customizations: newItemCustomizations.length > 0 ? newItemCustomizations : undefined,
    });

    setEditingItem(null);
    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemCustomizations([]);
    setShowNewItemForm(false);
    addToast('کالا به‌روزرسانی شد', 'success');
  };

  const handleDeletePOSItem = (item: POSItem) => {
    deletePOSItem(item.id);
    addToast('کالا حذف شد', 'info');
    setDeleteItemConfirm({ isOpen: false, item: null });
  };

  // Transaction management functions
  const handleEditTransaction = (transaction: SellTransaction) => {
    setEditingTransaction(transaction);
    setCart(new Map(transaction.items.map(item => {
      const key = `${item.posItemId}::${JSON.stringify(item.customizationChoices || {})}`;
      return [key, {
        posItemId: item.posItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        customizations: item.customizationChoices || {},
      }];
    })));
    setPaymentMethod(transaction.paymentMethod);
    setDiscountAmount(transaction.discountAmount || 0);
    setShowTransactions(false);
  };

  const handleUpdateTransaction = () => {
    if (!editingTransaction) return;
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

    updateSellTransaction(editingTransaction.id, {
      items,
      totalAmount: finalTotal,
      paymentMethod,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
    });

    setEditingTransaction(null);
    setCart(new Map());
    setDiscountAmount(0);
    addToast('فروش به‌روزرسانی شد', 'success');
  };

  const handleDeleteTransaction = (transaction: SellTransaction) => {
    deleteSellTransaction(transaction.id);
    addToast('فروش حذف شد', 'info');
    setDeleteTransactionConfirm({ isOpen: false, transaction: null });
  };

  // Customization management functions
  const handleAddCustomization = () => {
    setNewItemCustomizations(prev => [...prev, {
      id: `cust-${Date.now()}-${Math.random()}`,
      name: '',
      type: 'select',
      options: [],
    }]);
  };

  const handleUpdateCustomization = (index: number, updates: Partial<POSCustomization>) => {
    setNewItemCustomizations(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const handleRemoveCustomization = (index: number) => {
    setNewItemCustomizations(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddOptionToCustomization = (custIndex: number, option: POSCustomizationOption) => {
    setNewItemCustomizations(prev => prev.map((c, i) =>
      i === custIndex
        ? { ...c, options: [...(c.options || []), option] }
        : c
    ));
  };

  const handleRemoveOptionFromCustomization = (custIndex: number, optionId: string) => {
    setNewItemCustomizations(prev => prev.map((c, i) =>
      i === custIndex
        ? { ...c, options: (c.options || []).filter(opt => opt.id !== optionId) }
        : c
    ));
  };

  // Export functions
  const handleExportTransactionsCsv = () => {
    if (sellTransactions.length === 0) {
      addToast('فروش برای صادر کردن وجود ندارد', 'info');
      return;
    }

    // Export both CSV and JSON
    const headers = ['id', 'date', 'totalAmount', 'paymentMethod', 'discountAmount', 'itemsCount', 'items'];
    const rows = sellTransactions.map(t => {
      const itemsStr = t.items.map(i => `${i.name} x${i.quantity} @${i.unitPrice}`).join(' | ');
      return [t.id, new Date(t.date).toISOString(), String(t.totalAmount), String(t.paymentMethod), String(t.discountAmount || ''), String(t.items.length), `"${itemsStr}"`];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // CSV
    const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement('a');
    csvLink.href = csvUrl;
    csvLink.download = `sell_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    csvLink.click();
    URL.revokeObjectURL(csvUrl);

    // JSON
    const jsonString = JSON.stringify(sellTransactions, null, 2);
    const jsonBlob = new Blob([jsonString], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `sell_transactions_${new Date().toISOString().slice(0, 10)}.json`;
    setTimeout(() => {
      jsonLink.click();
      URL.revokeObjectURL(jsonUrl);
    }, 100);

    addToast('فروش‌ها با موفقیت صادر شدند', 'success');
  };

  return (
    <>
      <Header title="فروش و سفارش (POS)" onLogout={onLogout} hideMenu={true}>
        <button
          onClick={() => setShowItemManagement(!showItemManagement)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
            showItemManagement ? 'bg-accent text-accent-text border-accent' : 'bg-surface text-primary border-border hover:bg-border'
          }`}
        >
          مدیریت کالاها
        </button>
        <button
          onClick={() => setShowTransactions(!showTransactions)}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
            showTransactions ? 'bg-accent text-accent-text border-accent' : 'bg-surface text-primary border-border hover:bg-border'
          }`}
        >
          تاریخچه فروش‌ها ({sellTransactions.length})
        </button>
        <button onClick={handleExportTransactionsCsv} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          صادر CSV
        </button>
        <button onClick={onViewSellAnalysis} className="px-3 py-1.5 text-sm bg-surface text-primary font-medium rounded-lg hover:bg-border transition-colors border border-border">
          تحلیل فروش
        </button>
      </Header>

      <main className="p-4 sm:p-6 md:p-8 max-w-[1800px] mx-auto">
        {/* CATEGORIES BAR - Top of screen for quick access */}
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="جستجوی کالا... (Ctrl+F یا /)"
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2.5 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-lg"
          />
          <div className="flex flex-wrap gap-2">
            {allPOSCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-accent text-accent-text'
                    : 'bg-surface text-primary border border-border hover:bg-border'
                }`}
              >
                {cat}
              </button>
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
                    addPOSCategory(val);
                    el.value = '';
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT: ITEMS (Larger - 3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Frequent Items - Quick Access */}
            {frequentItems.length > 0 && !itemSearch && (
              <Card title="دسترسی سریع" className="bg-accent/5">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                  {frequentItems.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.customizations && item.customizations.length > 0) {
                          openCustomizationModal(item);
                        } else {
                          handleAddToCart(item);
                        }
                      }}
                      className="p-3 bg-surface border border-border rounded-lg hover:bg-accent/10 hover:border-accent transition-all text-center group"
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
            <Card title={`${selectedCategory || 'همه'} (${currentCategoryItems.length})`}>
              {currentCategoryItems.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-secondary text-lg">هیچ کالایی در این دسته وجود ندارد</p>
                  <button
                    onClick={() => setShowNewItemForm(true)}
                    className="mt-4 px-4 py-2 bg-accent text-accent-text rounded-lg hover:opacity-90"
                  >
                    افزودن کالای جدید
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {currentCategoryItems.map(item => {
                    const inCart = Array.from(cart.keys()).some(k => k.startsWith(item.id));
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.customizations && item.customizations.length > 0) {
                            openCustomizationModal(item);
                          } else {
                            handleAddToCart(item);
                          }
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-center ${
                          inCart
                            ? 'bg-accent/20 border-accent shadow-lg scale-105'
                            : 'bg-surface border-border hover:border-accent hover:bg-accent/5'
                        }`}
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

            {/* Item Management Section */}
            {showItemManagement && (
              <Card title="مدیریت کالاها">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg">کالاهای موجود</h3>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setNewItemForm({ name: '', category: '', sellPrice: 0 });
                        setNewItemCustomizations([]);
                        setShowNewItemForm(true);
                      }}
                      className="px-4 py-2 bg-accent text-accent-text rounded-lg hover:opacity-90"
                    >
                      + افزودن کالای جدید
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {posItems.map(item => (
                      <div key={item.id} className="p-3 bg-surface border border-border rounded-lg flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-primary">{item.name}</div>
                          <div className="text-sm text-secondary">{item.category}</div>
                          <div className="text-sm text-accent"><CurrencyDisplay value={item.sellPrice} /></div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPOSItem(item)}
                            className="p-2 text-accent hover:bg-accent/10 rounded"
                            title="ویرایش"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => setDeleteItemConfirm({ isOpen: true, item })}
                            className="p-2 text-danger hover:bg-danger/10 rounded"
                            title="حذف"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Transactions History */}
            {showTransactions && (
              <Card title="تاریخچه فروش‌ها">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sellTransactions.length === 0 ? (
                    <p className="text-center text-secondary py-8">هیچ فروشی ثبت نشده است</p>
                  ) : (
                    sellTransactions.slice().reverse().map(trans => (
                      <div key={trans.id} className="p-3 bg-surface border border-border rounded-lg flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-primary">
                            {toJalaliDateString(trans.date)} - {trans.paymentMethod}
                          </div>
                          <div className="text-sm text-secondary">
                            {trans.items.length} کالا
                          </div>
                          <div className="text-sm text-accent font-semibold">
                            <CurrencyDisplay value={trans.totalAmount} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => printReceipt(trans)}
                            className="px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-border"
                            title="چاپ رسید"
                          >
                            چاپ
                          </button>
                          <button
                            onClick={() => handleEditTransaction(trans)}
                            className="p-2 text-accent hover:bg-accent/10 rounded"
                            title="ویرایش"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => setDeleteTransactionConfirm({ isOpen: true, transaction: trans })}
                            className="p-2 text-danger hover:bg-danger/10 rounded"
                            title="حذف"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )}

            {/* New/Edit Item Form */}
            {(showNewItemForm || editingItem) && (
              <Card title={editingItem ? 'ویرایش کالا' : 'افزودن کالای جدید'}>
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
                        {allPOSCategories.map(cat => (
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

                  {/* Customizations */}
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-medium text-primary">گزینه‌ها</label>
                      <button
                        onClick={handleAddCustomization}
                        className="px-3 py-1.5 text-sm bg-accent/10 text-accent rounded-lg hover:bg-accent/20"
                      >
                        + افزودن گزینه
                      </button>
                    </div>
                    <div className="space-y-4">
                      {newItemCustomizations.map((cust, custIdx) => (
                        <div key={cust.id} className="p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-2 mb-3">
                            <input
                              type="text"
                              placeholder="نام گزینه (مثال: نوع قهوه)"
                              value={cust.name}
                              onChange={(e) => handleUpdateCustomization(custIdx, { name: e.target.value })}
                              className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-sm"
                            />
                            <button
                              onClick={() => handleRemoveCustomization(custIdx)}
                              className="px-2 py-1.5 bg-danger/10 text-danger rounded text-sm"
                            >
                              حذف
                            </button>
                          </div>
                          <div className="space-y-2">
                            {cust.options?.map((opt, optIdx) => (
                              <div key={opt.id} className="flex items-center gap-2 p-2 bg-surface rounded border border-border/50">
                                <input
                                  type="text"
                                  placeholder="برچسب"
                                  value={opt.label}
                                  onChange={(e) => {
                                    const newOptions = [...(cust.options || [])];
                                    newOptions[optIdx] = { ...opt, label: e.target.value };
                                    handleUpdateCustomization(custIdx, { options: newOptions });
                                  }}
                                  className="flex-1 px-2 py-1 bg-background border border-border rounded text-xs"
                                />
                                <input
                                  type="number"
                                  placeholder="قیمت"
                                  value={opt.price || ''}
                                  onChange={(e) => {
                                    const newOptions = [...(cust.options || [])];
                                    newOptions[optIdx] = { ...opt, price: parseFloat(e.target.value) || 0 };
                                    handleUpdateCustomization(custIdx, { options: newOptions });
                                  }}
                                  className="w-24 px-2 py-1 bg-background border border-border rounded text-xs"
                                />
                                <label className="flex items-center gap-1 text-xs text-secondary">
                                  <input
                                    type="checkbox"
                                    checked={opt.isCustomAmount || false}
                                    onChange={(e) => {
                                      const newOptions = [...(cust.options || [])];
                                      newOptions[optIdx] = { ...opt, isCustomAmount: e.target.checked };
                                      handleUpdateCustomization(custIdx, { options: newOptions });
                                    }}
                                  />
                                  سفارشی
                                </label>
                                {opt.isCustomAmount && (
                                  <>
                                    <input
                                      type="text"
                                      placeholder="واحد"
                                      value={opt.unit || ''}
                                      onChange={(e) => {
                                        const newOptions = [...(cust.options || [])];
                                        newOptions[optIdx] = { ...opt, unit: e.target.value };
                                        handleUpdateCustomization(custIdx, { options: newOptions });
                                      }}
                                      className="w-16 px-2 py-1 bg-background border border-border rounded text-xs"
                                    />
                                    <input
                                      type="number"
                                      placeholder="قیمت/واحد"
                                      value={opt.pricePerUnit || ''}
                                      onChange={(e) => {
                                        const newOptions = [...(cust.options || [])];
                                        newOptions[optIdx] = { ...opt, pricePerUnit: parseFloat(e.target.value) || 0 };
                                        handleUpdateCustomization(custIdx, { options: newOptions });
                                      }}
                                      className="w-20 px-2 py-1 bg-background border border-border rounded text-xs"
                                    />
                                  </>
                                )}
                                <button
                                  onClick={() => handleRemoveOptionFromCustomization(custIdx, opt.id)}
                                  className="px-2 py-1 bg-danger/10 text-danger rounded text-xs"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newOption: POSCustomizationOption = {
                                  id: `opt-${Date.now()}-${Math.random()}`,
                                  label: '',
                                  price: 0,
                                };
                                handleAddOptionToCustomization(custIdx, newOption);
                              }}
                              className="w-full px-2 py-1.5 text-xs bg-accent/5 text-accent rounded border border-accent/20 hover:bg-accent/10"
                            >
                              + افزودن انتخاب
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        setShowNewItemForm(false);
                        setEditingItem(null);
                        setNewItemForm({ name: '', category: '', sellPrice: 0 });
                        setNewItemCustomizations([]);
                      }}
                      className="flex-1 px-4 py-2 bg-surface border border-border text-primary font-medium rounded-lg hover:bg-border"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={editingItem ? handleUpdatePOSItem : handleAddNewPOSItem}
                      className="flex-1 px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90"
                    >
                      {editingItem ? 'ذخیره تغییرات' : 'افزودن کالا'}
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT: CART & PAYMENT (1 column) */}
          <div className="lg:col-span-1 space-y-4 sticky top-4 h-fit">
            <Card title={`سبد خرید (${cartArray.length})`} className="bg-accent/5">
              <div className="space-y-2 max-h-[400px] overflow-y-auto border-b border-border pb-3">
                {cartArray.length === 0 ? (
                  <p className="text-center text-secondary py-8">سبد خرید خالی است</p>
                ) : (
                  cartArray.map((item, idx) => {
                    const cartKey = Array.from(cart.keys())[idx];
                    return (
                      <div key={cartKey} className="bg-surface p-3 rounded-lg border border-border">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-primary text-sm">{item.name}</p>
                            <CurrencyDisplay value={item.unitPrice} className="text-xs text-secondary" />
                          </div>
                          <button
                            onClick={() => handleRemoveFromCart(cartKey)}
                            className="text-danger hover:text-danger/80 transition-colors p-1"
                          >
                            <XIcon />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 bg-background rounded-lg p-1">
                            <button
                              onClick={() => handleUpdateCartQuantity(cartKey, item.quantity - 1)}
                              className="p-1 hover:bg-border rounded transition-colors"
                            >
                              <MinusIcon />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateCartQuantity(cartKey, item.quantity + 1)}
                              className="p-1 hover:bg-border rounded transition-colors"
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
              <Card title="پرداخت">
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

                  {editingTransaction ? (
                    <div className="space-y-2">
                      <button
                        onClick={handleUpdateTransaction}
                        className="w-full px-4 py-3 bg-accent text-accent-text font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-lg"
                      >
                        <CheckIcon />
                        به‌روزرسانی فروش
                      </button>
                      <button
                        onClick={() => {
                          setEditingTransaction(null);
                          setCart(new Map());
                          setDiscountAmount(0);
                        }}
                        className="w-full px-4 py-2 bg-surface border border-border text-primary rounded-lg hover:bg-border"
                      >
                        انصراف
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleCompleteSale}
                      disabled={cartArray.length === 0}
                      className="w-full px-4 py-4 bg-success text-success-text font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                    >
                      <CheckIcon />
                      تایید و ثبت فروش
                    </button>
                  )}
                  <p className="text-xs text-secondary text-center">Enter برای ثبت سریع</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Customization Modal */}
      {modalItem && (() => {
        let calculatedPrice = calculateItemPrice(modalItem, modalCustomizations, modalVariantId);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-background rounded-lg p-6 border border-border max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-primary">سفارشی‌سازی: {modalItem.name}</h3>
                <button onClick={closeModal} className="text-secondary hover:text-primary text-2xl">×</button>
              </div>

              <div className="space-y-4">
                {modalItem.variants && modalItem.variants.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-primary block mb-2">ورژن</label>
                    <select
                      value={modalVariantId || ''}
                      onChange={e => setModalVariantId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                    >
                      {modalItem.variants.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} {v.priceModifier !== 0 ? `(${v.priceModifier > 0 ? '+' : ''}${v.priceModifier.toLocaleString()})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {modalItem.customizations && modalItem.customizations.length > 0 && (
                  <div className="space-y-4">
                    {modalItem.customizations.map(cust => {
                      if (cust.options && cust.options.length > 0) {
                        const selectedOption = cust.options.find(opt =>
                          opt.label === String(modalCustomizations[cust.name]) ||
                          opt.id === String(modalCustomizations[cust.name])
                        );
                        const hasCustomAmount = selectedOption?.isCustomAmount;

                        return (
                          <div key={cust.id}>
                            <label className="text-sm font-medium text-primary block mb-2">{cust.name}</label>
                            <div className="space-y-2">
                              {cust.options.map(opt => (
                                <label key={opt.id} className="flex items-center gap-2 p-3 bg-surface rounded border border-border hover:bg-border cursor-pointer">
                                  <input
                                    type="radio"
                                    name={cust.id}
                                    checked={modalCustomizations[cust.name] === opt.label || modalCustomizations[cust.name] === opt.id}
                                    onChange={() => {
                                      if (opt.isCustomAmount) {
                                        setModalCustomizations(prev => ({ ...prev, [cust.name]: 0 }));
                                      } else {
                                        setModalCustomizations(prev => ({ ...prev, [cust.name]: opt.label }));
                                      }
                                    }}
                                  />
                                  <span className="flex-1 text-sm">{opt.label}</span>
                                  <span className="text-xs text-accent font-medium">
                                    {opt.price > 0 ? `+${opt.price.toLocaleString()}` : opt.price < 0 ? opt.price.toLocaleString() : ''}
                                  </span>
                                </label>
                              ))}
                              {hasCustomAmount && selectedOption && (
                                <div className="flex items-center gap-2 p-2 bg-accent/5 rounded border border-accent/20">
                                  <input
                                    type="number"
                                    placeholder={`مقدار (${selectedOption.unit || ''})`}
                                    value={typeof modalCustomizations[cust.name] === 'number' ? modalCustomizations[cust.name] : ''}
                                    onChange={e => setModalCustomizations(prev => ({ ...prev, [cust.name]: parseFloat(e.target.value) || 0 }))}
                                    className="flex-1 px-2 py-1.5 bg-surface border border-border rounded text-sm"
                                  />
                                  <span className="text-xs text-secondary">
                                    {selectedOption.pricePerUnit ? `× ${selectedOption.pricePerUnit.toLocaleString()} = ${((typeof modalCustomizations[cust.name] === 'number' ? (modalCustomizations[cust.name] as number) : 0) * selectedOption.pricePerUnit).toLocaleString()}` : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={cust.id}>
                            <label className="text-sm font-medium text-primary block mb-2">
                              {cust.name} {(cust.priceModifier ?? 0) !== 0 && `(${(cust.priceModifier ?? 0) > 0 ? '+' : ''}${(cust.priceModifier ?? 0).toLocaleString()})`}
                            </label>
                            <input
                              type="number"
                              value={String(modalCustomizations[cust.name] || 0)}
                              onChange={e => setModalCustomizations(prev => ({ ...prev, [cust.name]: parseFloat(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                            />
                          </div>
                        );
                      }
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <label className="text-sm font-medium text-primary">تعداد</label>
                  <input
                    type="number"
                    min="1"
                    value={modalQty}
                    onChange={e => setModalQty(parseInt(e.target.value, 10) || 1)}
                    className="w-20 px-2 py-1.5 bg-surface border border-border rounded-lg"
                  />
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-primary">قیمت نهایی:</span>
                    <CurrencyDisplay value={calculatedPrice} className="text-lg font-bold text-accent" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 bg-surface border border-border text-primary font-medium rounded-lg hover:bg-border"
                    >
                      انصراف
                    </button>
                    <button
                      onClick={confirmModalAdd}
                      className="flex-1 px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90"
                    >
                      افزودن به سبد
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Item Confirmation */}
      <ConfirmModal
        isOpen={deleteItemConfirm.isOpen}
        onClose={() => setDeleteItemConfirm({ isOpen: false, item: null })}
        onConfirm={() => deleteItemConfirm.item && handleDeletePOSItem(deleteItemConfirm.item)}
        title="حذف کالا"
        message={deleteItemConfirm.item ? `آیا از حذف "${deleteItemConfirm.item.name}" مطمئن هستید؟` : ''}
        variant="danger"
      />

      {/* Delete Transaction Confirmation */}
      <ConfirmModal
        isOpen={deleteTransactionConfirm.isOpen}
        onClose={() => setDeleteTransactionConfirm({ isOpen: false, transaction: null })}
        onConfirm={() => deleteTransactionConfirm.transaction && handleDeleteTransaction(deleteTransactionConfirm.transaction)}
        title="حذف فروش"
        message={deleteTransactionConfirm.transaction ? `آیا از حذف این فروش مطمئن هستید؟` : ''}
        variant="danger"
      />
    </>
  );
};

export default SellDashboard;
