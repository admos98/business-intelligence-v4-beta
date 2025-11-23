// src/lib/excelExport.ts
// Excel export utilities using CSV format (Excel-compatible)

import { logger } from '../utils/logger';

export interface ExcelRow {
  [key: string]: string | number | boolean | null | undefined;
}

export const exportToExcel = (
  data: ExcelRow[],
  filename: string,
  headers?: string[]
) => {
  if (data.length === 0) {
    logger.warn('No data to export');
    return;
  }

  // Get headers from first row if not provided
  const columnHeaders = headers || Object.keys(data[0]);

  // Create CSV content
  let csvContent = '';

  // Add headers
  csvContent += columnHeaders.join(',') + '\n';

  // Add data rows
  data.forEach(row => {
    const values = columnHeaders.map(header => {
      const value = row[header];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Convert to string and escape quotes
      const stringValue = String(value);

      // If value contains comma, newline, or quote, wrap in quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });

    csvContent += values.join(',') + '\n';
  });

  // Create blob and download
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Export financial statement data
export const exportIncomeStatement = (data: {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: Array<{ name: string; amount: number }>;
  netIncome: number;
  period: { start: string; end: string };
}) => {
  const rows: ExcelRow[] = [
    { Category: 'Period', Description: 'Start Date', Amount: data.period.start },
    { Category: 'Period', Description: 'End Date', Amount: data.period.end },
    { Category: '', Description: '', Amount: '' },
    { Category: 'Revenue', Description: 'Total Revenue', Amount: data.revenue },
    { Category: 'COGS', Description: 'Cost of Goods Sold', Amount: data.cogs },
    { Category: 'Gross Profit', Description: 'Gross Profit', Amount: data.grossProfit },
    { Category: '', Description: '', Amount: '' },
    { Category: 'Operating Expenses', Description: '', Amount: '' },
    ...data.expenses.map(exp => ({
      Category: 'Expense',
      Description: exp.name,
      Amount: exp.amount
    })),
    { Category: '', Description: '', Amount: '' },
    { Category: 'Net Income', Description: 'Net Income', Amount: data.netIncome },
  ];

  exportToExcel(rows, 'Income_Statement', ['Category', 'Description', 'Amount']);
};

export const exportBalanceSheet = (data: {
  assets: Array<{ name: string; balance: number }>;
  liabilities: Array<{ name: string; balance: number }>;
  equity: Array<{ name: string; balance: number }>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  asOfDate: string;
}) => {
  const rows: ExcelRow[] = [
    { Category: 'As of Date', Account: data.asOfDate, Balance: '' },
    { Category: '', Account: '', Balance: '' },
    { Category: 'ASSETS', Account: '', Balance: '' },
    ...data.assets.map(asset => ({
      Category: 'Asset',
      Account: asset.name,
      Balance: asset.balance
    })),
    { Category: 'Total Assets', Account: '', Balance: data.totalAssets },
    { Category: '', Account: '', Balance: '' },
    { Category: 'LIABILITIES', Account: '', Balance: '' },
    ...data.liabilities.map(liab => ({
      Category: 'Liability',
      Account: liab.name,
      Balance: liab.balance
    })),
    { Category: 'Total Liabilities', Account: '', Balance: data.totalLiabilities },
    { Category: '', Account: '', Balance: '' },
    { Category: 'EQUITY', Account: '', Balance: '' },
    ...data.equity.map(eq => ({
      Category: 'Equity',
      Account: eq.name,
      Balance: eq.balance
    })),
    { Category: 'Total Equity', Account: '', Balance: data.totalEquity },
  ];

  exportToExcel(rows, 'Balance_Sheet', ['Category', 'Account', 'Balance']);
};

export const exportTaxReport = (data: {
  taxableRevenue: number;
  nonTaxableRevenue: number;
  totalRevenue: number;
  taxCollected: number;
  transactions: Array<{
    id: string;
    date: string;
    receiptNumber?: number;
    amount: number;
    taxAmount: number;
    taxRate: number;
  }>;
  period: { start: string; end: string };
}) => {
  const summaryRows: ExcelRow[] = [
    { Item: 'Period Start', Value: data.period.start },
    { Item: 'Period End', Value: data.period.end },
    { Item: '', Value: '' },
    { Item: 'Taxable Revenue', Value: data.taxableRevenue },
    { Item: 'Non-Taxable Revenue', Value: data.nonTaxableRevenue },
    { Item: 'Total Revenue', Value: data.totalRevenue },
    { Item: 'Tax Collected', Value: data.taxCollected },
    { Item: '', Value: '' },
    { Item: 'Transactions Detail', Value: '' },
  ];

  const transactionRows = data.transactions.map(trans => ({
    'Receipt Number': trans.receiptNumber || '-',
    Date: trans.date,
    Amount: trans.amount,
    'Tax Rate': `${(trans.taxRate * 100).toFixed(1)}%`,
    'Tax Amount': trans.taxAmount,
  }));

  const allRows = [
    ...summaryRows,
    ...transactionRows.map(tr => ({
      Item: tr['Receipt Number'],
      Value: `${tr.Date} | Amount: ${tr.Amount} | Tax: ${tr['Tax Amount']}`
    }))
  ];

  exportToExcel(allRows, 'Tax_Report', ['Item', 'Value']);
};

export const exportAgingReport = (data: {
  type: string;
  current: { amount: number; count: number };
  days31to60: { amount: number; count: number };
  days61to90: { amount: number; count: number };
  over90: { amount: number; count: number };
  total: number;
  details: Array<{
    name: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    daysOverdue: number;
  }>;
}) => {
  const rows: ExcelRow[] = [
    { Category: 'Report Type', Value: data.type === 'receivable' ? 'Accounts Receivable' : 'Accounts Payable' },
    { Category: '', Value: '' },
    { Category: 'Summary', Value: '' },
    { Category: 'Current (0-30 days)', Value: `${data.current.amount} (${data.current.count} invoices)` },
    { Category: '31-60 days', Value: `${data.days31to60.amount} (${data.days31to60.count} invoices)` },
    { Category: '61-90 days', Value: `${data.days61to90.amount} (${data.days61to90.count} invoices)` },
    { Category: 'Over 90 days', Value: `${data.over90.amount} (${data.over90.count} invoices)` },
    { Category: 'Total Outstanding', Value: data.total },
    { Category: '', Value: '' },
    { Category: 'Details', Value: '' },
    ...data.details.map(detail => ({
      Name: detail.name,
      'Invoice Number': detail.invoiceNumber,
      'Invoice Date': detail.invoiceDate,
      'Due Date': detail.dueDate,
      Amount: detail.amount,
      'Days Overdue': detail.daysOverdue,
    })),
  ];

  exportToExcel(rows, `Aging_Report_${data.type}`, ['Name', 'Invoice Number', 'Invoice Date', 'Due Date', 'Amount', 'Days Overdue']);
};
