import React, { useState, useMemo } from 'react';
import { useShoppingStore } from '../store/useShoppingStore';
import Header from '../components/common/Header';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { ShoppingItem, POSItem, ItemStatus } from '../../shared/types';
import { usePageActions } from '../contexts/PageActionsContext';
import { exportToExcel } from '../lib/excelExport';
import { useToast } from '../components/common/Toast';

interface ValidationIssue {
  type: 'duplicate' | 'missing_field' | 'orphaned_reference' | 'invalid_value' | 'inconsistency';
  severity: 'error' | 'warning' | 'info';
  entity: string;
  entityId: string;
  field?: string;
  message: string;
  suggestion?: string;
}

export const DataValidationPage: React.FC = () => {
  const store = useShoppingStore();
  const { setActions } = usePageActions();
  const { addToast } = useToast();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const issues = useMemo(() => {
    const allIssues: ValidationIssue[] = [];

    // 1. Check for duplicate items (same name and unit)
    const itemMap = new Map<string, ShoppingItem[]>();
    store.lists.forEach(list => {
      list.items.forEach(item => {
        const key = `${item.name.toLowerCase()}-${item.unit}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, []);
        }
        itemMap.get(key)!.push(item);
      });
    });
    itemMap.forEach((items, key) => {
      if (items.length > 1) {
        const [name, unit] = key.split('-');
        allIssues.push({
          type: 'duplicate',
          severity: 'warning',
          entity: 'ShoppingItem',
          entityId: items.map(i => i.id).join(', '),
          message: `${items.length} مورد تکراری با نام "${name}" و واحد "${unit}"`,
          suggestion: 'در نظر بگیرید که این موارد را ادغام کنید',
        });
      }
    });

    // 2. Check for duplicate POS items
    const posItemMap = new Map<string, POSItem[]>();
    store.posItems.forEach(item => {
      const key = `${item.name.toLowerCase()}-${item.category}`;
      if (!posItemMap.has(key)) {
        posItemMap.set(key, []);
      }
      posItemMap.get(key)!.push(item);
    });
    posItemMap.forEach((items, key) => {
      if (items.length > 1) {
        const [name, category] = key.split('-');
        allIssues.push({
          type: 'duplicate',
          severity: 'warning',
          entity: 'POSItem',
          entityId: items.map(i => i.id).join(', '),
          message: `${items.length} مورد تکراری POS با نام "${name}" و دسته "${category}"`,
          suggestion: 'در نظر بگیرید که این موارد را ادغام کنید',
        });
      }
    });

    // 3. Check for missing required fields in shopping items
    store.lists.forEach(list => {
      list.items.forEach(item => {
        if (!item.name || item.name.trim() === '') {
          allIssues.push({
            type: 'missing_field',
            severity: 'error',
            entity: 'ShoppingItem',
            entityId: item.id,
            field: 'name',
            message: `مورد بدون نام در لیست "${list.name}"`,
            suggestion: 'نام مورد را اضافه کنید',
          });
        }
        if (!item.unit) {
          allIssues.push({
            type: 'missing_field',
            severity: 'error',
            entity: 'ShoppingItem',
            entityId: item.id,
            field: 'unit',
            message: `مورد "${item.name}" بدون واحد`,
            suggestion: 'واحد مورد را مشخص کنید',
          });
        }
        if (item.paidPrice !== undefined && item.paidPrice < 0) {
          allIssues.push({
            type: 'invalid_value',
            severity: 'error',
            entity: 'ShoppingItem',
            entityId: item.id,
            field: 'paidPrice',
            message: `قیمت منفی برای "${item.name}"`,
            suggestion: 'قیمت را اصلاح کنید',
          });
        }
        if (item.purchasedAmount !== undefined && item.purchasedAmount < 0) {
          allIssues.push({
            type: 'invalid_value',
            severity: 'error',
            entity: 'ShoppingItem',
            entityId: item.id,
            field: 'purchasedAmount',
            message: `مقدار منفی برای "${item.name}"`,
            suggestion: 'مقدار را اصلاح کنید',
          });
        }
      });
    });

    // 4. Check for orphaned vendor references
    const vendorIds = new Set(store.vendors.map(v => v.id));
    store.lists.forEach(list => {
      list.items.forEach(item => {
        if (item.vendorId && !vendorIds.has(item.vendorId)) {
          allIssues.push({
            type: 'orphaned_reference',
            severity: 'warning',
            entity: 'ShoppingItem',
            entityId: item.id,
            field: 'vendorId',
            message: `مورد "${item.name}" به تامین‌کننده حذف شده اشاره می‌کند`,
            suggestion: 'تامین‌کننده را حذف یا اصلاح کنید',
          });
        }
      });
    });

    // 5. Check for missing POS item references in recipes
    // Note: Recipe ingredients reference bought items by name/unit, not POS items directly
    // So we check if the ingredient item exists in itemInfoMap or has been purchased
    const knownItemKeys = new Set(Object.keys(store.itemInfoMap));
    store.recipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        const itemKey = `${ing.itemName}-${ing.itemUnit}`;
        if (!knownItemKeys.has(itemKey)) {
          // Check if item has been purchased at least once
          const hasBeenPurchased = store.lists.some(list =>
            list.items.some(item => item.name === ing.itemName && item.unit === ing.itemUnit && item.status === ItemStatus.Bought)
          );
          if (!hasBeenPurchased) {
            allIssues.push({
              type: 'orphaned_reference',
              severity: 'warning',
              entity: 'Recipe',
              entityId: recipe.id,
              field: 'ingredients',
              message: `دستور "${recipe.name}" به کالای "${ing.itemName}" که هنوز خریداری نشده اشاره می‌کند`,
              suggestion: 'کالای مورد نظر را خریداری کنید یا از دستور حذف کنید',
            });
          }
        }
      });
    });

    // 6. Check for invalid dates
    store.lists.forEach(list => {
      if (list.createdAt && new Date(list.createdAt).toString() === 'Invalid Date') {
        allIssues.push({
          type: 'invalid_value',
          severity: 'error',
          entity: 'ShoppingList',
          entityId: list.id,
          field: 'createdAt',
          message: `تاریخ نامعتبر در لیست "${list.name}"`,
          suggestion: 'تاریخ را اصلاح کنید',
        });
      }
    });

    // 7. Check for customer balance inconsistencies
    store.customers.forEach(customer => {
      const calculatedBalance = store.getCustomerBalance(customer.id);
      if (Math.abs(customer.balance - calculatedBalance) > 0.01) {
        allIssues.push({
          type: 'inconsistency',
          severity: 'warning',
          entity: 'Customer',
          entityId: customer.id,
          field: 'balance',
          message: `عدم تطابق موجودی برای مشتری "${customer.name}" (ذخیره شده: ${customer.balance}, محاسبه شده: ${calculatedBalance})`,
          suggestion: 'موجودی را مجدداً محاسبه کنید',
        });
      }
    });

    // 8. Check for recipes with zero or negative quantities
    store.recipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => {
        if (ing.requiredQuantity <= 0) {
          allIssues.push({
            type: 'invalid_value',
            severity: 'error',
            entity: 'Recipe',
            entityId: recipe.id,
            field: 'ingredients',
            message: `دستور "${recipe.name}" دارای مقدار نامعتبر در مواد اولیه`,
            suggestion: 'مقدار مواد اولیه را اصلاح کنید',
          });
        }
      });
    });

    return allIssues;
  }, [store]);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) return false;
      if (selectedType !== 'all' && issue.type !== selectedType) return false;
      return true;
    });
  }, [issues, selectedSeverity, selectedType]);

  const issueCounts = useMemo(() => {
    return {
      total: issues.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
    };
  }, [issues]);

  const handleExportExcel = () => {
    const data = filteredIssues.map(issue => ({
      'نوع': issue.type,
      'شدت': issue.severity,
      'موجودیت': issue.entity,
      'شناسه': issue.entityId,
      'فیلد': issue.field || '-',
      'پیام': issue.message,
      'پیشنهاد': issue.suggestion || '-',
    }));

    exportToExcel(data, `data_validation_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('گزارش اعتبارسنجی با موفقیت صادر شد', 'success');
  };

  React.useEffect(() => {
    setActions(
      <>
        <Button key="export-excel" variant="ghost" size="sm" onClick={handleExportExcel} disabled={filteredIssues.length === 0}>
          صادر Excel
        </Button>
      </>
    );
    return () => setActions(null);
  }, [setActions, filteredIssues.length]);

  const getSeverityColor = (severity: ValidationIssue['severity']) => {
    switch (severity) {
      case 'error': return 'text-danger bg-danger/10 border-danger/20';
      case 'warning': return 'text-warning bg-warning/10 border-warning/20';
      case 'info': return 'text-info bg-info/10 border-info/20';
      default: return 'text-secondary bg-background border-border';
    }
  };

  const getTypeLabel = (type: ValidationIssue['type']) => {
    const labels: Record<ValidationIssue['type'], string> = {
      duplicate: 'تکراری',
      missing_field: 'فیلد خالی',
      orphaned_reference: 'ارجاع نامعتبر',
      invalid_value: 'مقدار نامعتبر',
      inconsistency: 'عدم تطابق',
    };
    return labels[type] || type;
  };

  return (
    <>
      <Header title="اعتبارسنجی داده‌ها" onBack={() => window.history.back()} backText="بازگشت" hideMenu={true} />
      <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{issueCounts.total}</div>
              <div className="text-sm text-secondary mt-1">کل موارد</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-danger">{issueCounts.errors}</div>
              <div className="text-sm text-secondary mt-1">خطاها</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{issueCounts.warnings}</div>
              <div className="text-sm text-secondary mt-1">هشدارها</div>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="text-2xl font-bold text-info">{issueCounts.info}</div>
              <div className="text-sm text-secondary mt-1">اطلاعات</div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card title="فیلترها" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">شدت</label>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">همه</option>
                <option value="error">خطا</option>
                <option value="warning">هشدار</option>
                <option value="info">اطلاعات</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">نوع</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="all">همه</option>
                <option value="duplicate">تکراری</option>
                <option value="missing_field">فیلد خالی</option>
                <option value="orphaned_reference">ارجاع نامعتبر</option>
                <option value="invalid_value">مقدار نامعتبر</option>
                <option value="inconsistency">عدم تطابق</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Issues List */}
        {filteredIssues.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-secondary">
              {issues.length === 0 ? 'هیچ مشکلی یافت نشد! ✅' : 'هیچ موردی با فیلترهای انتخابی یافت نشد'}
            </div>
          </Card>
        ) : (
          <Card>
            <div className="space-y-3">
              {filteredIssues.map((issue, index) => (
                <div
                  key={`${issue.entityId}-${index}`}
                  className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-surface rounded text-xs font-medium">
                          {getTypeLabel(issue.type)}
                        </span>
                        <span className="px-2 py-1 bg-surface rounded text-xs font-medium">
                          {issue.entity}
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-1">{issue.message}</div>
                      {issue.suggestion && (
                        <div className="text-xs text-secondary mt-1">
                          💡 پیشنهاد: {issue.suggestion}
                        </div>
                      )}
                      {issue.field && (
                        <div className="text-xs text-secondary mt-1">
                          فیلد: {issue.field}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
};
