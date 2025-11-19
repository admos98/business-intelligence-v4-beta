import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { ShoppingList, ShoppingItem, Unit, ItemStatus, PaymentMethod, PaymentStatus, OcrResult } from '../../shared/types';
import { t } from '../../shared/translations';
import Header from '../components/common/Header';
import BuyItemModal from '../components/modals/BuyItemModal';
import EditItemModal from '../components/modals/EditItemModal';
import EditPurchasedItemModal from '../components/modals/EditPurchasedItemModal';
import BulkBuyModal from '../components/modals/BulkBuyModal';
import OcrImportModal from '../components/modals/OcrImportModal';
import { useShoppingStore } from '../store/useShoppingStore';
import { useToast } from '../components/common/Toast';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { exportComponentAsPdf } from '../lib/pdfExport';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import SmartAutocomplete from '../components/common/SmartAutocomplete';
import LoadingSpinner from '../components/common/LoadingSpinner';
import PendingItemRow from '../components/common/PendingItemRow';
import PurchasedItemRow from '../components/common/PurchasedItemRow';
import BulkActions from '../components/common/BulkActions';
import AdvancedFilter from '../components/common/AdvancedFilter';
import { usePageActions } from '../contexts/PageActionsContext';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const UndoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l4-4m-4 4l4 4" /></svg>;
const CheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;


interface ShoppingViewProps {
  listId: string;
  onBack: () => void;
  onLogout: () => void;
}

// Interface for the structured data used in the PDF report.
interface StructuredReportData {
    category: string;
    vendors: {
        vendorName: string;
        items: ShoppingItem[];
    }[];
}


const ShoppingView: React.FC<ShoppingViewProps> = ({ listId, onBack }) => {
  const { lists, updateList, addCustomData, allCategories, vendors, addOcrPurchase, findOrCreateVendor, updateCategoryVendorMap, getKnownItemNames, getItemInfo, getLatestPricePerUnit, updateItem } = useShoppingStore();
  const list = useMemo(() => lists.find(l => l.id === listId), [lists, listId]);

  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState<number | ''>('');
  const [newItemUnit, setNewItemUnit] = useState<Unit>(Unit.Piece);
  const [newItemCategory, setNewItemCategory] = useState('');

  const [itemToBuy, setItemToBuy] = useState<ShoppingItem | null>(null);
  const [itemToEdit, setItemToEdit] = useState<ShoppingItem | null>(null);
  const [itemToEditPurchased, setItemToEditPurchased] = useState<ShoppingItem | null>(null);
  const [isBulkBuyModalOpen, setIsBulkBuyModalOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const { addToast } = useToast();
  const vendorMap = useMemo(() => new Map<string, string>(vendors.map(v => [v.id, v.name])), [vendors]);

  const knownItemNames = useMemo(() => getKnownItemNames(), [lists, getKnownItemNames]);

  const onUpdateList = useCallback((updatedList: ShoppingList) => {
    updateList(listId, updatedList);
  }, [listId, updateList]);

  const handleNewItemNameChange = (name: string) => {
    setNewItemName(name);

    const rememberedInfo = getItemInfo(name);
    if (rememberedInfo) {
        setNewItemUnit(rememberedInfo.unit);
        setNewItemCategory(rememberedInfo.category);
    }
  };

  const handleItemSelect = (item: { name: string; unit: Unit; category: string }) => {
    setNewItemName(item.name);
    setNewItemUnit(item.unit);
    setNewItemCategory(item.category);
  };

  const handleAddItem = useCallback(() => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }

    if (newItemName.trim() && Number(newItemAmount) > 0) {
      const latestPricePerUnit = getLatestPricePerUnit(newItemName.trim(), newItemUnit);
      const estimatedPrice = latestPricePerUnit ? latestPricePerUnit * Number(newItemAmount) : undefined;

      const newItem: ShoppingItem = {
        id: `item-${Date.now()}`, name: newItemName.trim(), amount: Number(newItemAmount),
        unit: newItemUnit, status: ItemStatus.Pending, category: newItemCategory.trim() || t.other,
        estimatedPrice,
      };
      addCustomData(newItem);
      onUpdateList({ ...list, items: [...list.items, newItem] });
      addToast(t.itemAdded, 'success');
      setNewItemName(''); setNewItemAmount(''); setNewItemCategory(''); setNewItemUnit(Unit.Piece);
    }
  }, [list, newItemName, newItemAmount, newItemUnit, newItemCategory, getLatestPricePerUnit, addCustomData, onUpdateList, addToast]);

  const handleAddOcrItems = (ocrResult: OcrResult, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, vendorName?: string) => {
    const listName = addOcrPurchase(ocrResult, paymentMethod, paymentStatus, vendorName);
    addToast(t.ocrItemsAddedToList(ocrResult.items.length, listName), 'success');
    setIsOcrModalOpen(false);
  };

  const handleMarkAsPaid = (itemId: string) => {
    updateItem(listId, itemId, { paymentStatus: PaymentStatus.Paid });
    addToast(t.paymentStatusUpdated, 'success');
  };

  const handleConfirmBuy = (itemId: string, purchasedAmount: number, totalPrice: number, vendorName?: string, paymentMethod?: PaymentMethod, paymentStatus?: PaymentStatus) => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }
    const vendorId = findOrCreateVendor(vendorName);
    const itemToUpdate = list.items.find(i => i.id === itemId);

    if (itemToUpdate && itemToUpdate.category && vendorId) {
        updateCategoryVendorMap(itemToUpdate.category, vendorId);
    }

    updateItem(listId, itemId, { status: ItemStatus.Bought, paidPrice: totalPrice, purchasedAmount, vendorId, paymentMethod, paymentStatus });
    addToast(`${t.buy} ${list.items.find(i=>i.id===itemId)?.name}`, 'success');
    setItemToBuy(null);
  };

  const handleSavePurchasedItem = (itemId: string, updates: Partial<ShoppingItem>) => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }
    const itemToUpdate = list.items.find(i => i.id === itemId);

    if (itemToUpdate && itemToUpdate.category && updates.vendorId) {
        updateCategoryVendorMap(itemToUpdate.category, updates.vendorId);
    }

    updateItem(listId, itemId, updates);
    addToast(t.itemUpdated, 'info');
    setItemToEditPurchased(null);
  };

  const handleConfirmBulkBuy = (updatedItems: ShoppingItem[], sharedVendorName?: string) => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }
    const vendorId = findOrCreateVendor(sharedVendorName);
    const updatedItemMap = new Map(updatedItems.map(item => {
        if (item.category && vendorId) {
            updateCategoryVendorMap(item.category, vendorId);
        }
        return [item.id, { ...item, vendorId }];
    }));

    onUpdateList({ ...list, items: list.items.map(item => updatedItemMap.get(item.id) || item) });
    addToast(t.itemsBought, 'success');
    setIsBulkBuyModalOpen(false);
    setSelectedItemIds(new Set());
  };

  const handleSaveEdit = (itemId: string, updates: Partial<ShoppingItem>) => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }
    const originalItem = list.items.find(item => item.id === itemId);
    if (originalItem) addCustomData({ ...originalItem, ...updates });
    updateItem(listId, itemId, updates);
    addToast(t.itemUpdated, 'info');
    setItemToEdit(null);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }
    onUpdateList({ ...list, items: list.items.filter(item => item.id !== itemId) });
    addToast(t.itemDeleted, 'info');
  };

  const handleSelectItem = (itemId: string) => {
    const newSelection = new Set(selectedItemIds);
    newSelection.has(itemId) ? newSelection.delete(itemId) : newSelection.add(itemId);
    setSelectedItemIds(newSelection);
  };

  const boughtItems = useMemo(() => list ? list.items.filter(item => item.status === ItemStatus.Bought) : [], [list]);
  const totalCost = useMemo(() => boughtItems.reduce((sum, item) => sum + (item.paidPrice || 0), 0), [boughtItems]);
  const totalDue = useMemo(() => boughtItems.filter(i => i.paymentStatus === PaymentStatus.Due).reduce((sum, item) => sum + (item.paidPrice || 0), 0), [boughtItems]);

  const groupAndSortPurchasedItems = (items: ShoppingItem[], vendors: Map<string, string>): StructuredReportData[] => {
    const categoryMap: Record<string, Record<string, ShoppingItem[]>> = {};

    // Group items by category, then by vendor
    items.forEach(item => {
        const category = item.category || t.other;
        const vendorName = vendors.get(item.vendorId || '') || 'نامشخص';

        if (!categoryMap[category]) {
            categoryMap[category] = {};
        }
        if (!categoryMap[category][vendorName]) {
            categoryMap[category][vendorName] = [];
        }
        categoryMap[category][vendorName].push(item);
    });

    // Convert the map to the desired array structure and sort
    const structuredData: StructuredReportData[] = Object.keys(categoryMap)
        .sort((a, b) => a.localeCompare(b, 'fa')) // Sort categories
        .map(category => {
            const vendorsData = categoryMap[category];
            const sortedVendors = Object.keys(vendorsData)
                .sort((a, b) => a.localeCompare(b, 'fa')) // Sort vendors
                .map(vendorName => ({
                    vendorName: vendorName,
                    items: vendorsData[vendorName]
                }));

            return {
                category: category,
                vendors: sortedVendors
            };
        });

    return structuredData;
  };

  const handleDownloadDailyReport = useCallback(async () => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }
    setIsPdfLoading(true);
    try {
      // Use the new deterministic grouping function
      const structuredData = groupAndSortPurchasedItems(boughtItems, vendorMap);

      const reportComponent = (
        <ShoppingReportForPdf
          list={list}
          structuredData={structuredData}
          totalCost={totalCost}
          totalDue={totalDue}
        />
      );
      await exportComponentAsPdf(reportComponent, `${list.name}.pdf`);
    } catch (error) {
        console.error("PDF generation or structuring failed:", error);
        addToast((error as Error).message || "An unknown error occurred.", "error");
    } finally {
        setIsPdfLoading(false);
    }
  }, [list, boughtItems, vendorMap, totalCost, totalDue, addToast]);

  const handleExportCsv = useCallback(() => {
    if (!list) {
      addToast(t.syncError, 'error');
      return;
    }

    const headers = ['name', 'amount', 'unit', 'category', 'status', 'paidPrice', 'purchasedAmount', 'vendorName', 'paymentMethod', 'paymentStatus'];
    const rows = list.items.map(item => {
      const vendorName = item.vendorId ? vendorMap.get(item.vendorId) : '';
      return [
        item.name,
        String(item.amount),
        item.unit,
        item.category || '',
        item.status,
        String(item.paidPrice || ''),
        String(item.purchasedAmount || ''),
        vendorName,
        item.paymentMethod || '',
        item.paymentStatus || '',
      ];
    });

    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${list.name.replace(/ /g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV با موفقیت صادر شد', 'success');
  }, [list, vendorMap, addToast]);

  const handleExportJson = useCallback(() => {
      if (!list) {
        addToast(t.syncError, 'error');
        return;
      }
      const listWithVendorNames = {
        ...list,
        items: list.items.map(item => ({
          ...item,
          vendorName: item.vendorId ? vendorMap.get(item.vendorId) : undefined,
        })),
      };
      const dataString = JSON.stringify(listWithVendorNames, null, 2);
      const blob = new Blob([dataString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${list.name.replace(/ /g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(t.exportJsonSuccess, 'success');
  }, [list, vendorMap, addToast]);

  const pendingItems = useMemo(() => list ? list.items.filter(item => item.status === ItemStatus.Pending) : [], [list]);

  const groupItemsByCategory = (items: ShoppingItem[]): Record<string, ShoppingItem[]> => {
    return items.reduce((acc, item) => {
      const category = item.category || t.other;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ShoppingItem[]>);
  };

  const groupedPendingItems = useMemo(() => groupItemsByCategory(pendingItems), [pendingItems]);
  const groupedBoughtItems = useMemo(() => groupItemsByCategory(boughtItems), [boughtItems]);
  const totalEstimatedCost = useMemo(() => pendingItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0), [pendingItems]);

  const { setActions } = usePageActions();

  // Register page actions with Navbar
  useEffect(() => {
    const actions = (
      <>
        <Button key="export-csv" variant="ghost" size="sm" onClick={handleExportCsv} fullWidth>
          صادر CSV
        </Button>
        <Button key="export-json" variant="ghost" size="sm" onClick={handleExportJson} fullWidth>
          {t.exportListJson}
        </Button>
        <Button key="download-report" variant="primary" size="sm" onClick={handleDownloadDailyReport} disabled={isPdfLoading} fullWidth>
          {isPdfLoading ? t.downloadingPdf : t.downloadReport}
        </Button>
      </>
    );
    setActions(actions);
    return () => {
      setActions(null);
    };
  }, [setActions, handleExportCsv, handleExportJson, handleDownloadDailyReport, isPdfLoading]);

  if (!list) return (
    <div className="text-center p-8 animate-fade-in">
      <LoadingSpinner size="lg" text={t.loadingData} />
    </div>
  );

  return (
    <div>
      <Header title={list?.name || t.shoppingList} onBack={onBack} backText={t.backToDashboard} hideMenu={true} />

      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto pb-24">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-6">
                    <Card title={t.addNewItem}>
                    <div className="space-y-4">
                        <SmartAutocomplete
                          value={newItemName}
                          onChange={handleNewItemNameChange}
                          onSelect={handleItemSelect}
                          placeholder={t.itemName}
                          maxSuggestions={8}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" value={newItemAmount} onChange={e => setNewItemAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder={t.amount} className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"/>
                            <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value as Unit)} className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent">{Object.values(Unit).map(unit => <option key={unit} value={unit}>{unit}</option>)}</select>
                        </div>

                        <input type="text" list="categories" value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} placeholder={t.categoryPlaceholder} className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"/>
                        <datalist id="categories">{allCategories().map(cat => <option key={cat} value={cat}/>)}</datalist>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="secondary" onClick={() => setIsOcrModalOpen(true)} fullWidth>
                              {t.addFromReceipt}
                            </Button>
                            <Button variant="primary" onClick={handleAddItem} fullWidth>
                              {t.addItem}
                            </Button>
                        </div>
                    </div>
                    </Card>
                     <Card>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm text-secondary">{t.totalEstimatedCost}</p>
                                <CurrencyDisplay value={totalEstimatedCost} className="font-bold text-lg text-accent"/>
                            </div>
                            <div>
                                <p className="text-sm text-secondary">{t.totalCost}</p>
                                <CurrencyDisplay value={totalCost} className="font-bold text-lg text-primary"/>
                            </div>
                             <div>
                                <p className="text-sm text-secondary">{t.totalAmountDue}</p>
                                <CurrencyDisplay value={totalDue} className="font-bold text-lg text-danger"/>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            <div className="lg:col-span-2 space-y-8">
                 <section className="animate-fade-in">
                    <h2 className="text-xl font-bold text-primary border-b border-border pb-2 mb-4 animate-fade-in-down">
                      {t.toBuy} ({pendingItems.length})
                    </h2>
                    {pendingItems.length > 0 ? (
                        <div className="space-y-6">
                            {Object.entries(groupedPendingItems)
                                .sort((a, b) => a[0].localeCompare(b[0], 'fa'))
                                .map(([category, items]: [string, ShoppingItem[]]) => (
                                <div key={category}>
                                    <h3 className="text-md font-bold text-secondary mb-3">{category}</h3>
                                    <ul className="space-y-3">
                                    {items.map(item => (
                                        <PendingItemRow
                                          key={item.id}
                                          item={item}
                                          isSelected={selectedItemIds.has(item.id)}
                                          onSelect={() => handleSelectItem(item.id)}
                                          onBuy={() => setItemToBuy(item)}
                                          onEdit={() => setItemToEdit(item)}
                                          onDelete={() => handleDeleteItem(item.id)}
                                        />
                                    ))}
                                    </ul>
                                </div>
                            ))}
                        </div>)
                    : <p className="text-secondary">{t.allItemsPurchased}</p>}
                </section>

                <section className="animate-fade-in">
                    <h2 className="text-xl font-bold text-primary border-b border-border pb-2 mb-4 animate-fade-in-down">
                      {t.purchased} ({boughtItems.length})
                    </h2>
                    {boughtItems.length > 0 ? (
                    <div className="space-y-6">
                         {Object.entries(groupedBoughtItems)
                                .sort((a, b) => a[0].localeCompare(b[0], 'fa'))
                                .map(([category, items]: [string, ShoppingItem[]]) => (
                                <div key={category}>
                                    <h3 className="text-md font-bold text-secondary mb-3">{category}</h3>
                                    <ul className="space-y-4">
                                        {items.map(item => (
                                            <PurchasedItemRow
                                              key={item.id}
                                              item={item}
                                              vendorName={item.vendorId ? vendorMap.get(item.vendorId) : undefined}
                                              onMarkAsPaid={item.paymentStatus === PaymentStatus.Due ? () => handleMarkAsPaid(item.id) : undefined}
                                              onEdit={() => setItemToEditPurchased(item)}
                                              onMoveToPending={() => updateItem(listId, item.id, { status: ItemStatus.Pending, paidPrice: undefined, purchasedAmount: undefined, vendorId: undefined, paymentMethod: undefined, paymentStatus: undefined })}
                                            />
                                        ))}
                                    </ul>
                                </div>
                         ))}
                    </div>)
                    : <p className="text-secondary">{t.noItemsPurchasedYet}</p>}
                </section>
            </div>
       </div>
      </main>

      <BulkActions
        selectedCount={selectedItemIds.size}
        onDeselectAll={() => setSelectedItemIds(new Set())}
        actions={[
          {
            label: t.bulkBuy,
            icon: <CheckIcon />,
            onClick: () => setIsBulkBuyModalOpen(true),
            variant: 'primary',
          },
        ]}
      />

      {itemToBuy && <BuyItemModal item={itemToBuy} onClose={() => setItemToBuy(null)} onConfirm={handleConfirmBuy} />}
      {itemToEdit && <EditItemModal item={itemToEdit} onClose={() => setItemToEdit(null)} onSave={handleSaveEdit} />}
      {itemToEditPurchased && <EditPurchasedItemModal item={itemToEditPurchased} onClose={() => setItemToEditPurchased(null)} onSave={handleSavePurchasedItem} />}
      {isBulkBuyModalOpen && <BulkBuyModal items={pendingItems.filter(i => selectedItemIds.has(i.id))} onClose={() => setIsBulkBuyModalOpen(false)} onConfirm={handleConfirmBulkBuy} />}
      {isOcrModalOpen && <OcrImportModal onClose={() => setIsOcrModalOpen(false)} onConfirm={handleAddOcrItems} />}

    </div>
  );
};

// New component for PDF layout
const ShoppingReportForPdf: React.FC<{ list: ShoppingList, structuredData: StructuredReportData[], totalCost: number, totalDue: number }> = ({ list, structuredData, totalCost, totalDue }) => {
  return (
    <div className="pdf-render-container" style={{ direction: 'rtl' }}>
      <style>{`
        .pdf-render-container { padding: 25px !important; font-family: 'Vazirmatn', sans-serif; color: #000; background-color: #fff; line-height: 1.4 !important; }
        .pdf-render-container h1 { font-size: 18pt !important; font-weight: bold; text-align: center; margin-bottom: 8px !important; }
        .pdf-render-container .subtitle { text-align: center; color: #555; margin-bottom: 16px !important; font-size: 10pt !important; }

        .pdf-render-container .summary-table { width: 60% !important; margin-left: auto !important; margin-right: auto !important; margin-bottom: 20px !important; font-size: 8pt !important; border-collapse: collapse !important; }
        .pdf-render-container .summary-table td { padding: 2px 4px !important; border: 1px solid #ccc !important; }
        .pdf-render-container .summary-table td:first-child { font-weight: bold; }

        .pdf-render-container h2 { font-size: 14pt !important; font-weight: bold; margin-bottom: 8px !important; border-bottom: 1px solid #333 !important; padding-bottom: 3px !important; }
        .pdf-render-container .category-block { break-inside: avoid-page; margin-bottom: 12px !important; }

        .pdf-render-container h3 { font-size: 11pt !important; font-weight: bold; margin-bottom: 6px !important; background-color: #f2f2f2 !important; padding: 4px 6px !important; border-radius: 3px; }
        .pdf-render-container .vendor-block { break-inside: avoid; margin-bottom: 10px !important; padding-left: 8px !important; }
        .pdf-render-container h4 { font-size: 9pt !important; font-weight: bold; color: #333; margin-bottom: 4px !important; }

        .pdf-render-container .items-table { width: 100%; text-align: right; border-collapse: collapse !important; font-size: 8pt !important; }
        .pdf-render-container .items-table th, .pdf-render-container .items-table td { padding: 3px 4px !important; border: 1px solid #ddd !important; vertical-align: top; }
        .pdf-render-container .items-table th { background-color: #fafafa !important; font-weight: bold; }
        .pdf-render-container .unpaid-row td { background-color: #F8D7DA !important; }
      `}</style>

      <h1>{list.name}</h1>
      <p className="subtitle">{t.reportSummary}</p>

      <table className="summary-table">
        <tbody>
          <tr><td>{t.totalCost}</td><td>{totalCost.toLocaleString('fa-IR')} {t.currency}</td></tr>
          <tr><td>{t.totalAmountDue}</td><td>{totalDue.toLocaleString('fa-IR')} {t.currency}</td></tr>
          <tr><td>{t.itemsPurchased}</td><td>{list.items.filter(i => i.status === ItemStatus.Bought).length.toLocaleString('fa-IR')}</td></tr>
        </tbody>
      </table>

      <h2>{t.purchased}</h2>
      {structuredData.map((categoryData) => (
          <div key={categoryData.category} className="category-block">
            <h3>{categoryData.category}</h3>
            {categoryData.vendors.map((vendorData) => (
              <div key={vendorData.vendorName} className="vendor-block">
                <h4>{vendorData.vendorName}</h4>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{width: '45%'}}>{t.itemName}</th>
                      <th>{t.amount}</th>
                      <th>{t.totalCost}</th>
                      <th>{t.paymentStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorData.items.map(item => (
                      <tr key={item.id} className={item.paymentStatus === PaymentStatus.Due ? 'unpaid-row' : ''}>
                        <td>{item.name}</td>
                        <td>{`${item.purchasedAmount?.toLocaleString('fa-IR') || item.amount.toLocaleString('fa-IR')} ${item.unit}`}</td>
                        <td>{item.paidPrice?.toLocaleString('fa-IR')} {t.currency}</td>
                        <td>{item.paymentStatus || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
      ))}
    </div>
  );
};


export default ShoppingView;
