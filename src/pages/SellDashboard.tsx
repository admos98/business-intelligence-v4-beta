import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  const { posItems, getPOSItemsByCategory, getFrequentPOSItems, addSellTransaction, addPOSItem, updatePOSItem, deletePOSItem, updateSellTransaction, deleteSellTransaction, addPOSCategory, posCategories: storePosCategories, startShift, endShift, getActiveShift, getShiftTransactions } = store;

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cart, setCart] = useState<Map<string, { posItemId: string; name: string; quantity: number; unitPrice: number; customizations: Record<string, string | number | { optionId: string; amount: number }> }>>(new Map());
  const [itemSearch, setItemSearch] = useState<string>('');
  const [rushMode, setRushMode] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Customization modal state
  const [modalItem, setModalItem] = useState<POSItem | null>(null);
  const [modalQty, setModalQty] = useState<number>(1);
  const [modalCustomizations, setModalCustomizations] = useState<Record<string, string | number | { optionId: string; amount: number }>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PaymentMethod; amount: number }>>([]);
  const [useSplitPayment, setUseSplitPayment] = useState<boolean>(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', category: '', sellPrice: 0 });
  const [editingItem, setEditingItem] = useState<POSItem | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SellTransaction | null>(null);
  const [deleteTransactionConfirm, setDeleteTransactionConfirm] = useState<string | null>(null);
  const [cancelModalConfirm, setCancelModalConfirm] = useState<boolean>(false);
  const [refundMode, setRefundMode] = useState<boolean>(false);
  const [selectedTransactionForRefund, setSelectedTransactionForRefund] = useState<SellTransaction | null>(null);
  const [showDailySummary, setShowDailySummary] = useState<boolean>(false);
  const [editingItems, setEditingItems] = useState<SellTransactionItem[]>([]);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [editingDiscount, setEditingDiscount] = useState<number>(0);
  const [undoStack, setUndoStack] = useState<Array<{ action: 'add' | 'delete' | 'update'; transaction: SellTransaction; originalTransaction?: SellTransaction }>>([]);
  const [receiptTemplate, setReceiptTemplate] = useState<{ header?: string; footer?: string; showLogo?: boolean }>({
    header: 'رسید فروش کافه',
    footer: 'با تشکر از خرید شما',
    showLogo: false,
  });
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [shiftStartingCash, setShiftStartingCash] = useState<number>(0);
  const { addToast } = useToast();
  const { setActions } = usePageActions();

  // Refs for form elements to avoid direct DOM manipulation
  const itemFormRef = useRef<HTMLDivElement>(null);

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

  // Convert cart Map to array with keys for stable React keys
  const cartArray = useMemo(() => Array.from(cart.entries()).map(([key, value]) => ({ key, ...value })), [cart]);
  const cartTotal = cartArray.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  const handleAddToCart = (posItem: POSItem, opts?: { customizations?: Record<string, string | number | { optionId: string; amount: number }>; quantity?: number }) => {
    setCart(prev => {
      const newCart = new Map(prev);
      const key = opts && Object.keys(opts.customizations || {}).length > 0
        ? `${posItem.id}::${JSON.stringify(opts.customizations || {})}`
        : posItem.id;

      const existing = newCart.get(key);

      // Calculate price from base item customizations
      const customizationPrice = (opts?.customizations && Object.keys(opts.customizations).length > 0 && posItem.customizations)
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
                // Use price if available, otherwise fall back to priceModifier
                return s + (selectedOption.price ?? selectedOption.priceModifier ?? 0);
              }
            }

            // Fallback to priceModifier for legacy customizations
            return s + (cust?.priceModifier || 0) * (typeof v === 'number' ? Number(v) : 1);
          }, 0)
        : 0;

      const unitPrice = posItem.sellPrice + customizationPrice;

      // Build display name with customizations
      let displayName = posItem.name;
      if (opts?.customizations && Object.keys(opts.customizations).length > 0) {
        const custParts: string[] = [];
        Object.entries(opts.customizations).forEach(([custName, custValue]) => {
          const cust = posItem.customizations?.find(c => c.name === custName);
          if (cust && cust.options) {
            if (typeof custValue === 'object' && 'optionId' in custValue) {
              const opt = cust.options.find(o => o.id === custValue.optionId);
              if (opt) {
                let optLabel = opt.label || opt.name;
                if (opt.isCustomAmount && custValue.amount) {
                  optLabel += ` ${custValue.amount}${opt.unit || ''}`;
                }
                custParts.push(optLabel);
              }
            } else if (typeof custValue === 'string') {
              const opt = cust.options.find(o => o.id === custValue);
              if (opt) {
                custParts.push(opt.label || opt.name);
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

  // Open customization modal for an item
  const openCustomizationModal = (item: POSItem) => {
    setModalItem(item);
    setModalQty(1);
    setModalCustomizations({});
  };

  const closeModal = () => {
    // Check if user has entered any data
    const hasCustomizations = Object.keys(modalCustomizations).length > 0;
    const hasNonDefaultQty = modalQty !== 1;

    if (hasCustomizations || hasNonDefaultQty) {
      setCancelModalConfirm(true);
      return;
    }

    setModalItem(null);
    setModalQty(1);
    setModalCustomizations({});
  };

  const confirmCloseModal = () => {
    setModalItem(null);
    setModalQty(1);
    setModalCustomizations({});
    setCancelModalConfirm(false);
  };

  const confirmModalAdd = () => {
    if (!modalItem) return;
    handleAddToCart(modalItem, { customizations: modalCustomizations, quantity: modalQty });
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

      // Undo (Ctrl+Z or Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (undoStack.length > 0) {
          const lastAction = undoStack[undoStack.length - 1];
          setUndoStack(prev => prev.slice(0, -1));

          if (lastAction.action === 'add') {
            // Undo add: delete the transaction
            deleteSellTransaction(lastAction.transaction.id);
            addToast('فروش حذف شد (Undo)', 'info');
          } else if (lastAction.action === 'delete') {
            // Undo delete: restore the transaction
            const { id, date, ...transactionData } = lastAction.transaction;
            addSellTransaction(transactionData);
            addToast('فروش بازگردانده شد (Undo)', 'success');
          } else if (lastAction.action === 'update' && lastAction.originalTransaction) {
            // Undo update: restore original transaction
            updateSellTransaction(lastAction.transaction.id, lastAction.originalTransaction);
            addToast('تغییرات برگردانده شد (Undo)', 'info');
          }
        } else {
          addToast('چیزی برای برگرداندن وجود ندارد', 'info');
        }
        return;
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
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      addToast('دسترسی به چاپ رد شد. لطفاً پاپ‌آپ‌ها را برای این سایت فعال کنید.', 'error');
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

    const splitPaymentsHtml = transaction.splitPayments && transaction.splitPayments.length > 0
      ? transaction.splitPayments.map(split => `<p>${split.method}: ${split.amount.toLocaleString()} ریال</p>`).join('')
      : '';

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
          .header { text-align: center; margin-bottom: 1rem; }
          .footer { text-align: center; margin-top: 1rem; font-size: 0.9rem; color: #666; }
        </style>
      </head>
      <body>
        ${receiptTemplate.header ? `<div class="header"><h1>${receiptTemplate.header}</h1></div>` : '<h1>رسید فروش کافه</h1>'}
        <p style="text-align: center;">تاریخ: ${toJalaliDateString(transaction.date)}</p>
        <p style="text-align: center;">شماره فاکتور: ${transaction.receiptNumber ? `#${transaction.receiptNumber}` : transaction.id.slice(-8)}</p>
        ${transaction.isRefund ? '<p style="text-align: center; color: red; font-weight: bold;">بازگشت وجه</p>' : ''}
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
          <p>جمع کل: ${transaction.totalAmount.toLocaleString()} ریال</p>
          ${transaction.discountAmount ? `<p>تخفیف: ${transaction.discountAmount.toLocaleString()} ریال</p>` : ''}
          ${transaction.splitPayments && transaction.splitPayments.length > 0
            ? `<div>${splitPaymentsHtml}</div>`
            : `<p>روش پرداخت: ${transaction.paymentMethod}</p>`}
        </div>
        ${receiptTemplate.footer ? `<div class="footer">${receiptTemplate.footer}</div>` : ''}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const handleCompleteSale = () => {
    // Double-check cart is not empty (defensive programming)
    if (cartArray.length === 0) {
      addToast('سبد خرید خالی است', 'error');
      return;
    }

    // For refunds, total should be negative
    if (refundMode) {
      if (finalTotal >= 0) {
        addToast('برای بازگشت وجه، مبلغ باید منفی باشد', 'error');
        return;
      }
      if (!selectedTransactionForRefund) {
        addToast('لطفاً فاکتور اصلی را انتخاب کنید', 'error');
        return;
      }
    } else {
      // For regular sales, total should not be negative
      if (finalTotal < 0) {
        addToast('مبلغ نهایی نمی‌تواند منفی باشد. لطفاً تخفیف را بررسی کنید', 'error');
        return;
      }
    }

    const items: SellTransactionItem[] = cartArray.map(cartItem => ({
      id: `item-${Date.now()}-${Math.random()}`,
      posItemId: cartItem.posItemId,
      name: cartItem.name,
      quantity: refundMode ? -Math.abs(cartItem.quantity) : cartItem.quantity, // Negative quantity for refunds
      unitPrice: cartItem.unitPrice,
      totalPrice: refundMode ? -(cartItem.quantity * cartItem.unitPrice) : (cartItem.quantity * cartItem.unitPrice),
      customizationChoices: cartItem.customizations,
    }));

    // Calculate split payments total
    const splitTotal = splitPayments.reduce((sum, split) => sum + split.amount, 0);
    const hasValidSplit = useSplitPayment && splitPayments.length > 0 && Math.abs(splitTotal - finalTotal) < 0.01;

    if (useSplitPayment && !hasValidSplit && !refundMode) {
      addToast('مجموع پرداخت‌های تقسیم شده باید برابر با مبلغ نهایی باشد', 'error');
      return;
    }

    const transaction: Omit<SellTransaction, 'id' | 'date'> = {
      items,
      totalAmount: refundMode ? -Math.abs(finalTotal) : finalTotal,
      paymentMethod,
      splitPayments: useSplitPayment && hasValidSplit ? splitPayments : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      isRefund: refundMode,
      originalTransactionId: refundMode && selectedTransactionForRefund ? selectedTransactionForRefund.id : undefined,
    };

    const transactionId = addSellTransaction(transaction);
    setCart(new Map());
    setDiscountAmount(0);
    setRefundMode(false);
    setSelectedTransactionForRefund(null);
    addToast(refundMode ? 'بازگشت وجه ثبت شد' : 'فروش ثبت شد', 'success');

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

  // Variants removed - using only base item customizations
  const [newItemCustomizations, setNewItemCustomizations] = useState<{
    id: string;
    name: string;
    type: 'choice' | 'number' | 'text';
    options?: { id: string; name: string; label?: string; price?: number; priceModifier?: number; isCustomAmount?: boolean; unit?: string; pricePerUnit?: number }[];
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
      variants: undefined, // No variants - only base item customizations
      customizations: newItemCustomizations.length > 0 ? newItemCustomizations.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        options: c.options?.map(opt => ({
          id: opt.id,
          name: opt.name,
          label: opt.label,
          price: opt.price,
          priceModifier: opt.priceModifier,
          isCustomAmount: opt.isCustomAmount,
          unit: opt.unit,
          pricePerUnit: opt.pricePerUnit
        })),
        priceModifier: c.priceModifier
      })) : undefined,
    };

    addPOSItem(payload);

    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemCustomizations([]);
    setShowNewItemForm(false);
    addToast('کالای جدید اضافه شد', 'success');
  };

  const handleEditItem = (item: POSItem) => {
    setEditingItem(item);
    setNewItemForm({ name: item.name, category: item.category, sellPrice: item.sellPrice });
    setNewItemCustomizations(item.customizations?.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      options: c.options?.map(opt => ({
        id: opt.id,
        name: opt.name,
        label: opt.label || opt.name,
        price: opt.price,
        priceModifier: opt.priceModifier,
        isCustomAmount: opt.isCustomAmount,
        unit: opt.unit,
        pricePerUnit: opt.pricePerUnit
      })),
      priceModifier: c.priceModifier || 0
    })) || []);
    setShowNewItemForm(true);
    // Scroll to form using ref
    setTimeout(() => {
      itemFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      variants: undefined, // No variants - only base item customizations
      customizations: newItemCustomizations.length > 0 ? newItemCustomizations.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        options: c.options?.map(opt => ({
          id: opt.id,
          name: opt.name,
          label: opt.label,
          price: opt.price,
          priceModifier: opt.priceModifier,
          isCustomAmount: opt.isCustomAmount,
          unit: opt.unit,
          pricePerUnit: opt.pricePerUnit
        })),
        priceModifier: c.priceModifier
      })) : undefined,
    });

    setEditingItem(null);
    setNewItemForm({ name: '', category: '', sellPrice: 0 });
    setNewItemCustomizations([]);
    setShowNewItemForm(false);
    addToast('کالا به‌روزرسانی شد', 'success');
  };

  const handleDeletePOSItem = (itemId: string) => {
    deletePOSItem(itemId);
    setDeleteItemConfirm(null);
    addToast('کالا حذف شد', 'success');
  };

  const handlePrintCart = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('لطفاً اجازه باز کردن پنجره جدید را به مرورگر بدهید و دوباره تلاش کنید', 'error');
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
  }, [cartArray, finalTotal, discountAmount, addToast]);

  const handleExportTransactionsJson = useCallback(() => {
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
  }, [store.sellTransactions, addToast]);

  const handleExportTransactionsCsv = useCallback(() => {
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
  }, [store.sellTransactions, addToast]);

  // Get low stock alerts
  const lowStockItems = useMemo(() => {
    const lowStock: Array<{ name: string; unit: Unit; currentStock: number; recipeId?: string }> = [];
    const stockThreshold = 10; // Alert if stock is below this amount

    // Check stock for all items used in recipes
    store.recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const currentStock = store.getStock(ingredient.itemName, ingredient.itemUnit);
        if (currentStock < stockThreshold) {
          // Avoid duplicates
          if (!lowStock.some(item => item.name === ingredient.itemName && item.unit === ingredient.itemUnit)) {
            lowStock.push({
              name: ingredient.itemName,
              unit: ingredient.itemUnit,
              currentStock,
              recipeId: recipe.id,
            });
          }
        }
      });
    });

    return lowStock.sort((a, b) => a.currentStock - b.currentStock);
  }, [store.recipes, store.getStock, store.stockEntries]);

  // Calculate daily summary
  const dailySummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTransactions = store.sellTransactions.filter(trans => {
      const transDate = new Date(trans.date);
      return transDate >= today && transDate < tomorrow && !trans.isRefund;
    });

    const todayRefunds = store.sellTransactions.filter(trans => {
      const transDate = new Date(trans.date);
      return transDate >= today && transDate < tomorrow && trans.isRefund;
    });

    const totalRevenue = todayTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalRefunds = Math.abs(todayRefunds.reduce((sum, t) => sum + t.totalAmount, 0));
    const netRevenue = totalRevenue - totalRefunds;

    const paymentBreakdown = {
      [PaymentMethod.Cash]: 0,
      [PaymentMethod.Card]: 0,
      [PaymentMethod.Transfer]: 0,
    };

    todayTransactions.forEach(trans => {
      if (trans.splitPayments && trans.splitPayments.length > 0) {
        trans.splitPayments.forEach(split => {
          paymentBreakdown[split.method] = (paymentBreakdown[split.method] || 0) + split.amount;
        });
      } else {
        paymentBreakdown[trans.paymentMethod] = (paymentBreakdown[trans.paymentMethod] || 0) + trans.totalAmount;
      }
    });

    const itemBreakdown = new Map<string, { quantity: number; revenue: number }>();
    todayTransactions.forEach(trans => {
      trans.items.forEach(item => {
        const key = item.name;
        const existing = itemBreakdown.get(key) || { quantity: 0, revenue: 0 };
        itemBreakdown.set(key, {
          quantity: existing.quantity + Math.abs(item.quantity),
          revenue: existing.revenue + Math.abs(item.totalPrice),
        });
      });
    });

    const topItems = Array.from(itemBreakdown.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      date: today,
      totalTransactions: todayTransactions.length,
      totalRefunds: todayRefunds.length,
      totalRevenue,
      totalRefundsAmount: totalRefunds,
      netRevenue,
      paymentBreakdown,
      topItems,
      transactions: todayTransactions,
      refunds: todayRefunds,
    };
  }, [store.sellTransactions]);

  const handlePrintDailySummary = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast('لطفاً اجازه باز کردن پنجره جدید را به مرورگر بدهید', 'error');
      return;
    }

    const paymentRows = Object.entries(dailySummary.paymentBreakdown)
      .map(([method, amount]) => `<tr><td>${method}</td><td>${amount.toLocaleString()} ریال</td></tr>`)
      .join('');

    const topItemsRows = dailySummary.topItems
      .map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.revenue.toLocaleString()} ریال</td></tr>`)
      .join('');

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <title>خلاصه فروش روزانه</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; margin: 1rem; }
          h1 { text-align: center; color: #333; }
          table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
          th { background-color: #f0f0f0; padding: 0.5rem; border: 1px solid #ddd; text-align: right; }
          td { padding: 0.5rem; border: 1px solid #ddd; }
          .summary { font-size: 1.2rem; font-weight: bold; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <h1>خلاصه فروش روزانه</h1>
        <p style="text-align: center;">تاریخ: ${toJalaliDateString(dailySummary.date.toISOString())}</p>

        <div class="summary">
          <p>تعداد فروش: ${dailySummary.totalTransactions}</p>
          <p>تعداد بازگشت وجه: ${dailySummary.totalRefunds}</p>
          <p>درآمد کل: ${dailySummary.totalRevenue.toLocaleString()} ریال</p>
          <p>بازگشت وجه: ${dailySummary.totalRefundsAmount.toLocaleString()} ریال</p>
          <p>درآمد خالص: ${dailySummary.netRevenue.toLocaleString()} ریال</p>
        </div>

        <h2>تقسیم بر اساس روش پرداخت</h2>
        <table>
          <thead>
            <tr><th>روش پرداخت</th><th>مبلغ</th></tr>
          </thead>
          <tbody>
            ${paymentRows}
          </tbody>
        </table>

        <h2>پرفروش‌ترین کالاها</h2>
        <table>
          <thead>
            <tr><th>نام کالا</th><th>تعداد</th><th>درآمد</th></tr>
          </thead>
          <tbody>
            ${topItemsRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  }, [dailySummary, addToast]);

  // Register page actions with Navbar
  useEffect(() => {
    const actions = (
      <>
        <Button key="daily-summary" variant="primary" size="sm" onClick={() => setShowDailySummary(true)} fullWidth>
          خلاصه روزانه
        </Button>
        <Button key="receipt-template" variant="ghost" size="sm" onClick={() => {
          const newHeader = prompt('سربرگ رسید (خالی بگذارید برای حذف):', receiptTemplate.header || '');
          if (newHeader !== null) {
            const newFooter = prompt('پانویس رسید (خالی بگذارید برای حذف):', receiptTemplate.footer || '');
            if (newFooter !== null) {
              setReceiptTemplate({
                header: newHeader || undefined,
                footer: newFooter || undefined,
                showLogo: receiptTemplate.showLogo,
              });
              addToast('قالب رسید به‌روزرسانی شد', 'success');
            }
          }
        }} fullWidth>
          تنظیمات رسید
        </Button>
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
      // Cleanup: set actions to null synchronously to avoid DOM manipulation errors
      setActions(null);
    };
  }, [setActions, handleExportTransactionsCsv, handleExportTransactionsJson, handlePrintCart, onViewSellAnalysis]);

  return (
    <>
      <Header title="فروش و سفارش (POS)" hideMenu={true} />

      <main className="p-4 sm:p-6 md:p-8 max-w-[1800px] mx-auto">
        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <Card className="mb-4 border-warning/50 bg-warning/10 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-warning flex items-center gap-2">
                <span>⚠️</span>
                <span>هشدار موجودی کم</span>
              </h3>
              <span className="text-xs text-secondary">{lowStockItems.length} مورد</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {lowStockItems.map((item, idx) => (
                <div key={idx} className="p-2 bg-background rounded border border-warning/30 text-xs">
                  <p className="font-semibold text-primary truncate">{item.name}</p>
                  <p className="text-secondary">{item.unit}</p>
                  <p className="text-danger font-bold">موجودی: {item.currentStock}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

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
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm max-w-[150px]"
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
                        // Always open customization modal if item has customizations, otherwise add directly
                        if (item.customizations && item.customizations.length > 0) {
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
                            // Always open customization modal if item has customizations, otherwise add directly
                            if (item.customizations && item.customizations.length > 0) {
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
              <div ref={itemFormRef}>
                <Card title={editingItem ? "ویرایش کالا" : "افزودن کالای جدید"} className="animate-fade-in">
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
                              onChange={e => setNewItemCustomizations(prev => prev.map((c, i) => i === custIdx ? { ...c, type: e.target.value as 'choice' | 'number' | 'text' } : c))}
                              className="ml-2 px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="choice">انتخابی</option>
                              <option value="number">عدد</option>
                              <option value="text">متن</option>
                            </select>
                            <Button variant="danger" size="sm" onClick={() => setNewItemCustomizations(prev => prev.filter((_, i) => i !== custIdx))} className="ml-2">
                              حذف
                            </Button>
                          </div>

                          {/* Options for choice type */}
                          {cust.type === 'choice' && (
                            <div className="mt-3 space-y-2">
                              <label className="text-xs text-secondary block mb-1">گزینه‌ها:</label>
                              {cust.options?.map((opt, optIdx) => (
                                <div key={opt.id} className="flex gap-2 items-center">
                                  <input
                                    value={opt.label || opt.name || ''}
                                    onChange={e => {
                                      const newValue = e.target.value;
                                      setNewItemCustomizations(prev => prev.map((c, i) =>
                                        i === custIdx ? {
                                          ...c,
                                          options: c.options?.map((o, oi) => oi === optIdx ? { ...o, label: newValue, name: o.name || newValue } : o) || []
                                        } : c
                                      ));
                                    }}
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
                                      options: [...(c.options || []), { id: newOptId, name: '', label: '', price: 0 }]
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
                            type: 'choice',
                            options: []
                          }]);
                        }}
                      >
                        + افزودن سفارشی‌سازی
                      </Button>
                    </div>
                  </div>


                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowNewItemForm(false);
                        setNewItemForm({ name: '', category: '', sellPrice: 0 });
                        setNewItemCustomizations([]);
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
              </div>
            )}
          </div>

          {/* RIGHT: CART & PAYMENT (1 column) */}
          <div className="lg:col-span-1 space-y-4 sticky top-4 h-fit">
            <Card title={`سبد خرید (${cartArray.length})`} className="bg-accent/5 animate-fade-in">
              <div className="space-y-2 max-h-[400px] overflow-y-auto border-b border-border pb-3 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
                {cartArray.length > 5 && (
                  <div className="sticky top-0 bg-accent/10 text-xs text-secondary text-center py-1 mb-2 rounded">
                    {cartArray.length} مورد در سبد - برای دیدن همه موارد اسکرول کنید
                  </div>
                )}
                {cartArray.length === 0 ? (
                  <p className="text-center text-secondary py-8">سبد خرید خالی است</p>
                ) : (
                  cartArray.map((item, idx) => {
                    // Extract variant name from item.name if it exists
                    const variantMatch = item.name.match(/^(.+?)\s*\((.+?)\)/);
                    const baseName = variantMatch ? variantMatch[1] : item.name;
                    const variantName = variantMatch ? variantMatch[2] : null;
                    const customizationMatch = item.name.match(/\[(.+?)\]/);
                    const customizationsText = customizationMatch ? customizationMatch[1] : null;

                    return (
                      <div
                        key={item.key}
                        className="bg-surface p-3 rounded-lg border border-border hover-lift animate-fade-in transition-all"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-primary text-sm">{baseName}</p>
                            {variantName && (
                              <p className="text-xs text-accent font-medium mt-0.5">ورژن: {variantName}</p>
                            )}
                            {customizationsText && (
                              <p className="text-xs text-secondary mt-0.5">{customizationsText}</p>
                            )}
                            <CurrencyDisplay value={item.unitPrice} className="text-xs text-secondary mt-1" />
                          </div>
                          <button
                            onClick={() => handleRemoveFromCart(item.key)}
                            className="text-danger hover:text-danger/80 transition-colors p-1 hover:bg-danger/10 rounded"
                            aria-label="حذف از سبد"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 bg-background rounded-lg p-1">
                            <button
                              onClick={() => handleUpdateCartQuantity(item.key, item.quantity - 1)}
                              className="p-1 hover:bg-border rounded transition-colors"
                              aria-label="کاهش تعداد"
                            >
                              <MinusIcon />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateCartQuantity(item.key, item.quantity + 1)}
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
                      min="0"
                      max={cartTotal}
                      value={discountAmount || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        const clampedValue = Math.max(0, Math.min(value, cartTotal));
                        setDiscountAmount(clampedValue);
                        if (value > cartTotal) {
                          addToast(`تخفیف نمی‌تواند بیشتر از ${cartTotal.toLocaleString()} ریال باشد`, 'info');
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-surface border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    {discountAmount > cartTotal && (
                      <p className="text-xs text-danger mt-1">تخفیف نمی‌تواند بیشتر از جمع کل باشد</p>
                    )}
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
              <Card title={refundMode ? "بازگشت وجه" : "پرداخت"} className={`animate-fade-in ${refundMode ? 'border-danger/50 bg-danger/5' : ''}`}>
                <div className="space-y-3">
                  {/* Refund Mode Toggle */}
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-primary">نوع تراکنش</label>
                    <button
                      onClick={() => {
                        setRefundMode(!refundMode);
                        if (!refundMode) {
                          setCart(new Map());
                          setDiscountAmount(0);
                          setSelectedTransactionForRefund(null);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        refundMode
                          ? 'bg-danger text-white'
                          : 'bg-surface border border-border text-primary hover:bg-border'
                      }`}
                    >
                      {refundMode ? 'بازگشت وجه' : 'فروش عادی'}
                    </button>
                  </div>

                  {/* Select Original Transaction for Refund */}
                  {refundMode && (
                    <div>
                      <label className="text-sm font-medium text-primary block mb-2">فاکتور اصلی</label>
                      <select
                        value={selectedTransactionForRefund?.id || ''}
                        onChange={(e) => {
                          const trans = store.sellTransactions.find((t: SellTransaction) => t.id === e.target.value);
                          setSelectedTransactionForRefund(trans || null);
                          if (trans) {
                            // Pre-fill cart with items from original transaction (as negative)
                            const refundCart = new Map();
                            trans.items.forEach((item, idx) => {
                              refundCart.set(`refund-${item.id}-${idx}`, {
                                posItemId: item.posItemId,
                                name: item.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                customizations: item.customizationChoices || {},
                              });
                            });
                            setCart(refundCart);
                            setDiscountAmount(trans.discountAmount || 0);
                            setPaymentMethod(trans.paymentMethod);
                          }
                        }}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="">انتخاب فاکتور...</option>
                        {store.sellTransactions
                          .filter((t: SellTransaction) => !t.isRefund)
                          .sort((a: SellTransaction, b: SellTransaction) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .slice(0, 50)
                          .map((trans: SellTransaction) => (
                            <option key={trans.id} value={trans.id}>
                              #{trans.receiptNumber || trans.id.slice(-8)} - {toJalaliDateString(trans.date)} - {trans.totalAmount.toLocaleString()} ریال
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-primary">روش پرداخت</label>
                      <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSplitPayment}
                          onChange={(e) => {
                            setUseSplitPayment(e.target.checked);
                            if (e.target.checked) {
                              // Initialize with current payment method
                              setSplitPayments([{ method: paymentMethod, amount: finalTotal }]);
                            } else {
                              setSplitPayments([]);
                            }
                          }}
                          className="rounded"
                        />
                        پرداخت تقسیمی
                      </label>
                    </div>

                    {!useSplitPayment ? (
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
                    ) : (
                      <div className="space-y-2">
                        {splitPayments.map((split: { method: PaymentMethod; amount: number }, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <select
                              value={split.method}
                              onChange={(e) => {
                                const newSplits = [...splitPayments];
                                newSplits[idx].method = e.target.value as PaymentMethod;
                                setSplitPayments(newSplits);
                              }}
                              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm"
                            >
                              {[PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Transfer].map(method => (
                                <option key={method} value={method}>{method}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={split.amount || ''}
                              onChange={(e) => {
                                const newSplits = [...splitPayments];
                                newSplits[idx].amount = parseFloat(e.target.value) || 0;
                                setSplitPayments(newSplits);
                              }}
                              className="w-32 px-3 py-2 bg-surface border border-border rounded-lg text-sm"
                              placeholder="مبلغ"
                              min="0"
                            />
                            <button
                              onClick={() => {
                                setSplitPayments(splitPayments.filter((_, i) => i !== idx));
                              }}
                              className="px-2 py-2 text-danger hover:bg-danger/10 rounded"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setSplitPayments([...splitPayments, { method: PaymentMethod.Cash, amount: 0 }]);
                          }}
                          className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg hover:bg-border transition-colors"
                        >
                          + افزودن روش پرداخت
                        </button>
                        {splitPayments.length > 0 && (
                          <div className="flex justify-between items-center pt-2 border-t border-border">
                            <span className="text-sm text-secondary">مجموع:</span>
                            <CurrencyDisplay
                              value={splitPayments.reduce((sum: number, s: { method: PaymentMethod; amount: number }) => sum + s.amount, 0)}
                              className={`text-sm font-semibold ${
                                Math.abs(splitPayments.reduce((sum: number, s: { method: PaymentMethod; amount: number }) => sum + s.amount, 0) - finalTotal) < 0.01
                                  ? 'text-success'
                                  : 'text-danger'
                              }`}
                            />
                            <span className="text-xs text-secondary">
                              / {finalTotal.toLocaleString()} ریال
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant={refundMode ? "danger" : "success"}
                    size="lg"
                    onClick={handleCompleteSale}
                    disabled={cartArray.length === 0 || (refundMode && !selectedTransactionForRefund)}
                    fullWidth
                    icon={<CheckIcon />}
                    className="animate-fade-in"
                  >
                    {refundMode ? 'تایید و ثبت بازگشت وجه' : 'تایید و ثبت فروش'}
                  </Button>
                  <p className="text-xs text-secondary text-center">Enter برای ثبت سریع</p>
                </div>
              </Card>
            )}

            {/* RECENT TRANSACTIONS */}
            <RecentTransactionsCard
              store={store}
              onEdit={(trans) => setEditingTransaction(trans)}
              onDelete={(transId) => setDeleteTransactionConfirm(transId)}
              onPrint={(trans) => printReceipt(trans)}
            />
          </div>
        </div>
      </main>
      {/* Customization Modal */}
      {modalItem && !cancelModalConfirm && (
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
              {/* Base item customizations */}
              {modalItem.customizations && modalItem.customizations.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <label className="text-sm font-medium text-primary block">سفارشی‌سازی‌های عمومی</label>
                  {modalItem.customizations.map(c => (
                    <div key={c.id || c.name} className="space-y-2">
                      <label className="text-sm font-medium text-primary block">{c.name}</label>

                      {c.type === 'choice' && c.options && c.options.length > 0 ? (
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
                                    <span>{opt.label || opt.name}</span>
                                    {(opt.price !== undefined && opt.price !== 0) || (opt.priceModifier !== undefined && opt.priceModifier !== 0) ? (
                                      <span className="text-xs">
                                        {((opt.price ?? opt.priceModifier ?? 0) > 0 ? '+' : '')}{(opt.price ?? opt.priceModifier ?? 0).toLocaleString()} ریال
                                      </span>
                                    ) : null}
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

      {/* Cancel Customization Modal Confirmation */}
      {cancelModalConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md animate-fade-in-down">
            <h3 className="text-lg font-bold text-primary mb-4">تایید انصراف</h3>
            <p className="text-secondary mb-4">آیا مطمئن هستید که می‌خواهید انصراف دهید؟ تغییرات اعمال شده از دست خواهد رفت.</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCancelModalConfirm(false)} fullWidth>
                ادامه ویرایش
              </Button>
              <Button variant="danger" onClick={confirmCloseModal} fullWidth>
                انصراف و بستن
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deleteItemConfirm && (() => {
        const itemToDelete = posItems.find(item => item.id === deleteItemConfirm);
        const recentSales = itemToDelete ? store.sellTransactions.filter(trans => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return new Date(trans.date) >= sevenDaysAgo &&
                 trans.items.some(item => item.posItemId === itemToDelete.id);
        }).length : 0;
        const hasRecentSales = recentSales > 0;

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <Card className="w-full max-w-md animate-fade-in-down">
              <h3 className="text-lg font-bold text-primary mb-4">تایید حذف</h3>
              <p className="text-secondary mb-4">آیا مطمئن هستید که می‌خواهید این کالا را حذف کنید؟</p>
              {hasRecentSales && (
                <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-sm text-warning font-semibold mb-1">⚠️ هشدار</p>
                  <p className="text-xs text-secondary">
                    این کالا در {recentSales} فروش در ۷ روز گذشته استفاده شده است.
                    حذف آن ممکن است بر گزارش‌های فروش تأثیر بگذارد.
                  </p>
                </div>
              )}
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
        );
      })()}

      {/* Edit Transaction Modal */}
      {editingTransaction && (() => {
        // Initialize editing state when transaction changes
        useEffect(() => {
          if (editingTransaction) {
            setEditingItems([...editingTransaction.items]);
            setEditingPaymentMethod(editingTransaction.paymentMethod);
            setEditingDiscount(editingTransaction.discountAmount || 0);
          }
        }, [editingTransaction?.id]);

        const itemsTotal = editingItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const newTotal = Math.max(0, itemsTotal - editingDiscount);

        const handleUpdateItemQuantity = (itemId: string, newQuantity: number) => {
          if (newQuantity <= 0) {
            setEditingItems(prev => prev.filter(item => item.id !== itemId));
          } else {
            setEditingItems(prev => prev.map(item => {
              if (item.id === itemId) {
                const newTotalPrice = item.unitPrice * newQuantity;
                return { ...item, quantity: newQuantity, totalPrice: newTotalPrice };
              }
              return item;
            }));
          }
        };

        const handleRemoveItem = (itemId: string) => {
          setEditingItems(prev => prev.filter(item => item.id !== itemId));
        };

        const handleSaveChanges = () => {
          if (editingItems.length === 0) {
            addToast('فروش باید حداقل یک کالا داشته باشد', 'error');
            return;
          }
          updateSellTransaction(editingTransaction.id, {
            items: editingItems,
            paymentMethod: editingPaymentMethod,
            discountAmount: editingDiscount > 0 ? editingDiscount : undefined,
            totalAmount: newTotal,
          });
          setEditingTransaction(null);
          addToast('فروش به‌روزرسانی شد', 'success');
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in-down">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-primary">ویرایش فروش #{editingTransaction.receiptNumber || editingTransaction.id.slice(-8)}</h3>
                <button onClick={() => setEditingTransaction(null)} className="text-secondary hover:text-primary text-2xl">×</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-primary block mb-2">روش پرداخت</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Transfer].map(method => (
                      <button
                        key={method}
                        onClick={() => setEditingPaymentMethod(method)}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                          editingPaymentMethod === method
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
                    min="0"
                    max={itemsTotal}
                    value={editingDiscount || ''}
                    onChange={(e) => setEditingDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                  />
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm font-medium text-primary">اقلام ({editingItems.length})</p>
                  </div>
                  <div className="space-y-2">
                    {editingItems.length === 0 ? (
                      <p className="text-center text-secondary py-4">هیچ کالایی وجود ندارد</p>
                    ) : (
                      editingItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-background rounded-lg border border-border">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-primary">{item.name}</p>
                            <p className="text-xs text-secondary">قیمت واحد: <CurrencyDisplay value={item.unitPrice} /></p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-surface rounded-lg p-1">
                              <button
                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                                className="p-1 hover:bg-border rounded transition-colors"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItemQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                                className="w-12 text-center bg-transparent border-none focus:outline-none"
                              />
                              <button
                                onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                                className="p-1 hover:bg-border rounded transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <CurrencyDisplay value={item.totalPrice} className="text-sm font-semibold w-24 text-right" />
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-2 text-danger hover:bg-danger/10 rounded transition-colors"
                              title="حذف"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 flex justify-between items-center pt-4 border-t border-border">
                    <span className="font-bold text-lg">جمع کل:</span>
                    <CurrencyDisplay value={newTotal} className="font-bold text-lg text-accent" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setEditingTransaction(null)} fullWidth>
                    انصراف
                  </Button>
                  <Button variant="primary" onClick={handleSaveChanges} fullWidth>
                    ذخیره تغییرات
                  </Button>
                  <Button variant="ghost" onClick={() => printReceipt(editingTransaction)} fullWidth>
                    چاپ رسید
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Daily Sales Summary Modal */}
      {showDailySummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in-down">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-primary">خلاصه فروش روزانه</h3>
              <button onClick={() => setShowDailySummary(false)} className="text-secondary hover:text-primary text-2xl">×</button>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <p className="text-secondary mb-2">تاریخ: {toJalaliDateString(dailySummary.date.toISOString())}</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-accent/10 p-4 rounded-lg text-center">
                  <p className="text-xs text-secondary mb-1">فروش‌ها</p>
                  <p className="text-2xl font-bold text-primary">{dailySummary.totalTransactions}</p>
                </div>
                <div className="bg-danger/10 p-4 rounded-lg text-center">
                  <p className="text-xs text-secondary mb-1">بازگشت وجه</p>
                  <p className="text-2xl font-bold text-danger">{dailySummary.totalRefunds}</p>
                </div>
                <div className="bg-success/10 p-4 rounded-lg text-center">
                  <p className="text-xs text-secondary mb-1">درآمد کل</p>
                  <CurrencyDisplay value={dailySummary.totalRevenue} className="text-2xl font-bold text-success" />
                </div>
                <div className="bg-warning/10 p-4 rounded-lg text-center">
                  <p className="text-xs text-secondary mb-1">درآمد خالص</p>
                  <CurrencyDisplay value={dailySummary.netRevenue} className="text-2xl font-bold text-warning" />
                </div>
              </div>

              {/* Payment Breakdown */}
              <div>
                <h4 className="font-bold text-primary mb-3">تقسیم بر اساس روش پرداخت</h4>
                <div className="space-y-2">
                  {Object.entries(dailySummary.paymentBreakdown).map(([method, amount]) => (
                    <div key={method} className="flex justify-between items-center p-3 bg-background rounded-lg">
                      <span className="text-primary">{method}</span>
                      <CurrencyDisplay value={amount} className="font-semibold text-primary" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Items */}
              {dailySummary.topItems.length > 0 && (
                <div>
                  <h4 className="font-bold text-primary mb-3">پرفروش‌ترین کالاها</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dailySummary.topItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-background rounded-lg">
                        <div>
                          <p className="font-semibold text-primary">{item.name}</p>
                          <p className="text-xs text-secondary">{item.quantity} عدد</p>
                        </div>
                        <CurrencyDisplay value={item.revenue} className="font-semibold text-accent" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="secondary" onClick={() => setShowDailySummary(false)} fullWidth>
                  بستن
                </Button>
                <Button variant="primary" onClick={handlePrintDailySummary} fullWidth>
                  چاپ خلاصه
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Shift Management Modal */}
      {showShiftModal && (() => {
        const activeShift = getActiveShift();
        const shiftTransactions = activeShift ? getShiftTransactions(activeShift.id) : [];
        const cashTransactions = shiftTransactions.filter((t: SellTransaction) => t.paymentMethod === PaymentMethod.Cash && !t.isRefund);
        const cashRefunds = shiftTransactions.filter((t: SellTransaction) => t.isRefund && t.paymentMethod === PaymentMethod.Cash);
        const expectedCash = activeShift
          ? activeShift.startingCash +
            cashTransactions.reduce((sum: number, t: SellTransaction) => sum + t.totalAmount, 0) -
            cashRefunds.reduce((sum: number, t: SellTransaction) => sum + Math.abs(t.totalAmount), 0)
          : 0;
        const [endingCash, setEndingCash] = useState<number>(expectedCash);
        const [shiftNotes, setShiftNotes] = useState<string>('');

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-down">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-primary">
                  {activeShift ? 'مدیریت شیفت' : 'شروع شیفت جدید'}
                </h3>
                <button onClick={() => setShowShiftModal(false)} className="text-secondary hover:text-primary text-2xl">×</button>
              </div>

              {activeShift ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <p className="text-xs text-secondary mb-1">شروع شیفت</p>
                      <p className="font-semibold text-primary">{toJalaliDateString(activeShift.startTime)}</p>
                    </div>
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <p className="text-xs text-secondary mb-1">نقد اولیه</p>
                      <CurrencyDisplay value={activeShift.startingCash} className="font-semibold text-primary" />
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <h4 className="font-bold text-primary mb-3">خلاصه تراکنش‌ها</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-secondary mb-1">تعداد فروش</p>
                        <p className="text-lg font-semibold text-primary">{shiftTransactions.filter((t: SellTransaction) => !t.isRefund).length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-secondary mb-1">فروش نقدی</p>
                        <CurrencyDisplay value={cashTransactions.reduce((sum: number, t: SellTransaction) => sum + t.totalAmount, 0)} className="text-lg font-semibold text-success" />
                      </div>
                      <div>
                        <p className="text-xs text-secondary mb-1">بازگشت وجه</p>
                        <CurrencyDisplay value={cashRefunds.reduce((sum: number, t: SellTransaction) => sum + Math.abs(t.totalAmount), 0)} className="text-lg font-semibold text-danger" />
                      </div>
                      <div>
                        <p className="text-xs text-secondary mb-1">نقدی مورد انتظار</p>
                        <CurrencyDisplay value={expectedCash} className="text-lg font-semibold text-accent" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <label className="text-sm font-medium text-primary block mb-2">نقدی واقعی در صندوق</label>
                    <input
                      type="number"
                      min="0"
                      value={endingCash || ''}
                      onChange={(e) => setEndingCash(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                      placeholder="مقدار نقدی موجود"
                    />
                    {endingCash !== expectedCash && (
                      <p className={`text-sm mt-2 font-semibold ${
                        endingCash > expectedCash ? 'text-success' : 'text-danger'
                      }`}>
                        تفاوت: {(endingCash - expectedCash).toLocaleString()} ریال
                        {endingCash > expectedCash ? ' (زیاد)' : ' (کم)'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-primary block mb-2">یادداشت (اختیاری)</label>
                    <textarea
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                      rows={3}
                      placeholder="یادداشت‌های شیفت..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setShowShiftModal(false)} fullWidth>
                      انصراف
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        try {
                          endShift(endingCash, shiftNotes || undefined);
                          setShowShiftModal(false);
                          addToast('شیفت با موفقیت بسته شد', 'success');
                        } catch (error) {
                          addToast('خطا در بستن شیفت', 'error');
                        }
                      }}
                      fullWidth
                    >
                      بستن شیفت
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-primary block mb-2">نقدی اولیه در صندوق</label>
                    <input
                      type="number"
                      min="0"
                      value={shiftStartingCash || ''}
                      onChange={(e) => setShiftStartingCash(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                      placeholder="مقدار نقدی موجود در صندوق"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setShowShiftModal(false)} fullWidth>
                      انصراف
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (shiftStartingCash < 0) {
                          addToast('نقدی اولیه نمی‌تواند منفی باشد', 'error');
                          return;
                        }
                        startShift(shiftStartingCash);
                        setShowShiftModal(false);
                        setShiftStartingCash(0);
                        addToast('شیفت جدید شروع شد', 'success');
                      }}
                      fullWidth
                    >
                      شروع شیفت
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* Delete Transaction Confirmation Modal */}
      {deleteTransactionConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
                  const transaction = store.sellTransactions.find(t => t.id === deleteTransactionConfirm);
                  if (transaction) {
                    // Add to undo stack before deleting
                    setUndoStack(prev => [...prev, { action: 'delete', transaction }]);
                  }
                  deleteSellTransaction(deleteTransactionConfirm);
                  setDeleteTransactionConfirm(null);
                  addToast('فروش حذف شد. می‌توانید با Ctrl+Z برگردانید', 'success');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all');

  const filteredTransactions = useMemo(() => {
    let filtered = [...sellTransactions];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(trans => {
        const receiptMatch = trans.receiptNumber?.toString().includes(query);
        const itemMatch = trans.items.some(item => item.name.toLowerCase().includes(query));
        const dateMatch = toJalaliDateString(trans.date).includes(query);
        return receiptMatch || itemMatch || dateMatch;
      });
    }

    // Payment method filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(trans => trans.paymentMethod === paymentFilter);
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sellTransactions, searchQuery, paymentFilter]);

  const recentTransactions = filteredTransactions.slice(0, 20); // Show up to 20 filtered results

  return (
    <Card title={`آخرین فروش‌ها (${filteredTransactions.length}/${sellTransactions.length})`}>
      {/* Search and Filter */}
      <div className="mb-3 space-y-2">
        <input
          type="text"
          placeholder="جستجو بر اساس شماره فاکتور، کالا یا تاریخ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPaymentFilter('all')}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              paymentFilter === 'all'
                ? 'bg-accent text-accent-text'
                : 'bg-surface border border-border text-primary hover:bg-border'
            }`}
          >
            همه
          </button>
          {[PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Transfer].map(method => (
            <button
              key={method}
              onClick={() => setPaymentFilter(method)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                paymentFilter === method
                  ? 'bg-accent text-accent-text'
                  : 'bg-surface border border-border text-primary hover:bg-border'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {recentTransactions.length === 0 ? (
        <p className="text-center text-secondary py-4">
          {sellTransactions.length === 0 ? 'هیچ فروشی ثبت نشده است' : 'نتیجه‌ای یافت نشد'}
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {recentTransactions.map((trans: SellTransaction) => (
            <div key={trans.id} className="p-2 bg-background rounded border border-border text-xs hover-lift transition-all animate-fade-in group">
              <div className="flex justify-between items-start mb-1">
                <div>
                  <span className="text-secondary">{toJalaliDateString(trans.date)}</span>
                  {trans.receiptNumber && (
                    <span className="text-xs text-accent mr-2">#{trans.receiptNumber}</span>
                  )}
                </div>
                <CurrencyDisplay value={trans.totalAmount} className="font-semibold text-primary" />
              </div>
              <div className="mb-2 space-y-1">
                <p className="text-secondary">
                  {trans.items.length} کالا • {trans.paymentMethod}
                </p>
                {/* Show items with variants clearly */}
                <div className="text-xs text-secondary/80 space-y-0.5 max-h-20 overflow-y-auto">
                  {trans.items.map((item, idx) => {
                    const variantMatch = item.name.match(/^(.+?)\s*\((.+?)\)/);
                    const baseName = variantMatch ? variantMatch[1] : item.name;
                    const variantName = variantMatch ? variantMatch[2] : null;
                    const customizationMatch = item.name.match(/\[(.+?)\]/);
                    const customizationsText = customizationMatch ? customizationMatch[1] : null;

                    return (
                      <div key={idx} className="truncate">
                        <span className="font-medium">{baseName}</span>
                        {variantName && <span className="text-accent"> ({variantName})</span>}
                        {customizationsText && <span className="text-secondary/70"> [{customizationsText}]</span>}
                        <span className="text-secondary/60"> ×{item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
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
