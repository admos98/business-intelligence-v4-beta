// src/store/helpers/accountHelpers.ts
// Helper functions for accounting domain

import { Account, AccountType } from '../../../shared/types';
import { t } from '../../../shared/translations';

export const createDefaultChartOfAccounts = (): Account[] => {
    const now = new Date().toISOString();
    return [
        // ASSETS (1xxx)
        {
            id: 'acc-1-101',
            code: '1-101',
            name: t.cash,
            nameEn: 'Cash',
            type: AccountType.Asset,
            balance: 0,
            isActive: true,
            description: 'صندوق نقدی',
            createdAt: now,
        },
        {
            id: 'acc-1-102',
            code: '1-102',
            name: t.bank,
            nameEn: 'Bank',
            type: AccountType.Asset,
            balance: 0,
            isActive: true,
            description: 'حساب بانکی',
            createdAt: now,
        },
        {
            id: 'acc-1-201',
            code: '1-201',
            name: t.inventory,
            nameEn: 'Inventory',
            type: AccountType.Asset,
            balance: 0,
            isActive: true,
            description: 'موجودی کالا و مواد اولیه',
            createdAt: now,
        },
        {
            id: 'acc-1-301',
            code: '1-301',
            name: t.accountsReceivable,
            nameEn: 'Accounts Receivable',
            type: AccountType.Asset,
            balance: 0,
            isActive: true,
            description: 'طلب از مشتریان',
            createdAt: now,
        },

        // LIABILITIES (2xxx)
        {
            id: 'acc-2-101',
            code: '2-101',
            name: t.accountsPayable,
            nameEn: 'Accounts Payable',
            type: AccountType.Liability,
            balance: 0,
            isActive: true,
            description: 'بدهی به تامین‌کنندگان',
            createdAt: now,
        },
        {
            id: 'acc-2-201',
            code: '2-201',
            name: t.taxPayable,
            nameEn: 'Tax Payable',
            type: AccountType.Liability,
            balance: 0,
            isActive: true,
            description: 'مالیات قابل پرداخت',
            createdAt: now,
        },

        // EQUITY (3xxx)
        {
            id: 'acc-3-101',
            code: '3-101',
            name: t.capital,
            nameEn: 'Capital',
            type: AccountType.Equity,
            balance: 0,
            isActive: true,
            description: 'سرمایه اولیه',
            createdAt: now,
        },
        {
            id: 'acc-3-201',
            code: '3-201',
            name: t.retainedEarnings,
            nameEn: 'Retained Earnings',
            type: AccountType.Equity,
            balance: 0,
            isActive: true,
            description: 'سود (زیان) انباشته',
            createdAt: now,
        },

        // REVENUE (4xxx)
        {
            id: 'acc-4-101',
            code: '4-101',
            name: t.salesRevenue,
            nameEn: 'Sales Revenue',
            type: AccountType.Revenue,
            balance: 0,
            isActive: true,
            description: 'درآمد حاصل از فروش',
            createdAt: now,
        },

        // COGS (5xxx)
        {
            id: 'acc-5-101',
            code: '5-101',
            name: t.costOfGoodsSold,
            nameEn: 'Cost of Goods Sold',
            type: AccountType.COGS,
            balance: 0,
            isActive: true,
            description: 'بهای تمام شده کالای فروخته شده',
            createdAt: now,
        },

        // EXPENSES (6xxx)
        {
            id: 'acc-6-101',
            code: '6-101',
            name: 'هزینه حقوق و دستمزد',
            nameEn: 'Payroll Expense',
            type: AccountType.Expense,
            balance: 0,
            isActive: true,
            description: 'هزینه حقوق و مزایای پرسنل',
            createdAt: now,
        },
        {
            id: 'acc-6-201',
            code: '6-201',
            name: 'هزینه اجاره',
            nameEn: 'Rent Expense',
            type: AccountType.Expense,
            balance: 0,
            isActive: true,
            description: 'هزینه اجاره محل',
            createdAt: now,
        },
        {
            id: 'acc-6-301',
            code: '6-301',
            name: 'هزینه برق و آب و گاز',
            nameEn: 'Utilities Expense',
            type: AccountType.Expense,
            balance: 0,
            isActive: true,
            description: 'هزینه‌های برق، آب و گاز',
            createdAt: now,
        },
    ];
};

