import React, { useState, useMemo, useEffect } from 'react';
import { t } from '../../shared/translations';
import { useShoppingStore } from '../store/useShoppingStore';
import Header from '../components/common/Header';
import { Vendor, ItemStatus } from '../../shared/types';
import VendorModal from '../components/modals/VendorModal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useToast } from '../components/common/Toast';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import Button from '../components/common/Button';
import { usePageActions } from '../contexts/PageActionsContext';

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

interface VendorsDashboardProps {
  onBack: () => void;
}

const VendorsDashboard: React.FC<VendorsDashboardProps> = ({ onBack }) => {
  const { vendors, lists, deleteVendor } = useShoppingStore();
  const [modalState, setModalState] = useState<{ open: boolean; vendor?: Vendor }>({ open: false });
  const { addToast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; vendor?: Vendor }>({ isOpen: false });

  const vendorStats = useMemo(() => {
    const stats = new Map<string, { totalSpent: number; purchaseCount: number }>();
    lists.forEach(list => {
      list.items.forEach(item => {
        if (item.status === ItemStatus.Bought && item.vendorId) {
          const currentStats = stats.get(item.vendorId) || { totalSpent: 0, purchaseCount: 0 };
          currentStats.totalSpent += item.paidPrice || 0;
          currentStats.purchaseCount += 1;
          stats.set(item.vendorId, currentStats);
        }
      });
    });
    return stats;
  }, [lists]);

  const handleDeleteVendor = (vendor: Vendor) => {
    setDeleteConfirm({ isOpen: true, vendor });
  };

  const confirmDelete = () => {
    if (deleteConfirm.vendor) {
        deleteVendor(deleteConfirm.vendor.id);
        addToast(t.vendorDeleted, 'info');
    }
  };

  const handleExportJson = () => {
    if (vendors.length === 0) return;

    const dataToExport = vendors
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
      .map(vendor => ({
        ...vendor,
        stats: vendorStats.get(vendor.id) || { totalSpent: 0, purchaseCount: 0 }
      }));

    const dataString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mehrnoosh_cafe_vendors.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t.exportJsonSuccess, 'success');
  };

  const handleExportCsv = () => {
    if (vendors.length === 0) return;

    const headers = ['Vendor Name', 'Contact Person', 'Phone', 'Total Spent', 'Purchase Count'];
    const rows = vendors
      .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
      .map(vendor => {
        const stats = vendorStats.get(vendor.id) || { totalSpent: 0, purchaseCount: 0 };
        return [vendor.name, vendor.contactPerson || '', vendor.phone || '', String(stats.totalSpent), String(stats.purchaseCount)];
      });
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mehrnoosh_cafe_vendors_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(t.exportJsonSuccess, 'success');
  };

  const { setActions } = usePageActions();

  // Register page actions with Navbar
  useEffect(() => {
    setActions(
      <>
        <Button variant="ghost" size="sm" onClick={handleExportCsv} disabled={vendors.length === 0} fullWidth>
          {t.exportCsv || 'صادر CSV'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleExportJson} disabled={vendors.length === 0} fullWidth>
          {t.exportJson}
        </Button>
      </>
    );
    return () => setActions(null);
  }, [setActions, handleExportCsv, handleExportJson, vendors.length]);

  return (
    <>
      <Header title={t.vendorsDashboardTitle} onBack={onBack} backText={t.backToDashboard} hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {vendors.length === 0 ? (
          <div className="text-center py-16 px-6 bg-surface rounded-xl border border-border shadow-card">
            <p className="text-secondary text-lg">{t.noVendorsYet}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vendors.sort((a,b) => a.name.localeCompare(b.name, 'fa')).map(vendor => (
              <div key={vendor.id} className="bg-surface rounded-xl border border-border shadow-card flex flex-col">
                <div className="p-5 flex-grow">
                  <h2 className="text-lg font-bold text-primary mb-2">{vendor.name}</h2>
                  <div className="text-sm text-secondary space-y-1 mb-4">
                    {vendor.contactPerson && <p><strong>{t.contactPerson}:</strong> {vendor.contactPerson}</p>}
                    {vendor.phone && <p><strong>{t.phone}:</strong> {vendor.phone}</p>}
                    {vendor.address && <p><strong>{t.address}:</strong> {vendor.address}</p>}
                  </div>
                   <div className="grid grid-cols-2 gap-4 text-center border-t border-border pt-4">
                        <div>
                            <p className="text-xs text-secondary">{t.totalSpentWithVendor}</p>
                            <CurrencyDisplay value={vendorStats.get(vendor.id)?.totalSpent || 0} className="font-bold text-accent" />
                        </div>
                        <div>
                             <p className="text-xs text-secondary">{t.totalPurchases}</p>
                            <span className="font-bold text-primary">{(vendorStats.get(vendor.id)?.purchaseCount || 0).toLocaleString('fa-IR')}</span>
                        </div>
                   </div>
                </div>
                <div className="p-2 border-t border-border flex justify-end gap-2">
                    <button onClick={() => setModalState({ open: true, vendor })} className="p-1.5 text-secondary hover:text-primary"><EditIcon/></button>
                    <button onClick={() => handleDeleteVendor(vendor)} className="p-1.5 text-secondary hover:text-danger"><DeleteIcon/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {modalState.open && (
        <VendorModal
          vendorToEdit={modalState.vendor}
          onClose={() => setModalState({ open: false })}
        />
      )}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={confirmDelete}
        title={t.confirmDeleteTitle}
        message={deleteConfirm.vendor ? t.confirmDeleteVendor(deleteConfirm.vendor.name) : ''}
        variant="danger"
      />
    </>
  );
};

export default VendorsDashboard;
