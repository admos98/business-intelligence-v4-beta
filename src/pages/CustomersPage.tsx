// src/pages/CustomersPage.tsx

import React, { useState } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import CurrencyDisplay from '../components/common/CurrencyDisplay';
import { Customer } from '../../shared/types';

export const CustomersPage: React.FC = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer, getCustomerBalance } = useShoppingStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    creditLimit: 0,
    paymentTerms: 30,
    notes: '',
  });

  const handleSave = () => {
    if (!formData.name) {
      alert('لطفاً نام مشتری را وارد کنید');
      return;
    }

    if (editingId) {
      updateCustomer(editingId, formData);
    } else {
      addCustomer(formData as Omit<Customer, 'id' | 'createdAt' | 'balance'>);
    }

    setFormData({ name: '', email: '', phone: '', address: '', taxId: '', creditLimit: 0, paymentTerms: 30, notes: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleEdit = (customer: Customer) => {
    setFormData(customer);
    setEditingId(customer.id);
    setIsAdding(true);
  };

  const handleDelete = (customerId: string) => {
    if (confirm('آیا از حذف این مشتری اطمینان دارید؟')) {
      try {
        deleteCustomer(customerId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'خطا در حذف مشتری';
        alert(message);
      }
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {t.customers}
        </h1>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} variant="primary">
            {t.addCustomer}
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? t.editCustomer : t.addCustomer}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t.customerName} *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.customerEmail}</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.customerPhone}</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.taxId}</label>
              <input
                type="text"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.creditLimit}</label>
              <input
                type="number"
                value={formData.creditLimit || 0}
                onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t.paymentTerms} (روز)</label>
              <input
                type="number"
                value={formData.paymentTerms || 30}
                onChange={(e) => setFormData({ ...formData, paymentTerms: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">{t.customerAddress}</label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                rows={2}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">{t.notes}</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                rows={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} variant="primary">
              {t.save}
            </Button>
            <Button onClick={() => { setIsAdding(false); setEditingId(null); setFormData({});}} variant="secondary">
              {t.cancel}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-xl font-semibold mb-4">لیست مشتریان</h2>
        {customers.length === 0 ? (
          <p className="text-center py-8 text-gray-500">هیچ مشتری ثبت نشده است</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.customerName}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.contact}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.paymentTerms}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.balance}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">
                      <div className="font-medium">{customer.name}</div>
                      {customer.taxId && <div className="text-xs text-gray-500">{customer.taxId}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {customer.email && <div>{customer.email}</div>}
                      {customer.phone && <div className="text-gray-500">{customer.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {customer.paymentTerms ? t.netDays(customer.paymentTerms) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      <CurrencyDisplay value={getCustomerBalance(customer.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button onClick={() => handleEdit(customer)} variant="secondary" size="sm">
                          {t.edit}
                        </Button>
                        <Button onClick={() => handleDelete(customer.id)} variant="danger" size="sm">
                          {t.delete}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
