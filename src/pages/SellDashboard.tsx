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
  const { posItems, getPOSItemsByCategory, getFrequentPOSItems, addSellTransaction, addPOSItem, updatePOSItem, deletePOSItem, updateSellTransaction, deleteSellTransaction, addPOSCategory, posCategories: storePosCategories } = store;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<Map<string, { posItemId: string; name: string; quantity: number; unitPrice: number; customizations: Record<string, string | number | { optionId: string; amount: number }> }>>(new Map());
  const [itemSearch, setItemSearch] = useState<string>('');
  const [rushMode, setRushMode] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Customization modal state
  const [modalItem, setModalItem] = useState<POSItem | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalVariantId, setModalVariantId] = useState<string | undefined>(undefined);
  const [modalCustomizations, setModalCustomizations] = useState<Record<string, string | number | { optionId: string; amount: number }>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', category: '', sellPrice: 0 });
  const [editingItem, setEditingItem] = useState<POSItem | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SellTransaction | null>(null);
  const [deleteTransactionConfirm, setDeleteTransactionConfirm] = useState<string | null>(null);
  const { addToast } = useToast();
  const { setActions } = usePageActions();

  // Get POS categories - use separate POS categories from store
  const posCategories = useMemo(() => {
    const cats = new Set<string>();
    posItems.forEach(item => cats.add(item.category));
    // Add POS-specific categories from the store
    storePosCategories.forEach(cat => cats.add(cat));
    return Array.from(cats).sort();
  }, [posItems, storePosCategories]);


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

  const handleAddToCart = (posItem: POSItem, opts?: { variantId?: string; customizations?: Record<string, string | number | { optionId: string; amount: number }>; quantity?: number }) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const key = opts && (opts.variantId || Object.keys(opts.customizations || {}).length > 0)
        ? `${posItem.id}::${opts.variantId || ''}::${JSON.stringify(opts.customizations || {})}`
        : posItem.id;

      const existing = newCart.get(key);
      const variant = opts?.variantId ? (posItem.variants || []).find(v => v.id === opts.variantId) : undefined;

      // Calculate price from global customizations
      const globalCustomizationPrice = (opts?.customizations && Object.keys(opts.customizations).length > 0 && posItem.customizations)
        ? Object.entries(opts!.customizations!).reduce((s, [k, v]) => {
            const cust = posItem.customizations!.find(c => c.name === k);
            if (!cust) return s;

            // If customization has options, find the selected option
            if (cust.options && cust.options.length > 0) {
              const optionId = typeof v === 'string' ? v : (typeof v === 'object' && v !== null && 'optionId' in v ? (v as { optionId: string }).optionId : String(v));
              const selectedOption = cust.options.find(opt => opt.id === optionId);
              if (selectedOption) {
                // If it's a custom amount option, calculate based on amount
                if (selectedOption.isCustomAmount && selectedOption.pricePerUnit && typeof v === 'object' && v !== null && 'amount' in v) {
                  const amount = (v as { amount: number }).amount || 0;
                  return s + (selectedOption.pricePerUnit * amount);
                }
                return s + selectedOption.price;
              }
            }

            // Fallback to priceModifier for legacy customizations
            return s + (cust?.priceModifier || 0) * (typeof v === 'number' ? Number(v) : 1);
          }, 0)
        : 0;

      // Calculate price from variant-specific customizations
      const variantCustomizationPrice = (variant && opts?.customizations && Object.keys(opts.customizations).length > 0 && variant.customizations)
        ? Object.entries(opts!.customizations!).reduce((s, [k, v]) => {
            const cust = variant.customizations!.find(c => c.name === k);
            if (!cust) return s;

            // If customization has options, find the selected option
            if (cust.options && cust.options.length > 0) {
              const optionId = typeof v === 'string' ? v : (typeof v === 'object' && v !== null && 'optionId' in v ? (v as { optionId: string }).optionId : String(v));
              const selectedOption = cust.options.find(opt => opt.id === optionId);
              if (selectedOption) {
                // If it's a custom amount option, calculate based on amount
                if (selectedOption.isCustomAmount && selectedOption.pricePerUnit && typeof v === 'object' && v !== null && 'amount' in v) {
                  const amount = (v as { amount: number }).amount || 0;
                  return s + (selectedOption.pricePerUnit * amount);
                }
                return s + selectedOption.price;
              }
            }

            // Fallback to priceModifier for legacy customizations
            return s + (cust?.priceModifier || 0) * (typeof v === 'number' ? Number(v) : 1);
          }, 0)
        : 0;

      const unitPrice = posItem.sellPrice + (variant ? variant.priceModifier : 0) + globalCustomizationPrice + variantCustomizationPrice;

      // Build display name with variant and customizations
      let displayName = posItem.name;
      if (variant) {
        displayName += ` (${variant.name})`;
      }
      if (opts?.customizations && Object.keys(opts.customizations).length > 0) {
        const custParts: string[] = [];
        Object.entries(opts.customizations).forEach(([custName, custValue]) => {
          const cust = posItem.customizations?.find(c => c.name === custName);
          if (cust && cust.options) {
            if (typeof custValue === 'object' && 'optionId' in custValue) {
              const opt = cust.options.find(o => o.id === custValue.optionId);
              if (opt) {
                let optLabel = opt.label;
                if (opt.isCustomAmount && custValue.amount) {
                  optLabel += ` ${custValue.amount}${opt.unit || ''}`;
                }
                custParts.push(optLabel);
              }
            } else if (typeof custValue === 'string') {
              const opt = cust.options.find(o => o.id === custValue);
              if (opt) {
                custParts.push(opt.label);
              }
            }
          } else if (custValue) {
            custParts.push(`${custName}: ${custValue}`);
          }
        });
        if (custParts.length > 0) {
          displayName += ` [${custParts.join(', ')}]`;
        }
      }

      if (existing) {
        existing.quantity += opts?.quantity || 1;
        existing.unitPrice = unitPrice; // update to latest price
        existing.name = displayName; // update name in case customizations changed
      } else {
        newCart.set(key, {
          posItemId: posItem.id,
          name: displayName,
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

  const handleUpdateCartQuantity = (cartKey: string, quantity: number) => {
    setCart(prev => {
      const newCart = new Map(prev);
      if (quantity <= 0) {
        newCart.delete(cartKey);
      } else {
        const item = newCart.get(cartKey);
        if (item) {
          item.quantity = quantity;
        }
      }
      return newCart;
    });
  };

  const handleRemoveFromCart = (cartKey: string) => {
    setCart(prev => {
      const newCart = new Map(prev);
      newCart.delete(cartKey);
      return newCart;
    });
  };

  const printReceipt = (transaction: SellTransaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('دسترسی به چاپ رد شد', 'error');
      return;
    }

    const itemsHtml = transaction.items.map(item => `
      <tr>
        <td style="padding: 0.5rem; border: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${item.unitPrice.toLocaleString()}</td>
        <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;">${item.totalPrice.toLocaleString()}</td>
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
        <p style="text-align: center;">تاریخ: ${toJalaliDateString(transaction.date)}</p>
        <p style="text-align: center;">شماره فاکتور: ${transaction.id.slice(-8)}</p>
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
          مجموع کل: ${transaction.totalAmount.toLocaleString()} تومان
          ${transaction.discountAmount ? `<br>تخفیف: ${transaction.discountAmount.toLocaleString()} تومان` : ''}
          <br>روش پرداخت: ${transaction.paymentMethod}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
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
    setCart(new Map());
    setDiscountAmount(0);
    addToast('فروش ثبت شد', 'success');

    // Auto-print receipt
    if (transactionId) {
      setTimeout(() => {
        const newTrans = store.sellTransactions.find(t => t.id === transactionId);
        if (newTrans) {
          printReceipt(newTrans);
        }
      }, 500);
    }
  };

  // New POS item creation supports variants and customizations
  const [newItemVariants, setNewItemVariants] = useState<{
    id: string;
    name: string;
    priceModifier: number;
    customizations?: {
      id: string;
      name: string;
      type: 'select' | 'number' | 'text';
      options?: { id: string; label: string; price: number; isCustomAmount?: boolean; unit?: string; pricePerUnit?: number }[];
      priceModifier?: number;
    }[];
  }[]>([]);
  const [newItemCustomizations, setNewItemCustomizations] = useState<{
    id: string;
    name: string;
    type: 'select' | 'number' | 'text';
    options?: { id: string; label: string; price: number; isCustomAmount?: boolean; unit?: string; pricePerUnit?: number }[];
    priceModifier?: number;
  }[]>([]);

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
      variants: newItemVariants.map(v => ({
        id: v.id,
        name: v.name,
        priceModifier: v.priceModifier,
        customizations: v.customizations?.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          options: c.options?.map(opt => ({
            id: opt.id,
            label: opt.label,
            price: opt.price,
            isCustomAmount: opt.isCustomAmount,
            unit: opt.unit,
            pricePerUnit: opt.pricePerUnit
          })),
          priceModifier: c.priceModifier
        }))
      })),
      customizations: newItemCustomizations.length > 0 ? newItemCustomizations.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        options: c.options?.map(opt => ({
          id: opt.id,
          label: opt.label,
          price: opt.price,
          isCustomAmount: opt.isCustomAmount,
          unit: opt.unit,
          pricePerUnit: opt.pricePerUnit
        })),
        priceModifier: c.priceModifier
      })) : undefined,
    };

    addPOSItem(payload);

    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemVariants([]);
    setNewItemCustomizations([]);
    setShowNewItemForm(false);
    addToast('کالای جدید اضافه شد', 'success');
  };

  const handleEditItem = (item: POSItem) => {
    setEditingItem(item);
    setNewItemForm({ name: item.name, category: item.category, sellPrice: item.sellPrice });
    setNewItemVariants(item.variants?.map(v => ({
      id: v.id,
      name: v.name,
      priceModifier: v.priceModifier,
      customizations: v.customizations?.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        options: c.options?.map(opt => ({
          id: opt.id,
          label: opt.label,
          price: opt.price,
          isCustomAmount: opt.isCustomAmount,
          unit: opt.unit,
          pricePerUnit: opt.pricePerUnit
        })),
        priceModifier: c.priceModifier || 0
      }))
    })) || []);
    setNewItemCustomizations(item.customizations?.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      options: c.options?.map(opt => ({
        id: opt.id,
        label: opt.label,
        price: opt.price,
        isCustomAmount: opt.isCustomAmount,
        unit: opt.unit,
        pricePerUnit: opt.pricePerUnit
      })),
      priceModifier: c.priceModifier || 0
    })) || []);
    setShowNewItemForm(true);
    // Scroll to form
    setTimeout(() => {
      const formElement = document.querySelector('[data-item-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleUpdatePOSItem = () => {
    if (!editingItem || !newItemForm.name || !newItemForm.category || newItemForm.sellPrice <= 0) {
      addToast('لطفاً تمام فیلدها را پر کنید', 'error');
      return;
    }

    updatePOSItem(editingItem.id, {
      name: newItemForm.name,
      category: newItemForm.category,
      sellPrice: newItemForm.sellPrice,
      variants: newItemVariants.map(v => ({
        id: v.id,
        name: v.name,
        priceModifier: v.priceModifier,
        customizations: v.customizations?.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          options: c.options?.map(opt => ({
            id: opt.id,
            label: opt.label,
            price: opt.price,
            isCustomAmount: opt.isCustomAmount,
            unit: opt.unit,
            pricePerUnit: opt.pricePerUnit
          })),
          priceModifier: c.priceModifier
        }))
      })),
      customizations: newItemCustomizations.length > 0 ? newItemCustomizations.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        options: c.options?.map(opt => ({
          id: opt.id,
          label: opt.label,
          price: opt.price,
          isCustomAmount: opt.isCustomAmount,
          unit: opt.unit,
          pricePerUnit: opt.pricePerUnit
        })),
        priceModifier: c.priceModifier
      })) : undefined,
    });

    setEditingItem(null);
    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemVariants([]);
    setNewItemCustomizations([]);
    setShowNewItemForm(false);
    addToast('کالا به‌روزرسانی شد', 'success');
  };

  const handleDeletePOSItem = (itemId: string) => {
    deletePOSItem(itemId);
    setDeleteItemConfirm(null);
    addToast('کالا حذف شد', 'success');
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
                    addPOSCategory(val);
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
            <Card
              title={`${selectedCategory || 'همه'} (${currentCategoryItems.length})`}
              className="animate-fade-in"
              actions={
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setNewItemForm({ name: '', category: selectedCategory || '', sellPrice: 0 });
                    setNewItemVariants([]);
                    setNewItemCustomizations([]);
                    setShowNewItemForm(true);
                  }}
                  variant="primary"
                  size="sm"
                >
                  + افزودن کالا
                </Button>
              }
            >
              {currentCategoryItems.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-secondary text-lg mb-4">هیچ کالایی در این دسته وجود ندارد</p>
                  <Button
                    onClick={() => {
                      setEditingItem(null);
                      setNewItemForm({ name: '', category: selectedCategory || '', sellPrice: 0 });
                      setNewItemVariants([]);
                      setNewItemCustomizations([]);
                      setShowNewItemForm(true);
                    }}
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
                      <div
                        key={item.id}
                        className="relative group animate-fade-in"
                        style={{ animationDelay: `${idx * 20}ms` }}
                      >
                        <button
                          onClick={() => {
                            if (item.variants && item.variants.length > 0) {
                              openCustomizationModal(item);
                            } else {
                              handleAddToCart(item);
                            }
                          }}
                          className={`w-full p-4 rounded-lg border-2 transition-all text-center hover-lift ${
                            inCart
                              ? 'bg-accent/20 border-accent shadow-lg scale-105'
                              : 'bg-surface border-border hover:border-accent hover:bg-accent/5'
                          }`}
                        >
                          <div className="font-bold text-base text-primary mb-1 truncate">{item.name}</div>
                          <div className="text-sm text-accent font-semibold"><CurrencyDisplay value={item.sellPrice} /></div>
                          {inCart && (
                            <div className="text-xs text-accent mt-1">
                              {cartArray.filter(c => c.posItemId === item.id).reduce((sum, c) => sum + c.quantity, 0)}×
                            </div>
                          )}
                        </button>
                        {/* Edit/Delete buttons - show on hover */}
                        <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditItem(item);
                            }}
                            className="p-1.5 bg-accent/90 text-accent-text rounded hover:bg-accent transition-colors"
                            title="ویرایش"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteItemConfirm(item.id);
                            }}
                            className="p-1.5 bg-danger/90 text-white rounded hover:bg-danger transition-colors"
                            title="حذف"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* New/Edit Item Form */}
            {showNewItemForm && (
              <Card title={editingItem ? "ویرایش کالا" : "افزودن کالای جدید"} className="animate-fade-in" data-item-form>
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

                  {/* CUSTOMIZATIONS EDITOR */}
                  <div className="mt-4">
                    <label className="text-sm font-medium text-primary block mb-2">
                      سفارشی‌سازی‌ها (اختیاری)
                      <span className="text-xs text-secondary block mt-1">مثال: نوع قهوه، شربت، سفارش بیرون‌بر/کافه</span>
                    </label>
                    <div className="space-y-4">
                      {newItemCustomizations.map((cust, custIdx) => (
                        <div key={cust.id} className="p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <input
                                value={cust.name}
                                onChange={e => setNewItemCustomizations(prev => prev.map((c, i) => i === custIdx ? { ...c, name: e.target.value } : c))}
                                className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                                placeholder="نام سفارشی‌سازی (مثال: نوع قهوه)"
                              />
                            </div>
                            <select
                              value={cust.type}
                              onChange={e => setNewItemCustomizations(prev => prev.map((c, i) => i === custIdx ? { ...c, type: e.target.value as 'select' | 'number' | 'text' } : c))}
                              className="ml-2 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="select">انتخابی</option>
                              <option value="number">عدد</option>
                              <option value="text">متن</option>
                            </select>
                            <Button variant="danger" size="sm" onClick={() => setNewItemCustomizations(prev => prev.filter((_, i) => i !== custIdx))} className="ml-2">
                              حذف
                            </Button>
                          </div>

                          {/* Options for select type */}
                          {cust.type === 'select' && (
                            <div className="mt-3 space-y-2">
                              <label className="text-xs text-secondary block mb-1">گزینه‌ها:</label>
                              {cust.options?.map((opt, optIdx) => (
                                <div key={opt.id} className="flex gap-2 items-center">
                                  <input
                                    value={opt.label}
                                    onChange={e => setNewItemCustomizations(prev => prev.map((c, i) =>
                                      i === custIdx ? {
                                        ...c,
                                        options: c.options?.map((o, oi) => oi === optIdx ? { ...o, label: e.target.value } : o) || []
                                      } : c
                                    ))}
                                    className="flex-1 px-2 py-1 bg-surface border border-border rounded text-sm"
                                    placeholder="برچسب (مثال: 8/20 Robusta)"
                                  />
                                  <input
                                    type="number"
                                    value={String(opt.price)}
                                    onChange={e => setNewItemCustomizations(prev => prev.map((c, i) =>
                                      i === custIdx ? {
                                        ...c,
                                        options: c.options?.map((o, oi) => oi === optIdx ? { ...o, price: parseFloat(e.target.value) || 0 } : o) || []
                                      } : c
                                    ))}
                                    className="w-24 px-2 py-1 bg-surface border border-border rounded text-sm"
                                    placeholder="قیمت"
                                  />
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={opt.isCustomAmount || false}
                                      onChange={e => setNewItemCustomizations(prev => prev.map((c, i) =>
                                        i === custIdx ? {
                                          ...c,
                                          options: c.options?.map((o, oi) => oi === optIdx ? { ...o, isCustomAmount: e.target.checked } : o) || []
                                        } : c
                                      ))}
                                    />
                                    مقدار سفارشی
                                  </label>
                                  {opt.isCustomAmount && (
                                    <>
                                      <input
                                        value={opt.unit || ''}
                                        onChange={e => setNewItemCustomizations(prev => prev.map((c, i) =>
                                          i === custIdx ? {
                                            ...c,
                                            options: c.options?.map((o, oi) => oi === optIdx ? { ...o, unit: e.target.value } : o) || []
                                          } : c
                                        ))}
                                        className="w-16 px-2 py-1 bg-surface border border-border rounded text-sm"
                                        placeholder="واحد"
                                      />
                                      <input
                                        type="number"
                                        value={String(opt.pricePerUnit || '')}
                                        onChange={e => setNewItemCustomizations(prev => prev.map((c, i) =>
                                          i === custIdx ? {
                                            ...c,
                                            options: c.options?.map((o, oi) => oi === optIdx ? { ...o, pricePerUnit: parseFloat(e.target.value) || 0 } : o) || []
                                          } : c
                                        ))}
                                        className="w-24 px-2 py-1 bg-surface border border-border rounded text-sm"
                                        placeholder="قیمت/واحد"
                                      />
                                    </>
                                  )}
                                  <Button variant="danger" size="sm" onClick={() => setNewItemCustomizations(prev => prev.map((c, i) =>
                                    i === custIdx ? {
                                      ...c,
                                      options: c.options?.filter((_, oi) => oi !== optIdx) || []
                                    } : c
                                  ))}>
                                    ×
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const newOptId = `opt-${Date.now()}-${Math.random()}`;
                                  setNewItemCustomizations(prev => prev.map((c, i) =>
                                    i === custIdx ? {
                                      ...c,
                                      options: [...(c.options || []), { id: newOptId, label: '', price: 0 }]
                                    } : c
                                  ));
                                }}
                              >
                                + افزودن گزینه
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setNewItemCustomizations(prev => [...prev, {
                            id: `cust-${Date.now()}-${Math.random()}`,
                            name: '',
                            type: 'select',
                            options: []
                          }]);
                        }}
                      >
                        + افزودن سفارشی‌سازی
                      </Button>
                    </div>
                  </div>

                  {/* VARIANTS EDITOR */}
                  <div className="mt-4">
                    <label className="text-sm font-medium text-primary block mb-2">
                      ورژن‌های آماده (اختیاری)
                      <span className="text-xs text-secondary block mt-1">مثال: قهوه (با گزینه‌های خطوط قهوه، دکاف)، شربت (با گزینه‌های نوع و مقدار)</span>
                    </label>
                    <div className="space-y-4">
                      {newItemVariants.map((v, idx) => (
                        <div key={v.id} className="p-4 bg-background rounded-lg border-2 border-border">
                          <div className="flex gap-2 items-center mb-3">
                            <input
                              value={v.name}
                              onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p))}
                              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                              placeholder="نام ورژن (مثال: قهوه)"
                            />
                            <input
                              type="number"
                              value={String(v.priceModifier)}
                              onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? { ...p, priceModifier: parseFloat(e.target.value) || 0 } : p))}
                              className="w-32 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                              placeholder="تغییر قیمت"
                            />
                            <Button variant="danger" size="sm" onClick={() => setNewItemVariants(prev => prev.filter((_, i) => i !== idx))}>
                              حذف ورژن
                            </Button>
                          </div>

                          {/* Variant-specific customizations */}
                          <div className="mt-3 pt-3 border-t border-border">
                            <label className="text-xs font-medium text-secondary block mb-2">
                              سفارشی‌سازی‌های این ورژن (مثال: برای قهوه: خطوط قهوه، دکاف/عادی)
                            </label>
                            <div className="space-y-3">
                              {(v.customizations || []).map((cust, custIdx) => (
                                <div key={cust.id} className="p-2 bg-surface rounded border border-border">
                                  <div className="flex items-center justify-between mb-2">
                                    <input
                                      value={cust.name}
                                      onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                        ...p,
                                        customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? { ...c, name: e.target.value } : c)
                                      } : p))}
                                      className="flex-1 px-2 py-1 bg-background border border-border rounded text-sm"
                                      placeholder="نام (مثال: خطوط قهوه)"
                                    />
                                    <select
                                      value={cust.type}
                                      onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                        ...p,
                                        customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? { ...c, type: e.target.value as 'select' | 'number' | 'text' } : c)
                                      } : p))}
                                      className="ml-2 px-2 py-1 bg-background border border-border rounded text-sm"
                                    >
                                      <option value="select">انتخابی</option>
                                      <option value="number">عدد</option>
                                      <option value="text">متن</option>
                                    </select>
                                    <Button variant="danger" size="sm" onClick={() => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                      ...p,
                                      customizations: (p.customizations || []).filter((_, ci) => ci !== custIdx)
                                    } : p))} className="ml-2">
                                      ×
                                    </Button>
                                  </div>

                                  {/* Options for select type */}
                                  {cust.type === 'select' && (
                                    <div className="mt-2 space-y-1">
                                      {cust.options?.map((opt, optIdx) => (
                                        <div key={opt.id} className="flex gap-1 items-center text-xs">
                                          <input
                                            value={opt.label}
                                            onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                              ...p,
                                              customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                                ...c,
                                                options: c.options?.map((o, oi) => oi === optIdx ? { ...o, label: e.target.value } : o) || []
                                              } : c)
                                            } : p))}
                                            className="flex-1 px-2 py-1 bg-background border border-border rounded"
                                            placeholder="برچسب"
                                          />
                                          <input
                                            type="number"
                                            value={String(opt.price)}
                                            onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                              ...p,
                                              customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                                ...c,
                                                options: c.options?.map((o, oi) => oi === optIdx ? { ...o, price: parseFloat(e.target.value) || 0 } : o) || []
                                              } : c)
                                            } : p))}
                                            className="w-20 px-2 py-1 bg-background border border-border rounded"
                                            placeholder="قیمت"
                                          />
                                          <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                            <input
                                              type="checkbox"
                                              checked={opt.isCustomAmount || false}
                                              onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                                ...p,
                                                customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                                  ...c,
                                                  options: c.options?.map((o, oi) => oi === optIdx ? { ...o, isCustomAmount: e.target.checked } : o) || []
                                                } : c)
                                              } : p))}
                                            />
                                            سفارشی
                                          </label>
                                          {opt.isCustomAmount && (
                                            <>
                                              <input
                                                value={opt.unit || ''}
                                                onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                                  ...p,
                                                  customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                                    ...c,
                                                    options: c.options?.map((o, oi) => oi === optIdx ? { ...o, unit: e.target.value } : o) || []
                                                  } : c)
                                                } : p))}
                                                className="w-16 px-1 py-1 bg-background border border-border rounded text-xs"
                                                placeholder="واحد"
                                              />
                                              <input
                                                type="number"
                                                value={String(opt.pricePerUnit || '')}
                                                onChange={e => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                                  ...p,
                                                  customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                                    ...c,
                                                    options: c.options?.map((o, oi) => oi === optIdx ? { ...o, pricePerUnit: parseFloat(e.target.value) || 0 } : o) || []
                                                  } : c)
                                                } : p))}
                                                className="w-20 px-1 py-1 bg-background border border-border rounded text-xs"
                                                placeholder="قیمت/واحد"
                                              />
                                            </>
                                          )}
                                          <Button variant="danger" size="sm" onClick={() => setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                            ...p,
                                            customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                              ...c,
                                              options: c.options?.filter((_, oi) => oi !== optIdx) || []
                                            } : c)
                                          } : p))}>
                                            ×
                                          </Button>
                                        </div>
                                      ))}
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          const newOptId = `opt-${Date.now()}-${Math.random()}`;
                                          setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                            ...p,
                                            customizations: (p.customizations || []).map((c, ci) => ci === custIdx ? {
                                              ...c,
                                              options: [...(c.options || []), { id: newOptId, label: '', price: 0 }]
                                            } : c)
                                          } : p));
                                        }}
                                      >
                                        + افزودن گزینه
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const newCustId = `cust-${Date.now()}-${Math.random()}`;
                                  setNewItemVariants(prev => prev.map((p, i) => i === idx ? {
                                    ...p,
                                    customizations: [...(p.customizations || []), {
                                      id: newCustId,
                                      name: '',
                                      type: 'select',
                                      options: []
                                    }]
                                  } : p));
                                }}
                              >
                                + افزودن سفارشی‌سازی به این ورژن
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <input
                          id="new-variant-name"
                          placeholder="نام ورژن (مثال: قهوه، دوروپ)"
                          className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <input
                          id="new-variant-price"
                          type="number"
                          placeholder="تغییر قیمت (مثال: +5000 یا -2000)"
                          className="w-40 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            const nEl = document.getElementById('new-variant-name') as HTMLInputElement | null;
                            const pEl = document.getElementById('new-variant-price') as HTMLInputElement | null;
                            if (!nEl) return;
                            const name = nEl.value.trim();
                            const price = pEl ? parseFloat(pEl.value) || 0 : 0;
                            if (!name) {
                              addToast('لطفاً نام ورژن را وارد کنید', 'error');
                              return;
                            }
                            setNewItemVariants(prev => [...prev, { id: `var-${Date.now()}-${Math.random()}`, name, priceModifier: price, customizations: [] }]);
                            nEl.value = '';
                            if (pEl) pEl.value = '';
                            addToast(`ورژن "${name}" اضافه شد`, 'success');
                          }}
                        >
                          + افزودن ورژن
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
                      onClick={editingItem ? handleUpdatePOSItem : handleAddNewPOSItem}
                      fullWidth
                    >
                      {editingItem ? 'به‌روزرسانی کالا' : 'افزودن کالا'}
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
                            onClick={() => handleRemoveFromCart(cartKey)}
                            className="text-danger hover:text-danger/80 transition-colors p-1 hover:bg-danger/10 rounded"
                            aria-label="حذف از سبد"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 bg-background rounded-lg p-1">
                            <button
                              onClick={() => handleUpdateCartQuantity(cartKey, item.quantity - 1)}
                              className="p-1 hover:bg-border rounded transition-colors"
                              aria-label="کاهش تعداد"
                            >
                              <MinusIcon />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateCartQuantity(cartKey, item.quantity + 1)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-background rounded-lg p-6 border border-border shadow-xl animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl text-primary">سفارشی‌سازی: {modalItem.name}</h3>
              <button
                onClick={closeModal}
                className="text-secondary hover:text-primary text-2xl leading-none"
                aria-label="بستن"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              {modalItem.variants && modalItem.variants.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-primary block mb-2">انتخاب ورژن</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setModalVariantId(undefined);
                        // Reset customizations when variant changes
                        setModalCustomizations({});
                      }}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm ${
                        !modalVariantId
                          ? 'bg-accent text-accent-text border-accent'
                          : 'bg-surface text-primary border-border hover:bg-border'
                      }`}
                    >
                      پایه
                    </button>
                    {modalItem.variants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => {
                          setModalVariantId(v.id);
                          // Reset customizations when variant changes
                          setModalCustomizations({});
                        }}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors text-sm ${
                          modalVariantId === v.id
                            ? 'bg-accent text-accent-text border-accent'
                            : 'bg-surface text-primary border-border hover:bg-border'
                        }`}
                      >
                        {v.name}
                        {v.priceModifier !== 0 && (
                          <span className="text-xs block mt-1">
                            {v.priceModifier > 0 ? '+' : ''}{v.priceModifier.toLocaleString()} ریال
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Variant-specific customizations */}
              {modalVariantId && modalItem.variants && (() => {
                const selectedVariant = modalItem.variants.find(v => v.id === modalVariantId);
                return selectedVariant?.customizations && selectedVariant.customizations.length > 0 ? (
                  <div className="space-y-4 pt-2 border-t border-border">
                    <label className="text-sm font-medium text-primary block">سفارشی‌سازی‌های {selectedVariant.name}</label>
                    {selectedVariant.customizations.map(c => (
                      <div key={c.id || c.name} className="space-y-2">
                        <label className="text-sm font-medium text-primary block">{c.name}</label>

                        {c.type === 'select' && c.options && c.options.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {c.options.map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => {
                                  const currentValue = modalCustomizations[c.name];
                                  if (opt.isCustomAmount) {
                                    // For custom amount options, show input
                                    const amount = typeof currentValue === 'object' && currentValue !== null && 'amount' in currentValue
                                      ? (currentValue as { amount: number }).amount
                                      : 0;
                                    const newAmount = prompt(`مقدار ${opt.unit || ''} را وارد کنید:`, String(amount));
                                    if (newAmount !== null) {
                                      const numAmount = parseFloat(newAmount) || 0;
                                      setModalCustomizations(prev => ({
                                        ...prev,
                                        [c.name]: { optionId: opt.id, amount: numAmount }
                                      }));
                                    }
                                  } else {
                                    setModalCustomizations(prev => ({
                                      ...prev,
                                      [c.name]: opt.id
                                    }));
                                  }
                                }}
                                className={`px-3 py-2 rounded-lg border-2 transition-colors text-sm ${
                                  (() => {
                                    const val = modalCustomizations[c.name];
                                    if (typeof val === 'string' && val === opt.id) return true;
                                    if (typeof val === 'object' && val !== null && 'optionId' in val) {
                                      return (val as { optionId: string }).optionId === opt.id;
                                    }
                                    return false;
                                  })()
                                    ? 'bg-accent text-accent-text border-accent'
                                    : 'bg-surface text-primary border-border hover:bg-border'
                                }`}
                              >
                                {opt.label}
                                {opt.price !== 0 && (
                                  <span className="text-xs block mt-1">
                                    {opt.price > 0 ? '+' : ''}{opt.price.toLocaleString()} ریال
                                    {opt.isCustomAmount && opt.pricePerUnit && (
                                      <span> ({opt.pricePerUnit.toLocaleString()} ریال/{opt.unit})</span>
                                    )}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : c.type === 'number' ? (
                          <input
                            type="number"
                            value={String(modalCustomizations[c.name] || 0)}
                            onChange={e => setModalCustomizations(prev => ({ ...prev, [c.name]: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        ) : (
                          <input
                            type="text"
                            value={String(modalCustomizations[c.name] || '')}
                            onChange={e => setModalCustomizations(prev => ({ ...prev, [c.name]: e.target.value }))}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Global customizations */}
              {modalItem.customizations && modalItem.customizations.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <label className="text-sm font-medium text-primary block">سفارشی‌سازی‌های عمومی</label>
                  {modalItem.customizations.map(c => (
                    <div key={c.id || c.name} className="space-y-2">
                      <label className="text-sm font-medium text-primary block">{c.name}</label>

                      {c.type === 'select' && c.options && c.options.length > 0 ? (
                        <div className="space-y-2">
                          {c.options.map(opt => {
                            const isSelected = modalCustomizations[c.name] === opt.id ||
                              (typeof modalCustomizations[c.name] === 'object' && (modalCustomizations[c.name] as any).optionId === opt.id);

                            return (
                              <div key={opt.id} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (opt.isCustomAmount) {
                                      // For custom amount, store option ID and allow amount input
                                      setModalCustomizations(prev => ({
                                        ...prev,
                                        [c.name]: { optionId: opt.id, amount: (prev[c.name] as any)?.amount || 0 }
                                      }));
                                    } else {
                                      // Regular option, just store the option ID
                                      setModalCustomizations(prev => ({ ...prev, [c.name]: opt.id }));
                                    }
                                  }}
                                  className={`w-full px-3 py-2 rounded-lg border-2 transition-colors text-sm text-right ${
                                    isSelected
                                      ? 'bg-accent text-accent-text border-accent'
                                      : 'bg-surface text-primary border-border hover:bg-border'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span>{opt.label}</span>
                                    {opt.price !== 0 && (
                                      <span className="text-xs">
                                        {opt.price > 0 ? '+' : ''}{opt.price.toLocaleString()} ریال
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {opt.isCustomAmount && isSelected && (() => {
                                  const customValue = modalCustomizations[c.name];
                                  const amount = typeof customValue === 'object' && customValue !== null && 'amount' in customValue
                                    ? (customValue as { amount: number }).amount
                                    : 0;
                                  return (
                                    <div className="flex gap-2 items-center mt-1 pr-2">
                                      <input
                                        type="number"
                                        value={String(amount)}
                                        onChange={e => setModalCustomizations(prev => ({
                                          ...prev,
                                          [c.name]: {
                                            optionId: opt.id,
                                            amount: parseFloat(e.target.value) || 0
                                          }
                                        }))}
                                        className="flex-1 px-2 py-1 bg-surface border border-border rounded text-sm"
                                        placeholder={`مقدار (${opt.unit || 'واحد'})`}
                                        min="0"
                                      />
                                      {opt.pricePerUnit && (
                                        <span className="text-xs text-secondary">
                                          {(opt.pricePerUnit * amount).toLocaleString()} ریال
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      ) : c.type === 'number' ? (
                        <input
                          type="number"
                          value={String(modalCustomizations[c.name] || 0)}
                          onChange={e => setModalCustomizations(prev => ({ ...prev, [c.name]: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="عدد"
                        />
                      ) : c.type === 'text' ? (
                        <input
                          type="text"
                          value={String(modalCustomizations[c.name] || '')}
                          onChange={e => setModalCustomizations(prev => ({ ...prev, [c.name]: e.target.value }))}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="متن"
                        />
                      ) : (
                        // Legacy: fallback to number input with priceModifier
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={String(modalCustomizations[c.name] || 0)}
                            onChange={e => setModalCustomizations(prev => ({ ...prev, [c.name]: parseFloat(e.target.value) || 0 }))}
                            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          {c.priceModifier && c.priceModifier !== 0 && (
                            <span className="text-xs text-secondary">
                              {(c.priceModifier * (Number(modalCustomizations[c.name]) || 0)).toLocaleString()} ریال
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
                <label className="text-sm font-medium text-primary">تعداد</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded hover:bg-border transition-colors"
                  >
                    <MinusIcon />
                  </button>
                  <input
                    type="number"
                    value={modalQty}
                    onChange={e => setModalQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 px-2 py-1 text-center bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    min="1"
                  />
                  <button
                    onClick={() => setModalQty(modalQty + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded hover:bg-border transition-colors"
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="secondary" onClick={closeModal}>
                  انصراف
                </Button>
                <Button variant="primary" onClick={confirmModalAdd}>
                  افزودن به سبد
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteItemConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-fade-in-down">
            <h3 className="text-lg font-bold text-primary mb-4">تایید حذف</h3>
            <p className="text-secondary mb-4">آیا مطمئن هستید که می‌خواهید این کالا را حذف کنید؟</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDeleteItemConfirm(null)} fullWidth>
                انصراف
              </Button>
              <Button variant="danger" onClick={() => handleDeletePOSItem(deleteItemConfirm)} fullWidth>
                حذف
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-primary">ویرایش فروش</h3>
              <button onClick={() => setEditingTransaction(null)} className="text-secondary hover:text-primary text-2xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-primary block mb-2">روش پرداخت</label>
                <div className="grid grid-cols-3 gap-2">
                  {[PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Transfer].map(method => (
                    <button
                      key={method}
                      onClick={() => updateSellTransaction(editingTransaction.id, { paymentMethod: method })}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                        editingTransaction.paymentMethod === method
                          ? 'bg-accent text-accent-text border-accent'
                          : 'bg-surface text-primary border-border hover:bg-border'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-primary block mb-2">تخفیف (ریال)</label>
                <input
                  type="number"
                  value={editingTransaction.discountAmount || 0}
                  onChange={(e) => {
                    const discount = parseFloat(e.target.value) || 0;
                    const newTotal = editingTransaction.items.reduce((sum, item) => sum + item.totalPrice, 0) - discount;
                    updateSellTransaction(editingTransaction.id, {
                      discountAmount: discount > 0 ? discount : undefined,
                      totalAmount: Math.max(0, newTotal)
                    });
                  }}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                />
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm text-secondary mb-2">اقلام:</p>
                <div className="space-y-2">
                  {editingTransaction.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-background rounded">
                      <span className="text-sm">{item.name} × {item.quantity}</span>
                      <CurrencyDisplay value={item.totalPrice} className="text-sm font-semibold" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between items-center pt-4 border-t border-border">
                  <span className="font-bold text-lg">جمع کل:</span>
                  <CurrencyDisplay value={editingTransaction.totalAmount} className="font-bold text-lg text-accent" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setEditingTransaction(null)} fullWidth>
                  بستن
                </Button>
                <Button variant="primary" onClick={() => printReceipt(editingTransaction)} fullWidth>
                  چاپ رسید
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Transaction Confirmation Modal */}
      {deleteTransactionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-fade-in-down">
            <h3 className="text-lg font-bold text-primary mb-4">تایید حذف</h3>
            <p className="text-secondary mb-4">آیا مطمئن هستید که می‌خواهید این فروش را حذف کنید؟</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setDeleteTransactionConfirm(null)} fullWidth>
                انصراف
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteSellTransaction(deleteTransactionConfirm);
                  setDeleteTransactionConfirm(null);
                  addToast('فروش حذف شد', 'success');
                }}
                fullWidth
              >
                حذف
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

const RecentTransactionsCard: React.FC<{
  store: any;
  onEdit?: (trans: SellTransaction) => void;
  onDelete?: (transId: string) => void;
  onPrint?: (trans: SellTransaction) => void;
}> = ({ store, onEdit, onDelete, onPrint }) => {
  const { sellTransactions } = store as { sellTransactions: SellTransaction[] };
  const recentTransactions = sellTransactions.slice(-10).reverse();

  return (
    <Card title={`آخرین فروش‌ها (${sellTransactions.length})`}>
      {recentTransactions.length === 0 ? (
        <p className="text-center text-secondary py-4">هیچ فروشی ثبت نشده است</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentTransactions.map((trans: SellTransaction) => (
            <div key={trans.id} className="p-2 bg-background rounded border border-border text-xs hover-lift transition-all animate-fade-in group">
              <div className="flex justify-between items-start mb-1">
                <span className="text-secondary">{toJalaliDateString(trans.date)}</span>
                <CurrencyDisplay value={trans.totalAmount} className="font-semibold text-primary" />
              </div>
              <p className="text-secondary mb-2">
                {trans.items.length} کالا • {trans.paymentMethod}
              </p>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onPrint && (
                  <button
                    onClick={() => onPrint(trans)}
                    className="px-2 py-1 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors"
                    title="چاپ رسید"
                  >
                    چاپ
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => onEdit(trans)}
                    className="px-2 py-1 text-xs bg-surface border border-border rounded hover:bg-border transition-colors"
                    title="ویرایش"
                  >
                    ویرایش
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(trans.id)}
                    className="px-2 py-1 text-xs bg-danger/10 text-danger rounded hover:bg-danger/20 transition-colors"
                    title="حذف"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default SellDashboard;
