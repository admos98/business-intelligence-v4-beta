// src/pages/TaxSettingsPage.tsx

import React, { useState } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import { t } from '../../shared/translations';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { TaxRate } from '../../shared/types';

export const TaxSettingsPage: React.FC = () => {
  const { taxSettings, taxRates, updateTaxSettings, addTaxRate, updateTaxRate, deleteTaxRate } = useShoppingStore();
  const [isAddingRate, setIsAddingRate] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    rate: 0,
    description: '',
  });

  const handleToggleTax = () => {
    updateTaxSettings({ enabled: !taxSettings.enabled });
  };

  const handleToggleIncludeTax = () => {
    updateTaxSettings({ includeTaxInPrice: !taxSettings.includeTaxInPrice });
  };

  const handleToggleShowTax = () => {
    updateTaxSettings({ showTaxOnReceipts: !taxSettings.showTaxOnReceipts });
  };

  const handleSetDefaultRate = (rateId: string) => {
    updateTaxSettings({ defaultTaxRateId: rateId });
  };

  const handleAddRate = () => {
    if (!formData.name || formData.rate <= 0) {
      alert('لطفاً نام و نرخ مالیات را وارد کنید');
      return;
    }

    addTaxRate({
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      rate: formData.rate / 100, // Convert percentage to decimal
      isActive: true,
      accountId: '', // Will be set in store
      description: formData.description || undefined,
    });

    setFormData({ name: '', nameEn: '', rate: 0, description: '' });
    setIsAddingRate(false);
  };

  const handleUpdateRate = () => {
    if (!editingRateId) return;

    updateTaxRate(editingRateId, {
      name: formData.name,
      nameEn: formData.nameEn || undefined,
      rate: formData.rate / 100,
      description: formData.description || undefined,
    });

    setFormData({ name: '', nameEn: '', rate: 0, description: '' });
    setEditingRateId(null);
  };

  const handleEditRate = (rate: TaxRate) => {
    setFormData({
      name: rate.name,
      nameEn: rate.nameEn || '',
      rate: rate.rate * 100, // Convert decimal to percentage
      description: rate.description || '',
    });
    setEditingRateId(rate.id);
    setIsAddingRate(false);
  };

  const handleToggleRateActive = (rateId: string, isActive: boolean) => {
    updateTaxRate(rateId, { isActive: !isActive });
  };

  const handleDeleteRate = (rateId: string) => {
    if (confirm('آیا از حذف این نرخ مالیات اطمینان دارید؟')) {
      deleteTaxRate(rateId);
    }
  };

  const handleCancelForm = () => {
    setFormData({ name: '', nameEn: '', rate: 0, description: '' });
    setIsAddingRate(false);
    setEditingRateId(null);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          {t.taxSettings}
        </h1>
      </div>

      {/* Global Tax Settings */}
      <Card>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
          تنظیمات عمومی مالیات
        </h2>

        <div className="space-y-4">
          {/* Enable/Disable Tax */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t.enableTax}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {taxSettings.enabled ? t.taxEnabled : t.taxDisabled}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={taxSettings.enabled}
                onChange={handleToggleTax}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Tax Inclusive/Exclusive */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t.includeTaxInPrice}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {taxSettings.includeTaxInPrice ? t.taxIncluded : t.taxExcluded}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={taxSettings.includeTaxInPrice}
                onChange={handleToggleIncludeTax}
                disabled={!taxSettings.enabled}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
            </label>
          </div>

          {/* Show Tax on Receipts */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100">
                {t.showTaxOnReceipts}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                نمایش جزئیات مالیات در رسیدها
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={taxSettings.showTaxOnReceipts}
                onChange={handleToggleShowTax}
                disabled={!taxSettings.enabled}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* Tax Rates */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {t.taxRates}
          </h2>
          {!isAddingRate && !editingRateId && (
            <Button
              onClick={() => setIsAddingRate(true)}
              variant="primary"
              size="sm"
            >
              {t.addTaxRate}
            </Button>
          )}
        </div>

        {/* Add/Edit Form */}
        {(isAddingRate || editingRateId) && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-800 dark:text-gray-100">
              {editingRateId ? t.editTaxRate : t.addTaxRate}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  نام فارسی *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: مالیات بر ارزش افزوده"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  نام انگلیسی
                </label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Example: VAT"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  نرخ (درصد) *
                </label>
                <input
                  type="number"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  placeholder="9"
                  step="0.1"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  توضیحات
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="توضیحات اختیاری"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={editingRateId ? handleUpdateRate : handleAddRate}
                variant="primary"
                size="sm"
              >
                {editingRateId ? 'ذخیره' : 'افزودن'}
              </Button>
              <Button
                onClick={handleCancelForm}
                variant="secondary"
                size="sm"
              >
                انصراف
              </Button>
            </div>
          </div>
        )}

        {/* Tax Rates List */}
        <div className="space-y-3">
          {taxRates.length === 0 ? (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400">
              هیچ نرخ مالیاتی تعریف نشده است
            </p>
          ) : (
            taxRates.map((rate) => (
              <div
                key={rate.id}
                className={`p-4 rounded-lg border-2 ${
                  taxSettings.defaultTaxRateId === rate.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                        {rate.name}
                      </h3>
                      {rate.nameEn && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({rate.nameEn})
                        </span>
                      )}
                      <span className="px-2 py-1 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                        {(rate.rate * 100).toFixed(1)}%
                      </span>
                      {taxSettings.defaultTaxRateId === rate.id && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                          پیش‌فرض
                        </span>
                      )}
                      {!rate.isActive && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                          غیرفعال
                        </span>
                      )}
                    </div>
                    {rate.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {rate.description}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {taxSettings.defaultTaxRateId !== rate.id && (
                      <Button
                        onClick={() => handleSetDefaultRate(rate.id)}
                        variant="secondary"
                        size="sm"
                      >
                        تنظیم به عنوان پیش‌فرض
                      </Button>
                    )}
                    <Button
                      onClick={() => handleToggleRateActive(rate.id, rate.isActive)}
                      variant={rate.isActive ? 'secondary' : 'primary'}
                      size="sm"
                    >
                      {rate.isActive ? 'غیرفعال' : 'فعال'}
                    </Button>
                    <Button
                      onClick={() => handleEditRate(rate)}
                      variant="secondary"
                      size="sm"
                    >
                      ویرایش
                    </Button>
                    <Button
                      onClick={() => handleDeleteRate(rate.id)}
                      variant="danger"
                      size="sm"
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Help Text */}
      {taxSettings.enabled && (
        <Card>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
            راهنما
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              • <strong>فعال‌سازی مالیات:</strong> با فعال کردن این گزینه، مالیات به تراکنش‌های فروش اعمال می‌شود.
            </p>
            <p>
              • <strong>قیمت شامل مالیات:</strong> اگر این گزینه فعال باشد، مالیات در قیمت محصولات لحاظ شده است. در غیر این صورت، مالیات به قیمت اضافه می‌شود.
            </p>
            <p>
              • <strong>نرخ پیش‌فرض:</strong> این نرخ به طور خودکار برای محصولات جدید اعمال می‌شود.
            </p>
            <p>
              • <strong>محصولات مشمول مالیات:</strong> می‌توانید برای هر محصول مشخص کنید که آیا مشمول مالیات است یا خیر.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
