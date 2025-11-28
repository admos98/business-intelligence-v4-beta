// src/store/useShoppingStore.ts

import { create } from 'zustand';
import { logger } from '../utils/logger';
import { ShoppingList, ShoppingItem, CafeCategory, Vendor, OcrResult, Unit, ItemStatus, PaymentStatus, PaymentMethod, PendingPaymentItem, SmartSuggestion, SummaryData, RecentPurchaseItem, MasterItem, User, AuthSlice, ShoppingState, InflationData, InflationDetail, InflationPoint, POSItem, SellTransaction, Recipe, StockEntry, SellSummaryData, FinancialOverviewData, AuditLogEntry, Shift, Account, AccountType, JournalEntry, GeneralLedgerEntry, TrialBalanceEntry, BalanceSheetData, IncomeStatementData, CashFlowStatementData, TaxSettings, TaxRate, TaxReportData, Customer, Invoice, InvoiceStatus, InvoiceType, Payment, AgingReportData, AgingBucket } from '../../shared/types';
import { t } from '../../shared/translations';
import { parseJalaliDate, toJalaliDateString, gregorianToJalali } from '../../shared/jalali';
import { fetchData, saveData } from '../lib/api';
import { defaultUsers } from '../config/auth';
import { findFuzzyMatches } from '../lib/fuzzyMatch';

type SummaryPeriod = '7d' | '30d' | 'mtd' | 'ytd' | 'all';

interface FullShoppingState extends AuthSlice, ShoppingState {
  lists: ShoppingList[];
  customCategories: string[];
  vendors: Vendor[];
  categoryVendorMap: Record<string, string>; // categoryName -> vendorId
  itemInfoMap: Record<string, { unit: Unit, category: string }>;

  // POS / SELL DATA
  posItems: POSItem[];
  posCategories: string[]; // Separate POS categories (not buy categories)
  sellTransactions: SellTransaction[];
  recipes: Recipe[];
  stockEntries: Record<string, StockEntry>; // itemName-unit key -> StockEntry
  auditLog: AuditLogEntry[]; // Audit trail for critical operations
  shifts: Shift[]; // Shift management

  // ACCOUNTING DATA (PHASE 1)
  accounts: Account[]; // Chart of Accounts
  journalEntries: JournalEntry[]; // All journal entries

  // TAX DATA (PHASE 3)
  taxSettings: TaxSettings; // Global tax configuration
  taxRates: TaxRate[]; // Available tax rates

  // CUSTOMER & INVOICE DATA (PHASE 4)
  customers: Customer[]; // Customer database
  invoices: Invoice[]; // All invoices (AR & AP)
  payments: Payment[]; // Payment records

  // Category actions
  addCategory: (name: string) => void;
  addPOSCategory: (name: string) => void; // Add POS-specific category

  hydrateFromCloud: () => Promise<void>;

  // User Management
  addUser: (user: Omit<User, 'id'>) => string;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;

  // List Actions
  createList: (date: Date) => string;
  updateList: (listId: string, updatedList: ShoppingList) => void;
  deleteList: (listId: string) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<ShoppingItem>) => void;
  addItemFromSuggestion: (suggestion: SmartSuggestion) => boolean;

  addCustomData: (item: ShoppingItem) => void;

  // OCR Action
  addOcrPurchase: (ocrResult: OcrResult, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, vendorName?: string) => string;

  // Vendor Actions
  addVendor: (vendorData: Omit<Vendor, 'id'>) => string;
  updateVendor: (vendorId: string, updates: Partial<Vendor>) => void;
  deleteVendor: (vendorId: string) => void;
  findOrCreateVendor: (vendorName?: string) => string | undefined;
  updateCategoryVendorMap: (category: string, vendorId: string) => void;

  // Item Actions
  updateMasterItem: (originalName: string, originalUnit: Unit, updates: { name: string; unit: Unit; category: string }) => void;

  // POS / SELL ACTIONS
  addPOSItem: (data: Omit<POSItem, 'id'>) => string;
  updatePOSItem: (posItemId: string, updates: Partial<POSItem>) => void;
  deletePOSItem: (posItemId: string) => void;
  reorderPOSItems: (itemIds: string[]) => void; // Reorder POS items by array of IDs
  getPOSItemsByCategory: (category: string) => POSItem[];
  getFrequentPOSItems: (limit: number) => POSItem[]; // Most sold items

  // RECIPE ACTIONS
  addRecipe: (recipe: Omit<Recipe, 'id' | 'createdAt'>) => string;
  updateRecipe: (recipeId: string, updates: Partial<Recipe>) => void;
  deleteRecipe: (recipeId: string) => void;
  calculateRecipeCost: (recipeId: string) => number; // Total ingredient cost

  // SELL TRANSACTION ACTIONS
  addSellTransaction: (transaction: Omit<SellTransaction, 'id' | 'date'>) => string;
  updateSellTransaction: (transactionId: string, updates: Partial<SellTransaction>) => void;
  getSellTransactions: (period: SummaryPeriod) => SellTransaction[];
  deleteSellTransaction: (transactionId: string) => void;

  // STOCK MANAGEMENT
  updateStock: (itemName: string, itemUnit: Unit, quantityChange: number) => void; // Positive or negative
  getStock: (itemName: string, itemUnit: Unit) => number; // Current quantity
  validateStockForRecipe: (recipeId: string) => boolean; // Check if enough inventory

  // Computed
  allCategories: () => string[];
  getKnownItemNames: () => string[];
  getAllKnownItems: () => MasterItem[];
  getItemInfo: (name: string) => { unit: Unit, category: string } | undefined;
  getLatestPricePerUnit: (name: string, unit: Unit) => number | undefined;
  getLatestPurchaseInfo: (name: string, unit: Unit) => { pricePerUnit?: number, vendorId?: string, lastAmount?: number };
  getLatestPurchaseInfoByVendor: (name: string, unit: Unit, vendorId: string) => { pricePerUnit?: number, lastAmount?: number };
  getSmartSuggestions: () => SmartSuggestion[];
  getSmartItemSuggestions: (query: string, limit?: number) => Array<{ name: string; unit: Unit; category: string; score: number; reason?: string }>;
  getPendingPayments: () => PendingPaymentItem[];
  getRecentPurchases: (count: number) => RecentPurchaseItem[];
  getExpenseForecast: () => { daily: number, monthly: number } | null;
  getSummaryData: (period: SummaryPeriod) => SummaryData | null;
  getInflationData: (periodInDays: number) => InflationData | null;
  getItemPriceHistory: (name: string, unit: Unit) => { date: string, pricePerUnit: number }[];
  getItemVendorPrices: (name: string, unit: Unit) => Array<{ vendorId: string; vendorName: string; pricePerUnit: number; purchaseCount: number }>;
  getAllPurchasesForItem: (name: string, unit: Unit) => Array<{ date: Date; vendorId?: string; vendorName?: string; pricePerUnit: number; amount: number; totalPrice: number }>;
  getAllPurchasesForVendor: (vendorId: string) => Array<{ date: Date; itemName: string; itemUnit: Unit; pricePerUnit: number; amount: number; totalPrice: number }>;
  isItemInTodaysPendingList: (name: string, unit: Unit) => boolean;

  // SELL ANALYTICS COMPUTED
  getSellSummaryData: (period: SummaryPeriod) => SellSummaryData | null;
  getFinancialOverview: (period: SummaryPeriod) => FinancialOverviewData | null;

  // Import/Export
  importData: (jsonData: string) => Promise<void>;
  exportData: () => string;

  // SHIFT MANAGEMENT
  startShift: (startingCash: number) => string;
  endShift: (endingCash: number, notes?: string) => void;
  getActiveShift: () => Shift | null;
  getShiftTransactions: (shiftId: string) => SellTransaction[];

  // ACCOUNTING ACTIONS (PHASE 1)
  addAccount: (account: Omit<Account, 'id' | 'createdAt'>) => string;
  updateAccount: (accountId: string, updates: Partial<Account>) => void;
  deleteAccount: (accountId: string) => void;
  getAccountById: (accountId: string) => Account | undefined;
  getAccountByCode: (code: string) => Account | undefined;
  getAccountsByType: (type: AccountType) => Account[];

  // TAX ACTIONS (PHASE 3)
  updateTaxSettings: (settings: Partial<TaxSettings>) => void;
  addTaxRate: (taxRate: Omit<TaxRate, 'id' | 'createdAt'>) => string;
  updateTaxRate: (taxRateId: string, updates: Partial<TaxRate>) => void;
  deleteTaxRate: (taxRateId: string) => void;
  getTaxRateById: (taxRateId: string) => TaxRate | undefined;
  getDefaultTaxRate: () => TaxRate | undefined;
  calculateTaxForAmount: (amount: number, taxRateId?: string) => { taxAmount: number; taxRate: number; total: number };

  // Journal Entry Actions
  createJournalEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => string;
  getJournalEntriesByReference: (reference: string) => JournalEntry[];
  reverseJournalEntry: (entryId: string, reason: string) => string;

  // Computed Accounting Functions
  getAccountBalance: (accountId: string, asOfDate?: Date) => number;
  getGeneralLedger: (accountId?: string, startDate?: Date, endDate?: Date) => GeneralLedgerEntry[];
  getTrialBalance: (asOfDate?: Date) => { entries: TrialBalanceEntry[], totalDebit: number, totalCredit: number, balanced: boolean };
  initializeDefaultAccounts: () => void;

  // Financial Statements (Phase 2)
  getBalanceSheet: (asOfDate?: Date) => BalanceSheetData;
  getIncomeStatement: (startDate?: Date, endDate?: Date) => IncomeStatementData;
  getCashFlowStatement: (startDate?: Date, endDate?: Date) => CashFlowStatementData;
  getTaxReport: (startDate?: Date, endDate?: Date) => TaxReportData;

  // CUSTOMER & INVOICE ACTIONS (PHASE 4)
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'balance'>) => string;
  updateCustomer: (customerId: string, updates: Partial<Customer>) => void;
  deleteCustomer: (customerId: string) => void;
  getCustomerById: (customerId: string) => Customer | undefined;
  getCustomerBalance: (customerId: string) => number;

  createInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'status'>) => string;
  updateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (invoiceId: string) => void;
  getInvoiceById: (invoiceId: string) => Invoice | undefined;
  getInvoicesByCustomer: (customerId: string) => Invoice[];
  getInvoicesByVendor: (vendorId: string) => Invoice[];
  getOverdueInvoices: (type: 'receivable' | 'payable') => Invoice[];

  recordPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => string;
  getPaymentsByInvoice: (invoiceId: string) => Payment[];

  getAgingReport: (type: 'receivable' | 'payable', asOfDate?: Date) => AgingReportData;

  // Internal helper functions
  _createInvoiceJournalEntry: (invoice: Invoice) => void;
  _createPaymentJournalEntry: (payment: Payment, invoice: Invoice) => void;
}

const DEFAULT_CATEGORIES: string[] = Object.values(CafeCategory);

const hashPassword = async (password: string, salt: string): Promise<string> => {
    if (!(globalThis.crypto && typeof globalThis.crypto.subtle !== 'undefined')) {
        throw new Error("Secure login is unavailable in this environment.");
    }
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const emptyState = {
  lists: [],
  customCategories: [],
  vendors: [],
  categoryVendorMap: {},
  itemInfoMap: {},
  posItems: [],
  posCategories: [], // Separate POS categories
  sellTransactions: [],
  recipes: [],
  stockEntries: {},
  auditLog: [],
  shifts: [],
  accounts: [], // Chart of Accounts
  journalEntries: [], // Journal Entries
  taxSettings: { // Tax Settings (Phase 3)
    enabled: false,
    includeTaxInPrice: false,
    showTaxOnReceipts: true,
  },
  taxRates: [], // Tax Rates (Phase 3)
  customers: [], // Customers (Phase 4)
  invoices: [], // Invoices (Phase 4)
  payments: [], // Payments (Phase 4)
};

// --- Helper function to safely calculate price per unit ---
const calculatePricePerUnit = (totalPrice: number | null | undefined, quantity: number | null | undefined): number | undefined => {
  if (!totalPrice || !quantity || quantity <= 0 || !Number.isFinite(totalPrice) || !Number.isFinite(quantity)) {
    return undefined;
  }
  // Round to 2 decimal places for currency precision
  return Math.round((totalPrice / quantity) * 100) / 100;
};

// Note: Currency rounding helper removed - using calculatePricePerUnit for consistency

// --- Helper function to add audit log entry ---
const addAuditLogEntry = (
  state: FullShoppingState,
  action: AuditLogEntry['action'],
  details: AuditLogEntry['details']
) => {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    userId: state.currentUser?.username,
    details,
  };

  // Keep only last 1000 entries to prevent unbounded growth
  const newLog = [...(state.auditLog || []), entry].slice(-1000);
  return { auditLog: newLog };
};

// --- Helper function to create default Chart of Accounts ---
const createDefaultChartOfAccounts = (): Account[] => {
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

// --- Debounced save function ---
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledUserId: string | null = null; // Track user ID when save is scheduled

const clearDebounceTimer = () => {
    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    scheduledUserId = null;
};

const debouncedSaveData = (getState: () => FullShoppingState) => {
    if (typeof window === 'undefined') {
        return;
    }

    // Capture current user ID at the time save is scheduled
    const currentState = getState();
    const userIdAtSchedule = currentState.currentUser?.username || null;
    scheduledUserId = userIdAtSchedule;

    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        // Get fresh state at execution time
        const freshState = getState();
        const { currentUser, isHydrating } = freshState;

        // Do not save if no user, during hydration, or if user changed (logged out)
        if (!currentUser || isHydrating || currentUser.username !== userIdAtSchedule || scheduledUserId !== userIdAtSchedule) {
            if (currentUser?.username !== userIdAtSchedule || scheduledUserId !== userIdAtSchedule) {
                logger.warn('Save cancelled: User changed during debounce period');
            }
            scheduledUserId = null;
            return;
        }

        const dataToSave = {
            lists: freshState.lists,
            customCategories: freshState.customCategories,
            vendors: freshState.vendors,
            categoryVendorMap: freshState.categoryVendorMap,
            itemInfoMap: freshState.itemInfoMap,
            posItems: freshState.posItems,
            posCategories: freshState.posCategories,
            sellTransactions: freshState.sellTransactions,
            recipes: freshState.recipes,
            stockEntries: freshState.stockEntries,
            accounts: freshState.accounts,
            journalEntries: freshState.journalEntries,
            taxSettings: freshState.taxSettings,
            taxRates: freshState.taxRates,
            customers: freshState.customers,
            invoices: freshState.invoices,
            payments: freshState.payments,
        };
        saveData(dataToSave).catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : "Auto-save failed";
            const errorDetails = err instanceof Error ? {
                message: errorMessage,
                name: err.name,
                stack: err.stack
            } : { message: errorMessage };

            logger.error("Auto-save failed:", errorDetails);

            // Retry logic for transient network errors
            const isNetworkError = errorMessage.includes('Failed to fetch') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('NetworkError');

            if (isNetworkError) {
                // Retry once after 3 seconds for network errors
                setTimeout(() => {
                    logger.info("Retrying auto-save after network error...");
                    saveData(dataToSave).catch((retryErr: unknown) => {
                        const retryMessage = retryErr instanceof Error ? retryErr.message : "Retry failed";
                        logger.error("Auto-save retry also failed:", retryMessage);
                        // Note: Toast notifications should be handled at the component level
                        // Components using the store can listen to state changes and show toasts accordingly
                    });
                }, 3000);
            } else {
                // For non-network errors (validation, auth, etc.), log but don't retry
                logger.error("Auto-save failed with non-retryable error:", errorMessage);
                // Note: Critical error notifications should be handled at the component level
                // Components can listen to store state changes or use error boundaries
            }
        });
    }, 1500); // Debounce for 1.5 seconds
};


export const useShoppingStore = create<FullShoppingState>((set, get) => ({
      isHydrating: false,
      ...emptyState,

      // Auth Slice
      users: defaultUsers,
      currentUser: null,
      login: async (username, password) => {
        const user = get().users.find((u: User) => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return false;
        }

        try {
            if (!user.salt || !user.passwordHash) {
                return false;
            }
            const hashedInput = await hashPassword(password, user.salt);
            if (hashedInput === user.passwordHash) {
                set({ currentUser: user, isHydrating: true });
                return true;
            }
        } catch (error) {
            logger.error("Login failed due to hashing error:", error);
        }

        return false;
      },
      logout: () => {
        // Clear any pending saves before logging out
        clearDebounceTimer();
        set({ currentUser: null, ...emptyState, isHydrating: false });
      },

      hydrateFromCloud: async () => {
          set({ isHydrating: true });
          try {
              const data = await fetchData();
              if (data && data.lists) {
                  // Validate itemInfoMap structure
                  let validatedItemInfoMap: Record<string, { unit: Unit; category: string }> = {};
                  if (data.itemInfoMap && typeof data.itemInfoMap === 'object') {
                      for (const [key, value] of Object.entries(data.itemInfoMap)) {
                          if (value && typeof value === 'object' && 'unit' in value && 'category' in value) {
                              const unit = value.unit as string;
                              const category = value.category as string;
                              // Validate unit is a valid Unit enum value
                              if (Object.values(Unit).includes(unit as Unit)) {
                                  validatedItemInfoMap[key] = { unit: unit as Unit, category };
                              }
                          }
                      }
                  }

                  // Initialize default accounts if none exist
                  const accounts = Array.isArray(data.accounts) && data.accounts.length > 0
                    ? data.accounts as Account[]
                    : createDefaultChartOfAccounts();

                  const hydratedState: Partial<FullShoppingState> = {
                      lists: data.lists,
                      customCategories: data.customCategories,
                      vendors: data.vendors,
                      categoryVendorMap: data.categoryVendorMap,
                      itemInfoMap: validatedItemInfoMap,
                      posItems: data.posItems || [],
                      posCategories: data.posCategories || [],
                      sellTransactions: data.sellTransactions || [],
                      recipes: data.recipes || [],
                      stockEntries: data.stockEntries || {},
                      accounts: accounts,
                      journalEntries: (data.journalEntries as JournalEntry[]) || [],
                      taxSettings: data.taxSettings || emptyState.taxSettings,
                      taxRates: (data.taxRates as TaxRate[]) || [],
                      customers: (data.customers as Customer[]) || [],
                      invoices: (data.invoices as Invoice[]) || [],
                      payments: (data.payments as Payment[]) || [],
                      isHydrating: false,
                  };
                  set(hydratedState);
              } else {
                  set({ ...emptyState, isHydrating: false });
              }
          } catch (error) {
              logger.error("Failed to hydrate from cloud:", error);
              set({ ...emptyState, isHydrating: false }); // Fallback to empty state on error
          }
      },

      createList: (date) => {
        const listId = toJalaliDateString(date.toISOString());

        const existingList = get().lists.find(l => l.id === listId);
        if (existingList) {
          return existingList.id;
        }

        const name = t.todaysShoppingList(toJalaliDateString(date.toISOString(), { format: 'long' }));
        const newList: ShoppingList = {
          id: listId,
          name,
          createdAt: date.toISOString(),
          items: [],
        };
        set((state) => ({ lists: [...state.lists, newList] }));
        debouncedSaveData(get);
        return newList.id;
      },

      updateList: (listId, updatedList) => {
        set((state) => ({
          lists: state.lists.map((list) => (list.id === listId ? updatedList : list)),
        }));
        debouncedSaveData(get);
      },

      deleteList: (listId) => {
        set((state) => ({ lists: state.lists.filter((list) => list.id !== listId) }));
        debouncedSaveData(get);
      },

      updateItem: (listId, itemId, updates) => {
        // Find the item before updating to check if status changed to Bought
        const list = get().lists.find(l => l.id === listId);
        const oldItem = list?.items.find(i => i.id === itemId);
        const wasPending = oldItem?.status === ItemStatus.Pending;
        const nowBought = updates.status === ItemStatus.Bought;

        set(state => ({
            lists: state.lists.map(list => {
                if (list.id === listId) {
                    return {
                        ...list,
                        items: list.items.map(item => item.id === itemId ? { ...item, ...updates } : item)
                    };
                }
                return list;
            })
        }));

        // Update stock if item just became bought with purchased amount
        if (wasPending && nowBought && oldItem && updates.purchasedAmount !== undefined && updates.purchasedAmount > 0) {
          get().updateStock(oldItem.name, oldItem.unit, updates.purchasedAmount);
        }

        // Create journal entry if item just became bought
        if (wasPending && nowBought && oldItem && updates.paidPrice) {
          try {
            const cashAccount = get().getAccountByCode('1-101');
            const bankAccount = get().getAccountByCode('1-102');
            const inventoryAccount = get().getAccountByCode('1-201');
            const apAccount = get().getAccountByCode('2-101');

            if (inventoryAccount) {
              const journalEntries: Array<{accountId: string, debit: number, credit: number, description?: string}> = [];

              // Debit Inventory
              journalEntries.push({
                accountId: inventoryAccount.id,
                debit: updates.paidPrice,
                credit: 0,
                description: `خرید ${oldItem.name}`
              });

              // Credit Cash/Bank or AP depending on payment status
              if (updates.paymentStatus === PaymentStatus.Paid) {
                const paymentAccount = updates.paymentMethod === PaymentMethod.Cash ? cashAccount : bankAccount;
                if (paymentAccount) {
                  journalEntries.push({
                    accountId: paymentAccount.id,
                    debit: 0,
                    credit: updates.paidPrice,
                    description: updates.paymentMethod === PaymentMethod.Cash ? 'پرداخت نقدی' : 'پرداخت بانکی'
                  });
                }
              } else if (apAccount) {
                // Payment due - credit Accounts Payable
                journalEntries.push({
                  accountId: apAccount.id,
                  debit: 0,
                  credit: updates.paidPrice,
                  description: 'بدهی به تامین‌کننده'
                });
              }

              if (journalEntries.length === 2) {
                get().createJournalEntry({
                  date: list?.createdAt || new Date().toISOString(),
                  description: `خرید: ${oldItem.name}`,
                  reference: itemId,
                  referenceType: 'purchase',
                  entries: journalEntries,
                  isAutomatic: true,
                  createdBy: get().currentUser?.username,
                });
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to create journal entry for purchase:', error);

            // Log failure to audit trail for manual reconciliation
            const auditEntry = addAuditLogEntry(get(), 'transaction_updated', {
              entityId: itemId,
              entityName: oldItem.name,
              metadata: {
                action: 'journal_entry_failed',
                reason: errorMessage,
                purchaseAmount: updates.paidPrice,
                listId: listId,
                requiresManualReconciliation: true
              }
            });
            set(auditEntry);

            // Still save the purchase to prevent data loss, but flag for review
            debouncedSaveData(get);
          }
        }

        debouncedSaveData(get);
      },

      addItemFromSuggestion: ({ name, unit, category }) => {
        const today = new Date();
        const listId = get().createList(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));

        const list = get().lists.find(l => l.id === listId)!;

        const alreadyExists = list.items.some(item => item.name === name && item.unit === unit && item.status === ItemStatus.Pending);
        if (alreadyExists) {
            return false;
        }

        const latestInfo = get().getLatestPurchaseInfo(name, unit);

        const newItem: ShoppingItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name,
            amount: latestInfo.lastAmount || 1,
            quantity: latestInfo.lastAmount || 1,
            unit,
            category,
            status: ItemStatus.Pending,
            paymentStatus: PaymentStatus.Due,
            estimatedPrice: latestInfo.pricePerUnit ? latestInfo.pricePerUnit * (latestInfo.lastAmount || 1) : undefined
        };

        get().updateList(listId, { ...list, items: [...list.items, newItem] });
        return true;
      },

      addOcrPurchase: (ocrResult, paymentMethod, paymentStatus, vendorName) => {
        const { date, items: ocrItems } = ocrResult;
        const vendorId = get().findOrCreateVendor(vendorName);

        if (!date) {
            logger.error("OCR date is missing");
            return 'Invalid Date';
        }

        const parsedDate = parseJalaliDate(date);
        if (!parsedDate) {
            logger.error("Invalid OCR date, cannot create list:", date);
            return 'Invalid Date';
        }

        const targetListId = get().createList(parsedDate);
        const targetList = get().lists.find(l => l.id === targetListId)!;

        const baseTimestamp = Date.now();
        const newShoppingItems: ShoppingItem[] = ocrItems.map((item, index) => ({
            id: `item-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            name: item.name,
            amount: item.quantity,
            quantity: item.quantity,
            unit: item.unit || Unit.Piece,
            status: ItemStatus.Bought,
            category: item.suggestedCategory || t.other,
            paidPrice: item.price,
            purchasedAmount: item.quantity,
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod,
            vendorId: vendorId,
        }));

        newShoppingItems.forEach(item => {
            get().addCustomData(item);
            if(item.category && vendorId) {
                get().updateCategoryVendorMap(item.category, vendorId);
            }
            // Update stock when items are purchased via OCR
            if (item.purchasedAmount !== undefined && item.purchasedAmount > 0) {
              get().updateStock(item.name, item.unit, item.purchasedAmount);
            }
        });

        const updatedList = { ...targetList, items: [...targetList.items, ...newShoppingItems] };
        get().updateList(targetListId, updatedList);

        // Create journal entry for the batch purchase
        try {
          const totalPurchase = newShoppingItems.reduce((sum, item) => sum + (item.paidPrice || 0), 0);
          if (totalPurchase > 0) {
            const cashAccount = get().getAccountByCode('1-101');
            const bankAccount = get().getAccountByCode('1-102');
            const inventoryAccount = get().getAccountByCode('1-201');
            const apAccount = get().getAccountByCode('2-101');

            if (inventoryAccount) {
              const journalEntries: Array<{accountId: string, debit: number, credit: number, description?: string}> = [];

              // Debit Inventory
              journalEntries.push({
                accountId: inventoryAccount.id,
                debit: totalPurchase,
                credit: 0,
                description: `خرید ${newShoppingItems.length} قلم`
              });

              // Credit Cash/Bank or AP
              if (paymentStatus === PaymentStatus.Paid) {
                const paymentAccount = paymentMethod === PaymentMethod.Cash ? cashAccount : bankAccount;
                if (paymentAccount) {
                  journalEntries.push({
                    accountId: paymentAccount.id,
                    debit: 0,
                    credit: totalPurchase,
                    description: paymentMethod === PaymentMethod.Cash ? 'پرداخت نقدی' : 'پرداخت بانکی'
                  });
                }
              } else if (apAccount) {
                journalEntries.push({
                  accountId: apAccount.id,
                  debit: 0,
                  credit: totalPurchase,
                  description: `بدهی به ${vendorName || 'تامین‌کننده'}`
                });
              }

              if (journalEntries.length === 2) {
                get().createJournalEntry({
                  date: targetList.createdAt,
                  description: `خرید از ${vendorName || 'تامین‌کننده'} - ${newShoppingItems.length} قلم`,
                  reference: targetListId,
                  referenceType: 'purchase',
                  entries: journalEntries,
                  isAutomatic: true,
                  createdBy: get().currentUser?.username,
                });
              }
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to create journal entry for OCR purchase:', error);

          // Log failure to audit trail for manual reconciliation
          const totalPurchase = newShoppingItems.reduce((sum, item) => sum + (item.paidPrice || 0), 0);
          const auditEntry = addAuditLogEntry(get(), 'transaction_created', {
            entityId: targetListId,
            entityName: `OCR Purchase - ${vendorName || 'Unknown Vendor'}`,
            metadata: {
              action: 'journal_entry_failed',
              reason: errorMessage,
              purchaseAmount: totalPurchase,
              itemCount: newShoppingItems.length,
              requiresManualReconciliation: true
            }
          });
          set(auditEntry);

          // Still save the purchase to prevent data loss, but flag for review
          debouncedSaveData(get);
        }

        return targetList.name;
      },

      addVendor: (vendorData) => {
        const newVendor: Vendor = {
            id: `vendor-${Date.now()}`,
            ...vendorData
        };
        set(state => ({ vendors: [...state.vendors, newVendor] }));
        debouncedSaveData(get);
        return newVendor.id;
      },

      updateVendor: (vendorId, updates) => {
        set(state => ({
            vendors: state.vendors.map(v => v.id === vendorId ? { ...v, ...updates } : v)
        }));
        debouncedSaveData(get);
      },

      deleteVendor: (vendorId) => {
        set(state => {
            const updatedCategoryVendorMap = Object.fromEntries(
                Object.entries(state.categoryVendorMap).filter(([, id]) => id !== vendorId)
            );

            return {
                vendors: state.vendors.filter(v => v.id !== vendorId),
                lists: state.lists.map(list => ({
                    ...list,
                    items: list.items.map(item => item.vendorId === vendorId ? { ...item, vendorId: undefined } : item)
                })),
                categoryVendorMap: updatedCategoryVendorMap,
            };
        });
        debouncedSaveData(get);
      },

      findOrCreateVendor: (vendorName) => {
        if (!vendorName || !vendorName.trim()) return undefined;
        const trimmedName = vendorName.trim();
        const existingVendor = get().vendors.find(v => v.name.toLowerCase() === trimmedName.toLowerCase());
        if (existingVendor) {
            return existingVendor.id;
        }
        return get().addVendor({ name: trimmedName });
      },

      updateCategoryVendorMap: (category, vendorId) => {
        set(state => ({
            categoryVendorMap: {
                ...state.categoryVendorMap,
                [category]: vendorId
            }
        }));
        debouncedSaveData(get);
      },

      addCategory: (name: string) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        set(state => {
          if (state.customCategories.includes(trimmed)) return {} as Partial<FullShoppingState>;
          return { customCategories: [...state.customCategories, trimmed] } as Partial<FullShoppingState>;
        });
        debouncedSaveData(get);
      },

      addPOSCategory: (name: string) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        set(state => {
          if (state.posCategories.includes(trimmed)) return {} as Partial<FullShoppingState>;
          return { posCategories: [...state.posCategories, trimmed] } as Partial<FullShoppingState>;
        });
        debouncedSaveData(get);
      },

      updateMasterItem: (originalName, originalUnit, updates) => {
          set(state => {
              const newLists = state.lists.map(list => ({
                  ...list,
                  items: list.items.map(item => {
                      if (item.name === originalName && item.unit === originalUnit) {
                          return { ...item, ...updates };
                      }
                      return item;
                  })
              }));

              const newItemInfoMap = { ...state.itemInfoMap };
              // Use composite key (name-unit) to avoid collisions
              const originalKey = `${originalName}-${originalUnit}`;
              const newKey = `${updates.name}-${updates.unit}`;

              // Only delete if the key exists and we're changing the name or unit
              if ((originalName !== updates.name || originalUnit !== updates.unit) && newItemInfoMap[originalKey]) {
                  delete newItemInfoMap[originalKey];
              }
              newItemInfoMap[newKey] = { unit: updates.unit, category: updates.category };

              return { lists: newLists, itemInfoMap: newItemInfoMap };
          });
          debouncedSaveData(get);
      },

      addCustomData: (item) => {
        const { category, name, unit } = item;
        const allCats = get().allCategories();

        let stateChanged = false;
        const stateUpdates: Partial<FullShoppingState> = {};

        if (category && !allCats.includes(category)) {
          stateUpdates.customCategories = [...get().customCategories, category];
          stateChanged = true;
        }

        if (name && unit && category) {
            // Use composite key to avoid collisions between items with same name but different units
            const key = `${name.trim()}-${unit}`;
            stateUpdates.itemInfoMap = { ...get().itemInfoMap, [key]: { unit, category } };
            stateChanged = true;
        }

        if(stateChanged) {
            set(stateUpdates);
            debouncedSaveData(get);
        }
      },

      allCategories: () => {
         const { customCategories } = get();
         const combined = [...DEFAULT_CATEGORIES, ...customCategories];
         return [...new Set(combined)];
      },

      getKnownItemNames: () => {
        const itemNames = new Set<string>();
        get().lists.forEach(list => {
            list.items.forEach(item => itemNames.add(item.name));
        });
        Object.keys(get().itemInfoMap).forEach(name => itemNames.add(name));
        return Array.from(itemNames).sort((a,b) => a.localeCompare(b, 'fa'));
      },

      getAllKnownItems: () => {
        const allPurchasedItems = get().lists
            .flatMap(list => list.items.map(item => ({ ...item, purchaseDate: new Date(list.createdAt) })))
            .filter(item => item.status === ItemStatus.Bought && item.purchasedAmount != null && item.paidPrice != null);

        const itemStats = new Map<string, MasterItem & { latestPurchaseDate: Date }>();

        allPurchasedItems.forEach(item => {
            const key = `${item.name}-${item.unit}`;
            let currentStats = itemStats.get(key);

            if (!currentStats) {
                currentStats = {
                    name: item.name,
                    unit: item.unit,
                    category: item.category,
                    lastPricePerUnit: 0,
                    totalQuantity: 0,
                    totalSpend: 0,
                    purchaseCount: 0,
                    latestPurchaseDate: new Date(0)
                };
            }

            currentStats.totalQuantity = (currentStats.totalQuantity || 0) + (item.purchasedAmount || 0);
            currentStats.totalSpend = (currentStats.totalSpend || 0) + (item.paidPrice || 0);
            currentStats.purchaseCount++;

            if (item.purchaseDate >= currentStats.latestPurchaseDate) {
                currentStats.latestPurchaseDate = item.purchaseDate;
                const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                currentStats.lastPricePerUnit = pricePerUnit || 0;
                currentStats.category = item.category;
            }

            itemStats.set(key, currentStats);
        });

        const result: MasterItem[] = [];
        // FIX: Removed unused 'key' parameter.
        itemStats.forEach((value) => {
            const { latestPurchaseDate, ...masterItem } = value;
            result.push(masterItem);
        });

        return result.sort((a,b) => a.name.localeCompare(b.name, 'fa'));
      },
      getItemInfo: (name: string) => {
        // Always use composite keys (name-unit) for consistency
        // Try all possible units to find a match
        const allUnits = Object.values(Unit);
        for (const unit of allUnits) {
          const compositeKey = `${name}-${unit}`;
          const value = get().itemInfoMap[compositeKey];
          if (value) {
            return value;
          }
        }

        // Fallback: Try direct lookup for backward compatibility with old data
        const direct = get().itemInfoMap[name];
        if (direct) return direct;

        // Try any key that starts with the name (legacy support)
        for (const [key, value] of Object.entries(get().itemInfoMap)) {
          if (key.startsWith(`${name}-`)) {
            return value;
          }
        }
        return undefined;
      },
      getLatestPricePerUnit: (name, unit) => {
        return get().getLatestPurchaseInfo(name, unit).pricePerUnit;
      },
      getLatestPurchaseInfo: (name, unit) => {
          const allPurchasesOfItem = get().lists
              .flatMap(list => list.items
                  .filter(item => item.name === name && item.unit === unit && item.status === ItemStatus.Bought && item.paidPrice && item.purchasedAmount && item.purchasedAmount > 0)
                  .map(item => ({ ...item, purchaseDate: new Date(list.createdAt) }))
              )
              .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());

          if (allPurchasesOfItem.length > 0) {
              const latest = allPurchasesOfItem[0];
              if (latest.paidPrice && latest.purchasedAmount && latest.purchasedAmount > 0) {
                  const pricePerUnit = calculatePricePerUnit(latest.paidPrice, latest.purchasedAmount);
                  if (pricePerUnit !== undefined) {
                    return {
                        pricePerUnit,
                        vendorId: latest.vendorId,
                        lastAmount: latest.purchasedAmount
                    };
                  }
              }
          }
          return {};
      },
      getLatestPurchaseInfoByVendor: (name, unit, vendorId) => {
          const allPurchasesOfItem = get().lists
              .flatMap(list => list.items
                  .filter(item => item.name === name && item.unit === unit && item.status === ItemStatus.Bought && item.vendorId === vendorId && item.paidPrice && item.purchasedAmount && item.purchasedAmount > 0)
                  .map(item => ({ ...item, purchaseDate: new Date(list.createdAt) }))
              )
              .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());

          if (allPurchasesOfItem.length > 0) {
              const latest = allPurchasesOfItem[0];
              if (latest.paidPrice && latest.purchasedAmount && latest.purchasedAmount > 0) {
                  const pricePerUnit = calculatePricePerUnit(latest.paidPrice, latest.purchasedAmount);
                  if (pricePerUnit !== undefined) {
                    return {
                        pricePerUnit,
                        lastAmount: latest.purchasedAmount
                    };
                  }
              }
          }
          return {};
      },
      getItemPriceHistory: (name, unit) => {
          const history: { date: string, pricePerUnit: number }[] = [];
          get().lists.forEach(list => {
              list.items.forEach(item => {
                  if (
                      item.name === name &&
                      item.unit === unit &&
                      item.status === ItemStatus.Bought &&
                      item.paidPrice != null &&
                      item.purchasedAmount != null &&
                      item.purchasedAmount > 0
                  ) {
                      const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                      if (pricePerUnit !== undefined) {
                        history.push({
                            date: list.createdAt,
                            pricePerUnit,
                        });
                      }
                  }
              });
          });
          // Sort by date ascending
          return history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      },
      getItemVendorPrices: (name, unit) => {
          const vendorPrices = new Map<string, { pricePerUnit: number; purchaseCount: number }>();
          const vendors = get().vendors;

          get().lists.forEach(list => {
              list.items.forEach(item => {
                  if (
                      item.name === name &&
                      item.unit === unit &&
                      item.status === ItemStatus.Bought &&
                      item.vendorId &&
                      item.paidPrice != null &&
                      item.purchasedAmount != null &&
                      item.purchasedAmount > 0
                  ) {
                      const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                      if (pricePerUnit !== undefined) {
                        const existing = vendorPrices.get(item.vendorId);
                        if (existing) {
                            // Average price weighted by purchase count
                            const totalCount = existing.purchaseCount + 1;
                            const avgPrice = ((existing.pricePerUnit * existing.purchaseCount) + pricePerUnit) / totalCount;
                            vendorPrices.set(item.vendorId, {
                                pricePerUnit: avgPrice,
                                purchaseCount: totalCount
                            });
                        } else {
                            vendorPrices.set(item.vendorId, {
                                pricePerUnit,
                                purchaseCount: 1
                            });
                        }
                      }
                  }
              });
          });

          return Array.from(vendorPrices.entries())
              .map(([vendorId, data]) => {
                  const vendor = vendors.find(v => v.id === vendorId);
                  return {
                      vendorId,
                      vendorName: vendor?.name || 'نامشخص',
                      pricePerUnit: data.pricePerUnit,
                      purchaseCount: data.purchaseCount
                  };
              })
              .sort((a, b) => a.pricePerUnit - b.pricePerUnit); // Sort by price ascending
      },
      getAllPurchasesForItem: (name, unit) => {
          const purchases: Array<{ date: Date; vendorId?: string; vendorName?: string; pricePerUnit: number; amount: number; totalPrice: number }> = [];
          const vendors = get().vendors;

          get().lists.forEach(list => {
              const listDate = new Date(list.createdAt);
              list.items.forEach(item => {
                  if (
                      item.name === name &&
                      item.unit === unit &&
                      item.status === ItemStatus.Bought &&
                      item.paidPrice != null &&
                      item.purchasedAmount != null &&
                      item.purchasedAmount > 0
                  ) {
                      const vendor = item.vendorId ? vendors.find(v => v.id === item.vendorId) : undefined;
                      const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                      if (pricePerUnit !== undefined) {
                        purchases.push({
                            date: listDate,
                            vendorId: item.vendorId,
                            vendorName: vendor?.name,
                            pricePerUnit,
                            amount: item.purchasedAmount,
                            totalPrice: item.paidPrice
                        });
                      }
                  }
              });
          });

          return purchases.sort((a, b) => b.date.getTime() - a.date.getTime()); // Most recent first
      },
      getAllPurchasesForVendor: (vendorId) => {
          const purchases: Array<{ date: Date; itemName: string; itemUnit: Unit; pricePerUnit: number; amount: number; totalPrice: number }> = [];

          get().lists.forEach(list => {
              const listDate = new Date(list.createdAt);
              list.items.forEach(item => {
                  if (
                      item.vendorId === vendorId &&
                      item.status === ItemStatus.Bought &&
                      item.paidPrice != null &&
                      item.purchasedAmount != null &&
                      item.purchasedAmount > 0
                  ) {
                      const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                      if (pricePerUnit !== undefined) {
                        purchases.push({
                            date: listDate,
                            itemName: item.name,
                            itemUnit: item.unit,
                            pricePerUnit,
                            amount: item.purchasedAmount,
                            totalPrice: item.paidPrice
                        });
                      }
                  }
              });
          });

          return purchases.sort((a, b) => b.date.getTime() - a.date.getTime()); // Most recent first
      },
      isItemInTodaysPendingList: (name, unit) => {
        const today = new Date();
        const listId = toJalaliDateString(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString());

        const list = get().lists.find(l => l.id === listId);

        if (!list) {
            return false;
        }

        return list.items.some(item =>
            item.name === name &&
            item.unit === unit &&
            item.status === ItemStatus.Pending
        );
      },
      getInflationData: (periodInDays: number): InflationData | null => {
        const now = new Date();
        const startDate = new Date();
        startDate.setDate(now.getDate() - periodInDays);
        startDate.setHours(0, 0, 0, 0);

        const allPurchases = get().lists
            .flatMap(list => {
                const listDate = new Date(list.createdAt);
                return listDate >= startDate && listDate <= now
                    ? list.items.map(item => ({ ...item, purchaseDate: listDate }))
                    : [];
            })
            .filter(item =>
                item.status === ItemStatus.Bought &&
                item.paidPrice != null &&
                item.purchasedAmount != null &&
                item.purchasedAmount > 0
            )
            .sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());

        if (allPurchases.length < 2) return null;

        // --- Item Inflation ---
        const itemPrices = new Map<string, { prices: { date: Date, price: number }[], category: string }>();
        allPurchases.forEach(item => {
            if (!item.paidPrice || !item.purchasedAmount || item.purchasedAmount <= 0) {
                return;
            }
            const key = `${item.name}-${item.unit}`;
            const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
            if (pricePerUnit === undefined) return;
            if (!itemPrices.has(key)) {
                itemPrices.set(key, { prices: [], category: item.category });
            }
            itemPrices.get(key)!.prices.push({ date: item.purchaseDate, price: pricePerUnit });
        });

        const itemInflation: InflationDetail[] = [];
        itemPrices.forEach((data, nameAndUnit) => {
            if (data.prices.length >= 2) {
                // Use last purchase as baseline, compare to previous purchases
                const lastPrice = data.prices[data.prices.length - 1].price;
                const previousPrice = data.prices[data.prices.length - 2].price;
                if (previousPrice > 0) {
                    const parts = nameAndUnit.split('-');
                    itemInflation.push({
                        itemName: parts[0],
                        name: parts[0],
                        unit: parts[1] as Unit,
                        oldPrice: previousPrice,
                        newPrice: lastPrice,
                        startPrice: previousPrice,
                        endPrice: lastPrice,
                        percentageChange: ((lastPrice - previousPrice) / previousPrice) * 100,
                        changePercentage: ((lastPrice - previousPrice) / previousPrice) * 100,
                        daysBetween: 0,
                    });
                }
            }
        });

        // --- Category Inflation (Corrected Logic) ---
        const categoryItemPrices = new Map<string, Map<string, { prices: { date: Date, price: number }[], totalSpend: number }>>();

        allPurchases.forEach(item => {
            if (!item.paidPrice || !item.purchasedAmount || item.purchasedAmount <= 0) {
                return;
            }
            const category = item.category;
            const itemKey = `${item.name}-${item.unit}`;
            const pricePerUnit = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
            if (pricePerUnit === undefined) return;

            if (!categoryItemPrices.has(category)) {
                categoryItemPrices.set(category, new Map());
            }
            const itemMap = categoryItemPrices.get(category)!;

            if (!itemMap.has(itemKey)) {
                itemMap.set(itemKey, { prices: [], totalSpend: 0 });
            }
            const itemData = itemMap.get(itemKey)!;
            itemData.prices.push({ date: item.purchaseDate, price: pricePerUnit });
            itemData.totalSpend += item.paidPrice!;
        });

        const categoryInflation: InflationDetail[] = [];
        categoryItemPrices.forEach((itemMap, categoryName) => {
            let totalSpendInCategory = 0;
            let weightedInflationSum = 0;

            // To calculate a representative start/end price for the category display
            let weightedStartPriceSum = 0;
            let weightedEndPriceSum = 0;

            itemMap.forEach(itemData => {
                // prices are already sorted by date from the initial `allPurchases` sort.
                if (itemData.prices.length >= 2) {
                    // Use last purchase as baseline
                    const lastPrice = itemData.prices[itemData.prices.length - 1].price;
                    const previousPrice = itemData.prices[itemData.prices.length - 2].price;
                    const itemSpend = itemData.totalSpend;

                    if (previousPrice > 0) {
                        const itemInflationPercentage = ((lastPrice - previousPrice) / previousPrice);

                        weightedInflationSum += itemInflationPercentage * itemSpend;
                        totalSpendInCategory += itemSpend;

                        weightedStartPriceSum += previousPrice * itemSpend;
                        weightedEndPriceSum += lastPrice * itemSpend;
                    }
                }
            });

            if (totalSpendInCategory > 0) {
                const overallCategoryInflation = (weightedInflationSum / totalSpendInCategory) * 100;
                const avgStartPrice = weightedStartPriceSum / totalSpendInCategory;
                const avgEndPrice = weightedEndPriceSum / totalSpendInCategory;

                categoryInflation.push({
                    itemName: categoryName,
                    name: categoryName,
                    unit: Unit.Kg, // Default unit for categories
                    oldPrice: avgStartPrice,
                    newPrice: avgEndPrice,
                    startPrice: avgStartPrice,
                    endPrice: avgEndPrice,
                    percentageChange: overallCategoryInflation,
                    changePercentage: overallCategoryInflation,
                    daysBetween: 0,
                });
            }
        });

        // --- Price Index History (monthly) ---
        const priceIndexHistory: InflationPoint[] = [];
        const monthlySpending = new Map<string, { totalSpend: number, weightedPriceSum: number }>();
        const baseMonthPrices = new Map<string, number>();

        if (allPurchases.length === 0) {
            return null;
        }

        const firstPurchaseDate = allPurchases[0].purchaseDate;
        const firstMonthKey = `${firstPurchaseDate.getFullYear()}/${String(firstPurchaseDate.getMonth() + 1).padStart(2, '0')}`;

        allPurchases.forEach(item => {
            const itemKey = `${item.name}-${item.unit}`;
            const monthKey = `${item.purchaseDate.getFullYear()}/${String(item.purchaseDate.getMonth() + 1).padStart(2, '0')}`;
            if (monthKey === firstMonthKey && !baseMonthPrices.has(itemKey)) {
                const basePrice = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                if (basePrice !== undefined) {
                  baseMonthPrices.set(itemKey, basePrice);
                }
            }
        });

        allPurchases.forEach(item => {
            const [jYear, jMonth] = gregorianToJalali(item.purchaseDate.getFullYear(), item.purchaseDate.getMonth() + 1, item.purchaseDate.getDate());
            const jalaliMonthKey = `${jYear}/${String(jMonth).padStart(2, '0')}`;
            const itemKey = `${item.name}-${item.unit}`;
            const basePrice = baseMonthPrices.get(itemKey);

            if (basePrice) {
                const currentPrice = calculatePricePerUnit(item.paidPrice, item.purchasedAmount);
                if (currentPrice === undefined) return;
                const priceRatio = basePrice > 0 ? currentPrice / basePrice : 1;
                const spend = item.paidPrice!;

                if (!monthlySpending.has(jalaliMonthKey)) {
                    monthlySpending.set(jalaliMonthKey, { totalSpend: 0, weightedPriceSum: 0 });
                }
                const monthData = monthlySpending.get(jalaliMonthKey)!;
                monthData.totalSpend += spend;
                monthData.weightedPriceSum += priceRatio * spend;
            }
        });

        monthlySpending.forEach((data, monthKey) => {
            if (data.totalSpend > 0) {
                priceIndexHistory.push({
                    date: monthKey,
                    period: monthKey,
                    priceIndex: (data.weightedPriceSum / data.totalSpend) * 100,
                    averageInflation: 0,
                    itemCount: 0
                });
            }
        });
        priceIndexHistory.sort((a, b) => (a.period || a.date).localeCompare(b.period || b.date));

        // --- Overall Change & Top Rises ---
        const overallChange = priceIndexHistory.length >= 2
            ? (((priceIndexHistory[priceIndexHistory.length - 1].priceIndex || 0) - (priceIndexHistory[0].priceIndex || 0)) / (priceIndexHistory[0].priceIndex || 1)) * 100
            : 0;

        const topItemRises = itemInflation.filter(i => (i.changePercentage || 0) > 0).sort((a, b) => (b.changePercentage || 0) - (a.changePercentage || 0)).slice(0, 5);
        const topCategoryRises = categoryInflation.filter(c => (c.changePercentage || 0) > 0).sort((a, b) => (b.changePercentage || 0) - (a.changePercentage || 0)).slice(0, 5);

        return {
            averageInflation: overallChange,
            totalItems: itemInflation.length,
            details: itemInflation,
            timeline: priceIndexHistory,
            overallChange,
            priceIndexHistory,
            topItemRises,
            topCategoryRises,
        };
      },
      getSmartSuggestions: () => {
        // Purchase-based events (existing logic)
        const purchaseEvents = get().lists
          .flatMap(list => list.items.map(item => ({ ...item, purchaseDate: new Date(list.createdAt) })))
          .filter(item => item.status === ItemStatus.Bought && item.purchasedAmount && item.purchasedAmount > 0)
          .sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());

        const purchaseHistory = new Map<string, { purchases: { date: Date; amount: number }[]; name: string; unit: Unit; category: string }>();
        purchaseEvents.forEach(item => {
          const key = `${item.name}-${item.unit}`;
          if (!purchaseHistory.has(key)) purchaseHistory.set(key, { purchases: [], name: item.name, unit: item.unit, category: item.category });
          purchaseHistory.get(key)!.purchases.push({ date: item.purchaseDate, amount: item.purchasedAmount! });
        });

        // Build consumption history from sell transactions + recipes (inferred ingredient consumption)
        const consumptionHistory = new Map<string, { consumptions: { date: Date; amount: number }[] }>();
        const sellTx = get().sellTransactions || [];
        sellTx.forEach(tx => {
          const txDate = new Date(tx.date);
          tx.items.forEach(soldItem => {
            const pos = get().posItems.find(p => p.id === soldItem.posItemId);
            if (pos && pos.recipeId) {
              const recipe = get().recipes.find(r => r.id === pos.recipeId);
              if (recipe) {
                recipe.ingredients.forEach(ing => {
                  const key = `${ing.itemName}-${ing.itemUnit}`;
                  if (!consumptionHistory.has(key)) consumptionHistory.set(key, { consumptions: [] });
                  consumptionHistory.get(key)!.consumptions.push({ date: txDate, amount: ing.requiredQuantity * soldItem.quantity });
                });
              }
            } else {
              // Map sold item to master item if possible
              const name = pos ? pos.name : soldItem.name;
              const info = get().itemInfoMap[name];
              const unit = info?.unit || Unit.Piece;
              const key = `${name}-${unit}`;
              if (!consumptionHistory.has(key)) consumptionHistory.set(key, { consumptions: [] });
              consumptionHistory.get(key)!.consumptions.push({ date: txDate, amount: soldItem.quantity });
            }
          });
        });

        const suggestions: SmartSuggestion[] = [];
        const oneDay = 24 * 60 * 60 * 1000;
        const REORDER_BUFFER_DAYS = 3;
        const now = Date.now();

        // Enhanced: Check for items with only sales data (recipe-based consumption)
        const recipeBasedConsumption = new Map<string, { consumptions: { date: Date; amount: number }[]; name: string; unit: Unit; category: string }>();
        consumptionHistory.forEach((data, key) => {
          if (!purchaseHistory.has(key) && data.consumptions.length >= 3) {
            // Try to find item info from various sources
            const parts = key.split('-');
            if (parts.length >= 2) {
              const unit = parts.slice(1).join('-') as Unit;
              const name = parts[0];
              const info = get().itemInfoMap[name];
              if (info) {
                recipeBasedConsumption.set(key, {
                  ...data,
                  name,
                  unit: info.unit,
                  category: info.category,
                });
              } else {
                // Try to find from known items
                const knownItem = get().getAllKnownItems().find(i => i.name === name && i.unit === unit);
                if (knownItem) {
                  recipeBasedConsumption.set(key, {
                    ...data,
                    name: knownItem.name,
                    unit: knownItem.unit,
                    category: knownItem.category,
                  });
                }
              }
            }
          }
        });

        // Primary: use purchase history as baseline, deduct consumption inferred from sales
        purchaseHistory.forEach(history => {
          if (history.purchases.length < 2) return; // need at least 2 purchases to establish a pattern

          const firstPurchase = history.purchases[0];
          const lastPurchase = history.purchases[history.purchases.length - 1];
          const daysSinceLastPurchase = Math.round((now - lastPurchase.date.getTime()) / oneDay);

          const totalQuantityPurchased = history.purchases.reduce((s, p) => s + p.amount, 0);
          const totalDurationDays = Math.max(1, Math.round((lastPurchase.date.getTime() - firstPurchase.date.getTime()) / oneDay));
          const dailyConsumptionRateFromPurchases = totalQuantityPurchased / totalDurationDays;

          const key = `${history.name}-${history.unit}`;
          const consumptions = consumptionHistory.get(key)?.consumptions || [];

          // Calculate total consumed since first purchase
          const firstPurchaseDate = history.purchases[0].date;
          const totalConsumed = consumptions
            .filter(c => c.date.getTime() >= firstPurchaseDate.getTime())
            .reduce((s, c) => s + c.amount, 0);

          // Calculate total purchased
          const totalPurchased = history.purchases.reduce((s, p) => s + p.amount, 0);

          // Use actual stock if available, otherwise estimate from purchases - consumptions
          const actualStock = get().getStock(history.name, history.unit);
          const estimatedCurrentStock = actualStock >= 0
            ? actualStock
            : Math.max(0, totalPurchased - totalConsumed);

          // Prefer sales-derived rate if sufficient data, else fall back to purchase-derived rate
          let dailyConsumptionRate = dailyConsumptionRateFromPurchases;
          if (consumptions.length >= 2) {
            const cFirst = consumptions[0].date;
            const cLast = consumptions[consumptions.length - 1].date;
            const totalConsumed = consumptions.reduce((s, c) => s + c.amount, 0);
            const duration = Math.max(1, Math.round((cLast.getTime() - cFirst.getTime()) / oneDay));
            dailyConsumptionRate = totalConsumed / duration;
          }

          if (dailyConsumptionRate <= 0) return;

          const reorderPointQuantity = dailyConsumptionRate * REORDER_BUFFER_DAYS;
          const avgPurchaseCycle = history.purchases.length > 1
            ? totalDurationDays / history.purchases.length
            : 30;

          // Check for price inflation - compare last purchase to previous purchase
          const priceHistory = get().getItemPriceHistory(history.name, history.unit);
          let inflationReason = '';
          if (priceHistory.length >= 2) {
            const lastPrice = priceHistory[priceHistory.length - 1].pricePerUnit;
            const previousPrice = priceHistory[priceHistory.length - 2].pricePerUnit;
            if (previousPrice > 0 && lastPrice > previousPrice * 1.05) {
              const percentIncrease = ((lastPrice - previousPrice) / previousPrice * 100).toFixed(1);
              inflationReason = t.suggestionReasonInflation(percentIncrease);
            }
          }

          if (estimatedCurrentStock <= 0) {
            suggestions.push({
              name: history.name,
              unit: history.unit,
              category: history.category,
              lastPurchaseDate: lastPurchase.date.toISOString(),
              avgPurchaseCycleDays: avgPurchaseCycle,
              reason: inflationReason || t.suggestionReasonDepleted,
              priority: 'high'
            });
          } else if (estimatedCurrentStock <= reorderPointQuantity) {
            const daysLeft = Math.ceil(estimatedCurrentStock / dailyConsumptionRate);
            suggestions.push({
              name: history.name,
              unit: history.unit,
              category: history.category,
              lastPurchaseDate: lastPurchase.date.toISOString(),
              avgPurchaseCycleDays: avgPurchaseCycle,
              reason: inflationReason || t.suggestionReasonStockLow(estimatedCurrentStock, history.unit, daysLeft),
              priority: daysLeft <= 1 ? 'high' : 'medium'
            });
          } else if (daysSinceLastPurchase >= avgPurchaseCycle * 0.8 && daysSinceLastPurchase > 7) {
            // Suggest based on purchase cycle
            suggestions.push({
              name: history.name,
              unit: history.unit,
              category: history.category,
              lastPurchaseDate: lastPurchase.date.toISOString(),
              avgPurchaseCycleDays: avgPurchaseCycle,
              reason: `طبق الگوی خرید، زمان خرید مجدد نزدیک است (${Math.round(avgPurchaseCycle)} روز)`,
              priority: 'low',
            });
          }
        });

        // Add recipe-based suggestions (items consumed but never directly purchased)
        recipeBasedConsumption.forEach((data) => {
          const consumptions = data.consumptions;
          if (consumptions.length < 3) return;

          const sorted = consumptions.sort((a, b) => a.date.getTime() - b.date.getTime());
          const first = sorted[0].date;
          const last = sorted[sorted.length - 1].date;
          const totalConsumed = consumptions.reduce((s, c) => s + c.amount, 0);
          const duration = Math.max(1, Math.round((last.getTime() - first.getTime()) / oneDay));
          const dailyRate = totalConsumed / duration;
          const daysSinceLastConsumption = Math.round((now - last.getTime()) / oneDay);

          if (dailyRate > 0 && daysSinceLastConsumption > 7) {
            const estimatedStock = Math.max(0, totalConsumed - (dailyRate * daysSinceLastConsumption));
            if (estimatedStock <= dailyRate * REORDER_BUFFER_DAYS) {
              suggestions.push({
                name: data.name,
                unit: data.unit,
                category: data.category,
                lastPurchaseDate: last.toISOString(),
                reason: `مصرف از طریق دستور پخت: موجودی کم (${estimatedStock.toFixed(1)} ${data.unit})`,
                priority: estimatedStock <= 0 ? 'high' : 'medium',
              });
            }
          }
        });

        const priorityRank: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };
        return suggestions.sort((a, b) => {
          const aPriority = typeof a.priority === 'string' ? priorityRank[a.priority] : 3;
          const bPriority = typeof b.priority === 'string' ? priorityRank[b.priority] : 3;
          const priorityDelta = aPriority - bPriority;
          if (priorityDelta !== 0) return priorityDelta;
          return a.name.localeCompare(b.name, 'fa');
        });
      },

      getSmartItemSuggestions: (query, limit = 10) => {
        if (!query || query.trim().length === 0) {
          // Return frequently purchased items when no query
          const allItems = get().getAllKnownItems();
          const recentPurchases = get().getRecentPurchases(50);
          const recentItemSet = new Set(recentPurchases.map(p => `${p.name}-${p.unit}`));

          // Pre-compute latest purchase dates for all items to avoid repeated nested operations
          const latestPurchaseDates = new Map<string, Date>();
          get().lists.forEach(list => {
            const listDate = new Date(list.createdAt);
            list.items.forEach(item => {
              if (item.status === ItemStatus.Bought) {
                const key = `${item.name}-${item.unit}`;
                const existing = latestPurchaseDates.get(key);
                if (!existing || listDate > existing) {
                  latestPurchaseDates.set(key, listDate);
                }
              }
            });
          });

          return allItems
            .map(item => {
              const isRecent = recentItemSet.has(`${item.name}-${item.unit}`);
              const latestDate = latestPurchaseDates.get(`${item.name}-${item.unit}`);
              const daysSincePurchase = latestDate
                ? Math.floor((Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000))
                : 999;

              let score = 0.5;
              if (isRecent) score += 0.3;
              if (item.purchaseCount > 5) score += 0.2;
              if (daysSincePurchase < 30) score += 0.2;

              return {
                name: item.name,
                unit: item.unit,
                category: item.category,
                score,
                reason: isRecent
                  ? 'اخیراً خریداری شده'
                  : item.purchaseCount > 3
                    ? 'کالای پر استفاده'
                    : 'کالای شناخته شده',
              };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        }

        const normalizedQuery = query.trim().toLowerCase();
        const allKnownItems = get().getAllKnownItems();
        const recentPurchases = get().getRecentPurchases(100);
        const recentItemSet = new Set(recentPurchases.map(p => `${p.name}-${p.unit}`));

        // Get all unique item names for fuzzy matching (including POS items)
        const allItemNames = new Set<string>();
        allKnownItems.forEach(item => allItemNames.add(item.name));
        get().lists.forEach(list => {
          list.items.forEach(item => allItemNames.add(item.name));
        });
        Object.keys(get().itemInfoMap).forEach(name => allItemNames.add(name));
        // Include POS items in the search
        get().posItems.forEach(posItem => {
          if (get().itemInfoMap[posItem.name]) {
            allItemNames.add(posItem.name);
          }
        });

        // Find fuzzy matches
        const fuzzyResults = findFuzzyMatches(normalizedQuery, Array.from(allItemNames), {
          minScore: 0.2,
          maxResults: limit * 2,
          boostRecent: true,
          recentItems: recentItemSet,
        });

        // Build comprehensive suggestions
        const suggestions: Array<{ name: string; unit: Unit; category: string; score: number; reason: string }> = [];
        const seen = new Set<string>();
        const vendorMap = new Map(get().vendors.map(v => [v.id, v.name]));

        fuzzyResults.forEach(match => {
          // Find all units/categories for this item name
          const itemVariants = allKnownItems.filter(i => i.name === match.item);

          if (itemVariants.length > 0) {
            itemVariants.forEach(item => {
              const key = `${item.name}-${item.unit}`;
              if (seen.has(key)) return;
              seen.add(key);

              const isRecent = recentItemSet.has(key);
              const lastPurchase = get().getLatestPurchaseInfo(item.name, item.unit);
              const stock = get().getStock(item.name, item.unit);

              let score = match.score;
              if (isRecent) score *= 1.3;
              if (item.purchaseCount > 5) score *= 1.2;
              if (stock > 0) score *= 0.9; // Slightly lower if in stock

              let reason = '';
              if (match.score > 0.9) reason = 'تطابق دقیق';
              else if (match.score > 0.7) reason = 'تطابق خوب';
              else reason = 'تطابق احتمالی';

              if (isRecent) reason += ' • اخیراً خریداری شده';
              if (item.purchaseCount > 3) reason += ' • پر استفاده';
              if (stock <= 0) reason += ' • موجودی تمام شده';

              // Add vendor and price info from last purchase
              if (lastPurchase.vendorId) {
                const vendorName = vendorMap.get(lastPurchase.vendorId);
                if (vendorName) reason += ` • فروشنده: ${vendorName}`;
              }
              if (lastPurchase.pricePerUnit) {
                reason += ` • قیمت: ${Math.round(lastPurchase.pricePerUnit).toLocaleString('fa-IR')}`;
              }

              suggestions.push({
                name: item.name,
                unit: item.unit,
                category: item.category,
                score: Math.min(1.0, score),
                reason: reason || 'پیشنهاد هوشمند',
              });
            });
          } else {
            // Item name found but no purchase history - use itemInfoMap
            const info = get().itemInfoMap[match.item];
            if (info) {
              const key = `${match.item}-${info.unit}`;
              if (seen.has(key)) return;
              seen.add(key);

              suggestions.push({
                name: match.item,
                unit: info.unit,
                category: info.category,
                score: match.score * 0.7, // Lower score for items without purchase history
                reason: 'کالای شناخته شده',
              });
            }
          }
        });

        // POS items are now included in the fuzzy match results above
        // No need for separate processing

        return suggestions
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      },

      getPendingPayments: () => {
          const pending: PendingPaymentItem[] = [];
          get().lists.forEach(list => {
              list.items.forEach(item => {
                  if (item.status === ItemStatus.Bought && item.paymentStatus === PaymentStatus.Due) {
                      pending.push({
                          itemName: item.name,
                          unit: item.unit,
                          totalDue: item.paidPrice || 0,
                          vendorId: item.vendorId,
                          vendorName: item.vendorId ? get().vendors.find(v => v.id === item.vendorId)?.name : undefined,
                          listIds: [list.id],
                          purchaseDate: list.createdAt,
                      });
                  }
              });
          });
          return pending.sort((a, b) => new Date(a.purchaseDate || '').getTime() - new Date(b.purchaseDate || '').getTime());
      },
      getRecentPurchases: (count) => {
          const recent: RecentPurchaseItem[] = [];
          get().lists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .forEach(list => {
                  list.items.filter(item => item.status === ItemStatus.Bought)
                      .forEach(item => {
                          if (recent.length < count) {
                              recent.push({
                                  name: item.name,
                                  unit: item.unit,
                                  lastPurchaseDate: new Date(list.createdAt),
                                  lastPricePerUnit: item.paidPrice || 0,
                                  purchaseCount: 1,
                                  listId: list.id
                              });
                          }
                      });
              });
          return recent;
      },
      getExpenseForecast: () => {
        const allPurchases = get().lists
            .flatMap(l => l.items.map(i => ({...i, date: l.createdAt})))
            .filter(i => i.status === ItemStatus.Bought && i.paidPrice);

        if (allPurchases.length < 5) return null;

        const sorted = allPurchases.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstDay = new Date(sorted[0].date);
        const lastDay = new Date(sorted[sorted.length - 1].date);
        const oneDay = 24 * 60 * 60 * 1000;
        const totalDays = Math.round(Math.abs((lastDay.getTime() - firstDay.getTime()) / oneDay)) + 1;

        if (totalDays < 30) return null;

        const totalSpend = sorted.reduce((sum, item) => sum + item.paidPrice!, 0);
        const daily = totalSpend / totalDays;

        return {
            daily,
            monthly: daily * 30,
        };
      },
      getSummaryData: (period) => {
        const now = new Date();
        let startDate = new Date();
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        switch (period) {
            case '7d': startDate.setDate(now.getDate() - 6); break;
            case '30d': startDate.setDate(now.getDate() - 29); break;
            case 'mtd': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'ytd': startDate = new Date(now.getFullYear(), 0, 1); break;
            case 'all': startDate = new Date(0); break;
        }
        startDate.setHours(0, 0, 0, 0);

        const allPurchases = get().lists
            .flatMap(list => {
                const listDate = new Date(list.createdAt);
                return listDate >= startDate && listDate <= endDate
                    ? list.items.map(item => ({ ...item, purchaseDate: listDate }))
                    : [];
            })
            .filter(item => item.status === ItemStatus.Bought && item.paidPrice != null);

        if (allPurchases.length === 0) return null;

        const kpis = {
            totalSpend: allPurchases.reduce((sum, item) => sum + item.paidPrice!, 0),
            totalItems: new Set(allPurchases.map(item => item.name)).size,
            avgDailySpend: 0,
            topCategory: null as { name: string, spend: number } | null,
            topVendor: null as { name: string, spend: number } | null,
        };

        const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        kpis.avgDailySpend = kpis.totalSpend / totalDays;

        const categorySpend = allPurchases.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + item.paidPrice!;
            return acc;
        }, {} as Record<string, number>);

        const topCat = Object.entries(categorySpend).sort((a,b) => b[1] - a[1])[0];
        if (topCat) kpis.topCategory = { name: topCat[0], spend: topCat[1] };

        const vendorMap = new Map(get().vendors.map(v => [v.id, v.name]));
        const vendorSpend = allPurchases.reduce((acc, item) => {
            if (item.vendorId) {
                const vendorName = vendorMap.get(item.vendorId) || "Unknown";
                acc[vendorName] = (acc[vendorName] || 0) + item.paidPrice!;
            }
            return acc;
        }, {} as Record<string, number>);

        const topVen = Object.entries(vendorSpend).sort((a,b) => b[1] - a[1])[0];
        if (topVen) kpis.topVendor = { name: topVen[0], spend: topVen[1] };

        // Chart Data
        const spendOverTime: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const timeMap = new Map<string, number>();
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
             const key = toJalaliDateString(d.toISOString());
             timeMap.set(key, 0);
        }
        allPurchases.forEach(item => {
            const key = toJalaliDateString(item.purchaseDate.toISOString());
            timeMap.set(key, (timeMap.get(key) || 0) + item.paidPrice!);
        });
        spendOverTime.labels = Array.from(timeMap.keys());
        spendOverTime.data = Array.from(timeMap.values());

        const spendByCategory: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const sortedCategories = Object.entries(categorySpend).sort((a,b) => b[1] - a[1]);
        spendByCategory.labels = sortedCategories.map(c => c[0]);
        spendByCategory.data = sortedCategories.map(c => c[1]);

        const spendByVendor: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const sortedVendors = Object.entries(vendorSpend).sort((a,b) => b[1] - a[1]);
        spendByVendor.labels = sortedVendors.map(v => v[0]);
        spendByVendor.data = sortedVendors.map(v => v[1]);

        return {
            kpis,
            charts: { spendOverTime, spendByCategory, spendByVendor },
            period: { startDate, endDate }
        };
      },


      importData: async (jsonData) => {
        try {
            const data = JSON.parse(jsonData) as {
                lists?: unknown[];
                customCategories?: string[];
                vendors?: Vendor[];
                categoryVendorMap?: Record<string, string>;
                itemInfoMap?: Record<string, { unit: string; category: string }>;
                posItems?: unknown[];
                posCategories?: string[];
                sellTransactions?: unknown[];
                recipes?: unknown[];
                stockEntries?: Record<string, unknown>;
                auditLog?: unknown[];
                shifts?: unknown[];
            };

            if (Array.isArray(data.lists)) {
                const cleanedLists = data.lists.map((list: unknown) => {
                    if (typeof list === 'object' && list !== null) {
                        const listObj = list as { items?: unknown[]; [key: string]: unknown };
                        if (Array.isArray(listObj.items)) {
                            return {
                                ...listObj,
                                items: listObj.items.map((item: unknown) => {
                                    if (typeof item === 'object' && item !== null) {
                                        const itemObj = item as { receiptImage?: unknown; [key: string]: unknown };
                                        const { receiptImage, ...rest } = itemObj;
                                        return rest;
                                    }
                                    return item;
                                }),
                            };
                        }
                        return listObj;
                    }
                    return list;
                }) as ShoppingList[];

                const cleanedData = {
                    lists: cleanedLists,
                    customCategories: Array.isArray(data.customCategories) ? data.customCategories : [],
                    vendors: Array.isArray(data.vendors) ? data.vendors : [],
                    categoryVendorMap: data.categoryVendorMap && typeof data.categoryVendorMap === 'object' ? data.categoryVendorMap : {},
                    itemInfoMap: data.itemInfoMap && typeof data.itemInfoMap === 'object' ? data.itemInfoMap : {},
                    posItems: Array.isArray(data.posItems) ? (data.posItems as POSItem[]) : [],
                    posCategories: Array.isArray(data.posCategories) ? data.posCategories : [],
                    sellTransactions: Array.isArray(data.sellTransactions) ? (data.sellTransactions as SellTransaction[]) : [],
                    recipes: Array.isArray(data.recipes) ? (data.recipes as Recipe[]) : [],
                    stockEntries: data.stockEntries && typeof data.stockEntries === 'object' ? (data.stockEntries as Record<string, StockEntry>) : {},
                    auditLog: Array.isArray(data.auditLog) ? (data.auditLog as AuditLogEntry[]) : [],
                    shifts: Array.isArray(data.shifts) ? (data.shifts as Shift[]) : [],
                };

                set(cleanedData as Partial<FullShoppingState>);
                await saveData(cleanedData);
            } else {
                throw new Error("Invalid data format: lists must be an array");
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Import failed";
            logger.error("Import failed:", errorMessage);
            throw new Error(errorMessage);
        }
      },

      exportData: () => {
        const data = {
            lists: get().lists,
            customCategories: get().customCategories,
            vendors: get().vendors,
            categoryVendorMap: get().categoryVendorMap,
            itemInfoMap: get().itemInfoMap,
            posItems: get().posItems,
            sellTransactions: get().sellTransactions,
            recipes: get().recipes,
            stockEntries: get().stockEntries,
            auditLog: get().auditLog,
            shifts: get().shifts,
            accounts: get().accounts,
            journalEntries: get().journalEntries,
            taxSettings: get().taxSettings,
            taxRates: get().taxRates,
            customers: get().customers,
            invoices: get().invoices,
            payments: get().payments,
        };
        return JSON.stringify(data, null, 2);
      },

      // ========== SHIFT MANAGEMENT ==========
      startShift: (startingCash) => {
        // End any active shift first
        const activeShift = get().getActiveShift();
        if (activeShift) {
          // Auto-end previous shift
          const transactions = get().getShiftTransactions(activeShift.id);
          const cashTransactions = transactions.filter(t =>
            t.paymentMethod === PaymentMethod.Cash && !t.isRefund
          );
          const refunds = transactions.filter(t => t.isRefund && t.paymentMethod === PaymentMethod.Cash);
          const expectedCash = activeShift.startingCash +
            cashTransactions.reduce((sum, t) => sum + t.totalAmount, 0) -
            refunds.reduce((sum, t) => sum + Math.abs(t.totalAmount), 0);

          set(state => ({
            shifts: state.shifts.map(s =>
              s.id === activeShift.id
                ? { ...s, endTime: new Date().toISOString(), endingCash: expectedCash, expectedCash, difference: 0, isActive: false }
                : s
            )
          }));
        }

        const newShift: Shift = {
          id: `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          startTime: new Date().toISOString(),
          startingCash,
          isActive: true,
          transactions: [],
        };

        set(state => ({
          shifts: [...state.shifts, newShift],
          ...addAuditLogEntry(state, 'transaction_created', {
            metadata: { action: 'shift_started', shiftId: newShift.id, startingCash },
          }),
        }));
        debouncedSaveData(get);
        return newShift.id;
      },

      endShift: (endingCash, notes) => {
        const activeShift = get().getActiveShift();
        if (!activeShift) {
          throw new Error('No active shift to end');
        }

        const transactions = get().getShiftTransactions(activeShift.id);
        const cashTransactions = transactions.filter(t =>
          t.paymentMethod === PaymentMethod.Cash && !t.isRefund
        );
        const refunds = transactions.filter(t => t.isRefund && t.paymentMethod === PaymentMethod.Cash);
        const expectedCash = activeShift.startingCash +
          cashTransactions.reduce((sum, t) => sum + t.totalAmount, 0) -
          refunds.reduce((sum, t) => sum + Math.abs(t.totalAmount), 0);

        const difference = endingCash - expectedCash;

        set(state => ({
          shifts: state.shifts.map(s =>
            s.id === activeShift.id
              ? {
                  ...s,
                  endTime: new Date().toISOString(),
                  endingCash,
                  expectedCash,
                  difference,
                  notes,
                  isActive: false
                }
              : s
          ),
          ...addAuditLogEntry(state, 'transaction_updated', {
            metadata: { action: 'shift_ended', shiftId: activeShift.id, endingCash, expectedCash, difference },
          }),
        }));
        debouncedSaveData(get);
      },

      getActiveShift: () => {
        return get().shifts.find(s => s.isActive) || null;
      },

      getShiftTransactions: (shiftId) => {
        const shift = get().shifts.find(s => s.id === shiftId);
          if (!shift) return [];
          return get().sellTransactions.filter(t => shift.transactions.includes(t.id));
        },

      // ========== ACCOUNTING FUNCTIONS (PHASE 1) ==========

      initializeDefaultAccounts: () => {
        const existingAccounts = get().accounts;
        if (existingAccounts.length === 0) {
          set({ accounts: createDefaultChartOfAccounts() });
          debouncedSaveData(get);
        }
      },

      addAccount: (accountData) => {
        const newAccount: Account = {
          ...accountData,
          id: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          balance: accountData.balance ?? 0,
        };
        set(state => ({ accounts: [...state.accounts, newAccount] }));
        debouncedSaveData(get);
        return newAccount.id;
      },

      updateAccount: (accountId, updates) => {
        set(state => ({
          accounts: state.accounts.map(acc =>
            acc.id === accountId ? { ...acc, ...updates } : acc
          )
        }));
        debouncedSaveData(get);
      },

      deleteAccount: (accountId) => {
        // Check if account is used in journal entries
        const hasEntries = get().journalEntries.some(je =>
          je.entries.some(e => e.accountId === accountId)
        );
        if (hasEntries) {
          throw new Error('Cannot delete account with existing journal entries');
        }
        set(state => ({ accounts: state.accounts.filter(acc => acc.id !== accountId) }));
        debouncedSaveData(get);
      },

      getAccountById: (accountId) => {
        return get().accounts.find(acc => acc.id === accountId);
      },

      getAccountByCode: (code) => {
        return get().accounts.find(acc => acc.code === code);
      },

      getAccountsByType: (type) => {
        return get().accounts.filter(acc => acc.type === type && acc.isActive);
      },

      createJournalEntry: (entryData) => {
        // Validate that debits equal credits
        const totalDebit = entryData.entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entryData.entries.reduce((sum, e) => sum + e.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
          throw new Error(`Journal entry must balance. Debits: ${totalDebit}, Credits: ${totalCredit}`);
        }

        const newEntry: JournalEntry = {
          id: `je-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          ...entryData,
        };

        // Update account balances
        set(state => {
          const updatedAccounts = state.accounts.map(acc => {
            const accountEntries = newEntry.entries.filter(e => e.accountId === acc.id);
            if (accountEntries.length === 0) return acc;

            let balanceChange = 0;
            accountEntries.forEach(e => {
              // For assets, expenses, COGS: debit increases, credit decreases
              // For liabilities, equity, revenue: credit increases, debit decreases
              if (acc.type === AccountType.Asset || acc.type === AccountType.Expense || acc.type === AccountType.COGS) {
                balanceChange += e.debit - e.credit;
              } else {
                balanceChange += e.credit - e.debit;
              }
            });

            return { ...acc, balance: acc.balance + balanceChange };
          });

          return {
            accounts: updatedAccounts,
            journalEntries: [...state.journalEntries, newEntry]
          };
        });

        debouncedSaveData(get);
        return newEntry.id;
      },

      getJournalEntriesByReference: (reference) => {
        return get().journalEntries.filter(je => je.reference === reference);
      },

      reverseJournalEntry: (entryId, reason) => {
        const originalEntry = get().journalEntries.find(je => je.id === entryId);
        if (!originalEntry) {
          throw new Error('Journal entry not found');
        }

        // Create reversal entry (swap debits and credits)
        const reversalEntry: JournalEntry = {
          id: `je-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          description: `برگشت: ${originalEntry.description} - ${reason}`,
          reference: originalEntry.reference,
          referenceType: originalEntry.referenceType,
          entries: originalEntry.entries.map(e => ({
            ...e,
            debit: e.credit,
            credit: e.debit,
          })),
          isAutomatic: false,
          createdBy: get().currentUser?.username,
        };

        // Mark original as reversed
        set(state => ({
          journalEntries: state.journalEntries.map(je =>
            je.id === entryId ? { ...je, isReversed: true } : je
          )
        }));

        // Create the reversal
        return get().createJournalEntry({
          ...reversalEntry,
          reversalOf: entryId,
        });
      },

      // ========== TAX FUNCTIONS (PHASE 3) ==========

      updateTaxSettings: (settings) => {
        set(state => ({
          taxSettings: { ...state.taxSettings, ...settings }
        }));
        debouncedSaveData(get);
      },

      addTaxRate: (taxRateData) => {
        const taxPayableAccount = get().getAccountByCode('2-201'); // Tax Payable account
        const newTaxRate: TaxRate = {
          ...taxRateData,
          id: `taxrate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          accountId: taxRateData.accountId || taxPayableAccount?.id || '',
        };
        set(state => ({ taxRates: [...state.taxRates, newTaxRate] }));
        debouncedSaveData(get);
        return newTaxRate.id;
      },

      updateTaxRate: (taxRateId, updates) => {
        set(state => ({
          taxRates: state.taxRates.map(tr =>
            tr.id === taxRateId ? { ...tr, ...updates } : tr
          )
        }));
        debouncedSaveData(get);
      },

      deleteTaxRate: (taxRateId) => {
        set(state => ({ taxRates: state.taxRates.filter(tr => tr.id !== taxRateId) }));
        debouncedSaveData(get);
      },

      getTaxRateById: (taxRateId) => {
        return get().taxRates.find(tr => tr.id === taxRateId);
      },

      getDefaultTaxRate: () => {
        const defaultId = get().taxSettings.defaultTaxRateId;
        if (defaultId) {
          return get().getTaxRateById(defaultId);
        }
        // Return first active tax rate
        return get().taxRates.find(tr => tr.isActive);
      },

      calculateTaxForAmount: (amount, taxRateId) => {
        const state = get();
        if (!state.taxSettings.enabled) {
          return { taxAmount: 0, taxRate: 0, total: amount };
        }

        let taxRate: TaxRate | undefined;
        if (taxRateId) {
          taxRate = state.getTaxRateById(taxRateId);
        } else {
          taxRate = state.getDefaultTaxRate();
        }

        if (!taxRate || !taxRate.isActive) {
          return { taxAmount: 0, taxRate: 0, total: amount };
        }

        const taxAmount = state.taxSettings.includeTaxInPrice
          ? amount * taxRate.rate / (1 + taxRate.rate) // Tax is included in price
          : amount * taxRate.rate; // Tax is added on top

        const total = state.taxSettings.includeTaxInPrice
          ? amount // Total is already the amount
          : amount + taxAmount; // Add tax to amount

        return {
          taxAmount: Math.round(taxAmount * 100) / 100,
          taxRate: taxRate.rate,
          total: Math.round(total * 100) / 100
        };
      },

      getAccountBalance: (accountId, asOfDate) => {
        const account = get().getAccountById(accountId);
        if (!account) return 0;

        // If no date specified, return current balance
        if (!asOfDate) {
          return account.balance;
        }

        // Calculate balance up to a specific date (including that date)
        // Start with account's opening balance (stored in account.balance is current, so we recalculate from scratch)
        const relevantEntries = get().journalEntries
          .filter(je => {
            const jeDate = new Date(je.date);
            return jeDate <= asOfDate && !je.isReversed;
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Start from 0 (accounts start with 0 balance, or we can add opening balance later if needed)
        let balance = 0;

        relevantEntries.forEach(je => {
          je.entries.forEach(e => {
            if (e.accountId === accountId) {
              // For Assets, Expenses, COGS: debit increases balance, credit decreases
              // For Liabilities, Equity, Revenue: credit increases balance, debit decreases
              if (account.type === AccountType.Asset || account.type === AccountType.Expense || account.type === AccountType.COGS) {
                balance += e.debit - e.credit;
              } else {
                balance += e.credit - e.debit;
              }
            }
          });
        });

        return balance;
      },

      getGeneralLedger: (accountId, startDate, endDate) => {
        const accounts = accountId
          ? [get().getAccountById(accountId)].filter((a): a is Account => a !== undefined)
          : get().accounts.filter(a => a.isActive);

        return accounts.map(account => {
          // Get opening balance (balance before startDate)
          let openingBalance = 0;
          if (startDate) {
            // Calculate balance up to (but not including) startDate
            const openingEntries = get().journalEntries
              .filter(je => {
                if (je.isReversed) return false;
                const jeDate = new Date(je.date);
                return jeDate < startDate;
              })
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            openingEntries.forEach(je => {
              je.entries.forEach(e => {
                if (e.accountId === account.id) {
                  if (account.type === AccountType.Asset || account.type === AccountType.Expense || account.type === AccountType.COGS) {
                    openingBalance += e.debit - e.credit;
                  } else {
                    openingBalance += e.credit - e.debit;
                  }
                }
              });
            });
          }

          // Get entries in the date range
          const relevantEntries = get().journalEntries
            .filter(je => {
              if (je.isReversed) return false;
              const jeDate = new Date(je.date);
              if (startDate && jeDate < startDate) return false;
              if (endDate && jeDate > endDate) return false;
              return je.entries.some(e => e.accountId === account.id);
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Start running balance from opening balance
          let runningBalance = openingBalance;

          const entries = relevantEntries.map(je => {
            const accountEntry = je.entries.find(e => e.accountId === account.id);
            if (!accountEntry) return null;

            const debit = accountEntry.debit;
            const credit = accountEntry.credit;

            // Update running balance based on account type
            if (account.type === AccountType.Asset || account.type === AccountType.Expense || account.type === AccountType.COGS) {
              runningBalance += debit - credit;
            } else {
              runningBalance += credit - debit;
            }

            return {
              date: je.date,
              description: je.description,
              reference: je.reference,
              debit,
              credit,
              balance: runningBalance,
            };
          }).filter((e): e is NonNullable<typeof e> => e !== null);

          return {
            account,
            entries,
            openingBalance,
            closingBalance: runningBalance,
          };
        });
      },

      getTrialBalance: (asOfDate) => {
        const date = asOfDate || new Date();
        const accounts = get().accounts.filter(a => a.isActive);

        const entries: TrialBalanceEntry[] = accounts.map(account => {
          const balance = get().getAccountBalance(account.id, date);

          // Determine debit or credit based on account type and balance
          // Trial balance shows the normal balance side for each account
          let debit = 0;
          let credit = 0;

          if (account.type === AccountType.Asset || account.type === AccountType.Expense || account.type === AccountType.COGS) {
            // Normal debit balance accounts
            // If balance is positive, it's a debit; if negative, it's a credit (abnormal)
            if (balance > 0) {
              debit = balance;
            } else if (balance < 0) {
              credit = Math.abs(balance); // Abnormal credit balance
            }
          } else {
            // Normal credit balance accounts (Liability, Equity, Revenue)
            // If balance is positive, it's a credit; if negative, it's a debit (abnormal)
            if (balance > 0) {
              credit = balance;
            } else if (balance < 0) {
              debit = Math.abs(balance); // Abnormal debit balance
            }
          }

          return {
            account,
            debit,
            credit,
            balance,
          };
        }).filter(entry => entry.debit !== 0 || entry.credit !== 0); // Only show accounts with balances

        const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
        const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

        return {
          entries,
          totalDebit,
          totalCredit,
          balanced,
        };
      },

      // ========== POS ITEMS ACTIONS ==========
      addPOSItem: (data) => {
        const currentItems = get().posItems;
        const maxOrder = currentItems.length > 0
          ? Math.max(...currentItems.map(item => item.order ?? 0), -1)
          : -1;
        const newPOSItem: POSItem = {
          id: `pos-${Date.now()}`,
          ...data,
          order: maxOrder + 1,
        };
        set(state => ({
          posItems: [...state.posItems, newPOSItem],
          ...addAuditLogEntry(state, 'item_created', {
            entityId: newPOSItem.id,
            entityName: newPOSItem.name,
            metadata: { category: newPOSItem.category, price: newPOSItem.sellPrice },
          }),
        }));
        debouncedSaveData(get);
        return newPOSItem.id;
      },

      updatePOSItem: (posItemId, updates) => {
        const oldItem = get().posItems.find(i => i.id === posItemId);
        set(state => ({
          posItems: state.posItems.map(item => item.id === posItemId ? { ...item, ...updates } : item),
          ...addAuditLogEntry(state, 'item_updated', {
            entityId: posItemId,
            entityName: oldItem?.name,
            changes: Object.keys(updates).reduce((acc, key) => {
              const oldValue = oldItem && key in oldItem ? (oldItem as unknown as Record<string, unknown>)[key] : undefined;
              const newValue = key in updates ? (updates as unknown as Record<string, unknown>)[key] : undefined;
              acc[key] = {
                old: oldValue,
                new: newValue,
              };
              return acc;
            }, {} as Record<string, { old?: unknown; new?: unknown }>),
          }),
        }));
        debouncedSaveData(get);
      },

      deletePOSItem: (posItemId) => {
        set(state => ({ posItems: state.posItems.filter(item => item.id !== posItemId) }));
        debouncedSaveData(get);
      },

      reorderPOSItems: (itemIds) => {
        set(state => {
          const itemMap = new Map(state.posItems.map(item => [item.id, item]));
          const reorderedItems = itemIds
            .map((id, index) => {
              const item = itemMap.get(id);
              if (!item) return null;
              return { ...item, order: index };
            })
            .filter((item): item is POSItem => item !== null);

          // Add any items not in the reordered list (shouldn't happen, but safety check)
          const reorderedIds = new Set(itemIds);
          const remainingItems = state.posItems
            .filter(item => !reorderedIds.has(item.id))
            .map((item, index) => ({ ...item, order: itemIds.length + index }));

          return {
            posItems: [...reorderedItems, ...remainingItems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
          };
        });
        debouncedSaveData(get);
      },

      getPOSItemsByCategory: (category) => {
        return get().posItems
          .filter(item => item.category === category)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      },

      getFrequentPOSItems: (limit) => {
        const items = get().posItems;
        const itemSaleCount = new Map<string, number>();
        get().sellTransactions.forEach(transaction => {
          transaction.items.forEach(item => {
            itemSaleCount.set(item.posItemId, (itemSaleCount.get(item.posItemId) || 0) + item.quantity);
          });
        });

        return get().posItems
          .filter(item => itemSaleCount.has(item.id))
          .sort((a, b) => {
            // First sort by sale count (descending), then by order
            const countDiff = (itemSaleCount.get(b.id) || 0) - (itemSaleCount.get(a.id) || 0);
            if (countDiff !== 0) return countDiff;
            return (a.order ?? 0) - (b.order ?? 0);
          })
          .slice(0, limit);
      },

      // ========== RECIPE ACTIONS ==========
      addRecipe: (recipe) => {
        const newRecipe: Recipe = {
          id: `recipe-${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...recipe,
        };
        set(state => ({ recipes: [...state.recipes, newRecipe] }));
        debouncedSaveData(get);
        return newRecipe.id;
      },

      updateRecipe: (recipeId, updates) => {
        const oldRecipe = get().recipes.find(r => r.id === recipeId);
        set(state => ({
          recipes: state.recipes.map(recipe => recipe.id === recipeId ? { ...recipe, ...updates } : recipe),
          ...addAuditLogEntry(state, 'recipe_updated', {
            entityId: recipeId,
            entityName: oldRecipe?.name,
            changes: Object.keys(updates).reduce((acc, key) => {
              const oldValue = oldRecipe && key in oldRecipe ? (oldRecipe as unknown as Record<string, unknown>)[key] : undefined;
              const newValue = key in updates ? (updates as unknown as Record<string, unknown>)[key] : undefined;
              acc[key] = {
                old: oldValue,
                new: newValue,
              };
              return acc;
            }, {} as Record<string, { old?: unknown; new?: unknown }>),
          }),
        }));
        debouncedSaveData(get);
      },

      deleteRecipe: (recipeId) => {
        const recipe = get().recipes.find(r => r.id === recipeId);
        set(state => ({
          recipes: state.recipes.filter(recipe => recipe.id !== recipeId),
          posItems: state.posItems.filter(item => item.recipeId !== recipeId),
          ...addAuditLogEntry(state, 'recipe_deleted', {
            entityId: recipeId,
            entityName: recipe?.name,
          }),
        }));
        debouncedSaveData(get);
      },

      calculateRecipeCost: (recipeId) => {
        const recipe = get().recipes.find(r => r.id === recipeId);
        if (!recipe) return 0;

        let totalCost = 0;
        recipe.ingredients.forEach(ingredient => {
          const latestInfo = get().getLatestPurchaseInfo(ingredient.itemName, ingredient.itemUnit);
          const costPerUnit = latestInfo.pricePerUnit || 0;
          totalCost += costPerUnit * ingredient.requiredQuantity;
        });
        return totalCost;
      },

      // ========== SELL TRANSACTION ACTIONS ==========
      addSellTransaction: (transaction) => {
        // Calculate next receipt number
        const existingTransactions = get().sellTransactions;
        const maxReceiptNumber = existingTransactions.reduce((max, trans) => {
          return Math.max(max, trans.receiptNumber || 0);
        }, 0);
        const nextReceiptNumber = maxReceiptNumber + 1;

        const newTransaction: SellTransaction = {
          id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          receiptNumber: nextReceiptNumber,
          ...transaction,
        };

        // Add audit log
        set(state => ({
          ...addAuditLogEntry(state, transaction.isRefund ? 'refund_created' : 'transaction_created', {
            entityId: newTransaction.id,
            metadata: {
              receiptNumber: nextReceiptNumber,
              totalAmount: transaction.totalAmount,
              paymentMethod: transaction.paymentMethod,
              itemCount: transaction.items.length,
            },
          }),
        }));

        // Update stock for each item sold
        let totalCOGS = 0;
        newTransaction.items.forEach(item => {
          // If this is a recipe item, deduct ingredients
          const posItem = get().posItems.find(p => p.id === item.posItemId);
          if (posItem && posItem.recipeId) {
            const recipe = get().recipes.find(r => r.id === posItem.recipeId);
            if (recipe) {
              recipe.ingredients.forEach(ingredient => {
                get().updateStock(ingredient.itemName, ingredient.itemUnit, -(ingredient.requiredQuantity * item.quantity));
              });
              // Add COGS for this item
              totalCOGS += item.costOfGoods || 0;
            }
          }
        });

        set(state => ({
          sellTransactions: [...state.sellTransactions, newTransaction],
          ...addAuditLogEntry(state, transaction.isRefund ? 'refund_created' : 'transaction_created', {
            entityId: newTransaction.id,
            metadata: {
              receiptNumber: nextReceiptNumber,
              totalAmount: transaction.totalAmount,
              paymentMethod: transaction.paymentMethod,
              itemCount: transaction.items.length,
            },
          }),
        }));

        // Create automatic journal entry for the sale
        try {
          const cashAccount = get().getAccountByCode('1-101');
          const bankAccount = get().getAccountByCode('1-102');
          const revenueAccount = get().getAccountByCode('4-101');
          const cogsAccount = get().getAccountByCode('5-101');
          const inventoryAccount = get().getAccountByCode('1-201');

          if (!revenueAccount) {
            logger.warn('Revenue account not found, skipping journal entry');
          } else {
            // Determine which account to debit based on payment method
            let debitAccountId = cashAccount?.id;
            if (transaction.paymentMethod === PaymentMethod.Card || transaction.paymentMethod === PaymentMethod.Transfer) {
              debitAccountId = bankAccount?.id;
            }

            if (debitAccountId) {
              const journalEntries: Array<{accountId: string, debit: number, credit: number, description?: string}> = [];

              // Check if transaction includes tax
              const taxAmount = newTransaction.taxAmount || 0;
              const subtotal = newTransaction.subtotal || newTransaction.totalAmount;
              const taxPayableAccount = get().getAccountByCode('2-201'); // Tax Payable

              // Main sales entry: Debit Cash/Bank, Credit Revenue (net of tax) + Tax Payable
              journalEntries.push({
                accountId: debitAccountId,
                debit: newTransaction.totalAmount, // Total amount received (including tax)
                credit: 0,
                description: transaction.paymentMethod === PaymentMethod.Cash ? 'صندوق' : 'بانک'
              });

              journalEntries.push({
                accountId: revenueAccount.id,
                debit: 0,
                credit: subtotal, // Revenue without tax
                description: 'درآمد فروش'
              });

              // Tax Payable entry if tax exists
              if (taxAmount > 0 && taxPayableAccount) {
                journalEntries.push({
                  accountId: taxPayableAccount.id,
                  debit: 0,
                  credit: taxAmount,
                  description: 'مالیات فروش'
                });
              }

              // COGS entry if applicable: Debit COGS, Credit Inventory
              if (totalCOGS > 0 && cogsAccount && inventoryAccount) {
                journalEntries.push({
                  accountId: cogsAccount.id,
                  debit: totalCOGS,
                  credit: 0,
                  description: 'بهای تمام شده'
                });

                journalEntries.push({
                  accountId: inventoryAccount.id,
                  debit: 0,
                  credit: totalCOGS,
                  description: 'کاهش موجودی'
                });
              }

              get().createJournalEntry({
                date: newTransaction.date,
                description: `فروش #${nextReceiptNumber}`,
                reference: newTransaction.id,
                referenceType: 'sale',
                entries: journalEntries,
                isAutomatic: true,
                createdBy: get().currentUser?.username,
              });
            }
          }
        } catch (error) {
          logger.error('Failed to create journal entry for sale:', error);
          // Don't fail the transaction if journal entry fails
        }

        debouncedSaveData(get);
        return newTransaction.id;
      },

      getSellTransactions: (period) => {
        const now = new Date();
        let startDate = new Date();
        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        switch (period) {
          case '7d': startDate.setDate(now.getDate() - 6); break;
          case '30d': startDate.setDate(now.getDate() - 29); break;
          case 'mtd': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case 'ytd': startDate = new Date(now.getFullYear(), 0, 1); break;
          case 'all': startDate = new Date(0); break;
        }
        startDate.setHours(0, 0, 0, 0);

        return get().sellTransactions.filter(trans => {
          const transDate = new Date(trans.date);
          return transDate >= startDate && transDate <= endDate;
        });
      },

      updateSellTransaction: (transactionId, updates) => {
        const oldTransaction = get().sellTransactions.find(t => t.id === transactionId);
        set(state => {
          const newState = {
            sellTransactions: state.sellTransactions.map(trans =>
              trans.id === transactionId ? { ...trans, ...updates } : trans
            ),
            ...addAuditLogEntry(state, 'transaction_updated', {
              entityId: transactionId,
              changes: Object.keys(updates).reduce((acc, key) => {
                const oldValue = oldTransaction && key in oldTransaction ? (oldTransaction as unknown as Record<string, unknown>)[key] : undefined;
                const newValue = key in updates ? (updates as unknown as Record<string, unknown>)[key] : undefined;
                acc[key] = {
                  old: oldValue,
                  new: newValue,
                };
                return acc;
              }, {} as Record<string, { old?: unknown; new?: unknown }>),
            }),
          };
          return newState;
        });
        debouncedSaveData(get);
      },

      deleteSellTransaction: (transactionId) => {
        const transaction = get().sellTransactions.find(t => t.id === transactionId);
        if (transaction) {
          // Restore stock for each item in the deleted transaction
          transaction.items.forEach(item => {
            const posItem = get().posItems.find(p => p.id === item.posItemId);
            if (posItem && posItem.recipeId) {
              const recipe = get().recipes.find(r => r.id === posItem.recipeId);
              if (recipe) {
                recipe.ingredients.forEach(ingredient => {
                  get().updateStock(ingredient.itemName, ingredient.itemUnit, ingredient.requiredQuantity * item.quantity);
                });
              }
            }
          });

          // Add audit log
          set(state => ({
            sellTransactions: state.sellTransactions.filter(t => t.id !== transactionId),
            ...addAuditLogEntry(state, 'transaction_deleted', {
              entityId: transactionId,
              metadata: {
                receiptNumber: transaction.receiptNumber,
                totalAmount: transaction.totalAmount,
                paymentMethod: transaction.paymentMethod,
                isRefund: transaction.isRefund,
              },
            }),
          }));
        } else {
          set(state => ({ sellTransactions: state.sellTransactions.filter(t => t.id !== transactionId) }));
        }
        debouncedSaveData(get);
      },

      // ========== STOCK MANAGEMENT ==========
      updateStock: (itemName, itemUnit, quantityChange) => {
        const key = `${itemName}-${itemUnit}`;
        set(state => {
          const existing = state.stockEntries[key];
          const currentQuantity = existing?.quantity || 0;
          const newQuantity = Math.max(0, currentQuantity + quantityChange);

          return {
            stockEntries: {
              ...state.stockEntries,
              [key]: {
                itemName,
                itemUnit,
                quantity: newQuantity,
                lastUpdated: new Date().toISOString(),
              }
            },
            // Add audit log for significant stock changes (only if change is non-zero)
            ...(Math.abs(quantityChange) > 0 ? addAuditLogEntry(state, 'stock_updated', {
              entityName: itemName,
              metadata: {
                unit: itemUnit,
                oldQuantity: currentQuantity,
                newQuantity,
                change: quantityChange,
              },
            }) : {}),
          };
        });
        debouncedSaveData(get);
      },

      getStock: (itemName, itemUnit) => {
        const key = `${itemName}-${itemUnit}`;
        return get().stockEntries[key]?.quantity || 0;
      },

      validateStockForRecipe: (recipeId) => {
        const recipe = get().recipes.find(r => r.id === recipeId);
        if (!recipe) return false;

        return recipe.ingredients.every(ingredient => {
          const available = get().getStock(ingredient.itemName, ingredient.itemUnit);
          return available >= ingredient.requiredQuantity;
        });
      },

      // ========== SELL ANALYTICS ==========
      getSellSummaryData: (period) => {
        const transactions = get().getSellTransactions(period);
        if (transactions.length === 0) return null;

        const kpis = {
          totalRevenue: 0,
          totalTransactions: transactions.length,
          avgTransactionValue: 0,
          topItem: null as { name: string; quantity: number; revenue: number } | null,
          topCategory: null as { name: string; revenue: number } | null,
        };

        const itemStats = new Map<string, { quantity: number; revenue: number; category: string }>();
        const categoryRevenue = new Map<string, number>();

        transactions.forEach(trans => {
          // Exclude Staff payments from revenue calculations
          const isStaffPayment = trans.paymentMethod === PaymentMethod.Staff ||
            (trans.splitPayments && trans.splitPayments.some(sp => sp.method === PaymentMethod.Staff));

          if (!isStaffPayment) {
            kpis.totalRevenue += trans.totalAmount;
          }

          trans.items.forEach(item => {
            const posItem = get().posItems.find(p => p.id === item.posItemId);
            if (posItem) {
              const existing = itemStats.get(item.posItemId) || { quantity: 0, revenue: 0, category: posItem.category };
              existing.quantity += item.quantity;
              // Exclude Staff payments from item revenue
              existing.revenue += isStaffPayment ? 0 : item.totalPrice;
              itemStats.set(item.posItemId, existing);

              // Exclude Staff payments from category revenue
              const categoryRev = categoryRevenue.get(posItem.category) || 0;
              categoryRevenue.set(posItem.category, categoryRev + (isStaffPayment ? 0 : item.totalPrice));
            }
          });
        });

        kpis.avgTransactionValue = kpis.totalRevenue / kpis.totalTransactions;

        // Top item
        let topItemId: string | null = null;
        let topItemStats: { quantity: number; revenue: number; category: string } | null = null;
        itemStats.forEach((stats: { quantity: number; revenue: number; category: string }, itemId: string) => {
          if (!topItemStats || stats.revenue > topItemStats.revenue) {
            topItemId = itemId;
            topItemStats = stats;
          }
        });
        if (topItemId && topItemStats !== null) {
          const posItem = get().posItems.find(p => p.id === topItemId);
          const stats: { quantity: number; revenue: number; category: string } = topItemStats;
          kpis.topItem = {
            name: posItem?.name || 'Unknown',
            quantity: stats.quantity,
            revenue: stats.revenue,
          };
        }

        // Top category
        let topCatName: string | null = null;
        let topCatRevenue = 0;
        categoryRevenue.forEach((revenue, category) => {
          if (revenue > topCatRevenue) {
            topCatName = category;
            topCatRevenue = revenue;
          }
        });
        if (topCatName) {
          kpis.topCategory = { name: topCatName, revenue: topCatRevenue };
        }

        // Chart data
        const revenueOverTime: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const timeMap = new Map<string, number>();

        const startDate = transactions[0] ? new Date(transactions[0].date) : new Date();
        const endDate = transactions[transactions.length - 1] ? new Date(transactions[transactions.length - 1].date) : new Date();

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const key = toJalaliDateString(d.toISOString());
          timeMap.set(key, 0);
        }

        transactions.forEach(trans => {
          const key = toJalaliDateString(trans.date);
          timeMap.set(key, (timeMap.get(key) || 0) + trans.totalAmount);
        });

        revenueOverTime.labels = Array.from(timeMap.keys());
        revenueOverTime.data = Array.from(timeMap.values());

        const revenueByCategory: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const sortedCats = Array.from(categoryRevenue.entries()).sort((a, b) => b[1] - a[1]);
        revenueByCategory.labels = sortedCats.map(c => c[0]);
        revenueByCategory.data = sortedCats.map(c => c[1]);

        const itemPopularity: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const sortedItems = Array.from(itemStats.entries()).sort((a, b) => b[1].quantity - a[1].quantity).slice(0, 10);
        itemPopularity.labels = sortedItems.map(([itemId]) => {
          const pos = get().posItems.find(p => p.id === itemId);
          return pos?.name || 'Unknown';
        });
        itemPopularity.data = sortedItems.map(item => item[1].quantity);

        return {
          kpis,
          charts: { revenueOverTime, revenueByCategory, itemPopularity },
          period: { startDate, endDate }
        };
      },

      getFinancialOverview: (period) => {
        const buySummary = get().getSummaryData(period);
        const sellSummary = get().getSellSummaryData(period);

        if (!buySummary || !sellSummary) return null;

        const buyData = buySummary.kpis;
        const sellData = sellSummary.kpis;

        // Calculate COGS (Cost of Goods Sold) = total cost of ingredients sold via recipes
        let totalCOGS = 0;
        get().getSellTransactions(period).forEach(trans => {
          trans.items.forEach(item => {
            if (item.costOfGoods) {
              totalCOGS += item.costOfGoods;
            }
          });
        });

        const grossProfit = sellData.totalRevenue - totalCOGS;
        const grossMargin = sellData.totalRevenue > 0 ? (grossProfit / sellData.totalRevenue) * 100 : 0;

        return {
          buy: {
            totalSpend: buyData.totalSpend,
            itemCount: buyData.totalItems,
            avgDailySpend: buyData.avgDailySpend,
          },
          sell: {
            totalRevenue: sellData.totalRevenue,
            transactionCount: sellData.totalTransactions,
            avgTransactionValue: sellData.avgTransactionValue,
          },
          recipes: {
            totalCostOfGoods: totalCOGS,
          },
          profitAnalysis: {
            grossProfit,
            grossMargin,
            netProfit: grossProfit, // Simplified; can add other expenses later
          },
          period: {
            startDate: new Date(Math.min(buySummary.period.startDate.getTime(), sellSummary.period.startDate.getTime())),
            endDate: new Date(Math.max(buySummary.period.endDate.getTime(), sellSummary.period.endDate.getTime())),
          }
        };
      },

      // ========== FINANCIAL STATEMENTS (PHASE 2) ==========

      getBalanceSheet: (asOfDate) => {
        const date = asOfDate || new Date();
        const accounts = get().accounts.filter(a => a.isActive);

        // Categorize accounts
        const assets = accounts.filter(a => a.type === AccountType.Asset);
        const liabilities = accounts.filter(a => a.type === AccountType.Liability);
        const equity = accounts.filter(a => a.type === AccountType.Equity);

        // Get balances as of date
        // For balance sheet display, we show the normal balance side:
        // Assets: debit balance (positive), Liabilities/Equity: credit balance (positive)
        const allAssetBalances = assets.map(acc => {
          const balance = get().getAccountBalance(acc.id, date);
          // Assets should have debit balances (positive), but show absolute value for display
          return {
            account: acc,
            amount: balance >= 0 ? balance : Math.abs(balance) // Show positive, but flag if negative
          };
        }).filter(item => item.amount !== 0); // Only show accounts with balances

        const allLiabilityBalances = liabilities.map(acc => {
          const balance = get().getAccountBalance(acc.id, date);
          // Liabilities should have credit balances (positive), but show absolute value for display
          return {
            account: acc,
            amount: balance >= 0 ? balance : Math.abs(balance) // Show positive, but flag if negative
          };
        }).filter(item => item.amount !== 0); // Only show accounts with balances

        const allEquityBalances = equity.map(acc => {
          const balance = get().getAccountBalance(acc.id, date);
          // Equity should have credit balances (positive), but show absolute value for display
          return {
            account: acc,
            amount: balance >= 0 ? balance : Math.abs(balance) // Show positive, but flag if negative
          };
        }).filter(item => item.amount !== 0); // Only show accounts with balances

        // Separate current and non-current assets/liabilities
        // For now, we'll categorize based on account codes:
        // Current assets: Cash (1-101), Bank (1-102), Inventory (1-201), AR (1-301)
        // Non-current: Everything else with code >= 1-400
        const currentAssets = allAssetBalances.filter(item => {
          const code = parseInt(item.account.code.split('-')[1]);
          return code < 400; // Codes 101-399 are current assets
        });
        const nonCurrentAssets = allAssetBalances.filter(item => {
          const code = parseInt(item.account.code.split('-')[1]);
          return code >= 400;
        });

        // Current liabilities: AP (2-101), Tax Payable (2-201)
        // Non-current: Everything else with code >= 2-300
        const currentLiabilities = allLiabilityBalances.filter(item => {
          const code = parseInt(item.account.code.split('-')[1]);
          return code < 300;
        });
        const nonCurrentLiabilities = allLiabilityBalances.filter(item => {
          const code = parseInt(item.account.code.split('-')[1]);
          return code >= 300;
        });

        // Calculate totals
        const totalCurrentAssets = currentAssets.reduce((sum, item) => sum + item.amount, 0);
        const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, item) => sum + item.amount, 0);
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

        const totalCurrentLiabilities = currentLiabilities.reduce((sum, item) => sum + item.amount, 0);
        const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, item) => sum + item.amount, 0);
        const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

        const totalEquity = allEquityBalances.reduce((sum, item) => sum + item.amount, 0);

        // Check if balance sheet equation holds: Assets = Liabilities + Equity
        const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

        return {
          asOfDate: date,
          assets: {
            current: currentAssets,
            nonCurrent: nonCurrentAssets,
            total: totalAssets,
          },
          liabilities: {
            current: currentLiabilities,
            nonCurrent: nonCurrentLiabilities,
            total: totalLiabilities,
          },
          equity: {
            accounts: allEquityBalances,
            total: totalEquity,
          },
          balanced,
        };
      },

      getIncomeStatement: (startDate, endDate) => {
        const end = endDate || new Date();
        const start = startDate || new Date(end.getFullYear(), end.getMonth(), 1); // Default to current month

        // Get all journal entries in the period (inclusive of start and end dates)
        const relevantEntries = get().journalEntries.filter(je => {
          const jeDate = new Date(je.date);
          // Include entries on start and end dates
          return jeDate >= start && jeDate <= end && !je.isReversed;
        });

        const accounts = get().accounts;

        // Calculate revenue - sum of all credits minus debits for revenue accounts in the period
        const revenueAccounts = accounts.filter(a => a.type === AccountType.Revenue && a.isActive);
        const revenue = revenueAccounts.map(acc => {
          let amount = 0;
          relevantEntries.forEach(je => {
            je.entries.forEach(e => {
              if (e.accountId === acc.id) {
                // Revenue accounts: credits increase revenue, debits decrease (e.g., refunds)
                amount += e.credit - e.debit;
              }
            });
          });
          return { account: acc, amount: Math.max(0, amount) }; // Revenue should not be negative
        }).filter(item => item.amount > 0); // Only show accounts with positive revenue

        const totalRevenue = revenue.reduce((sum, item) => sum + item.amount, 0);

        // Calculate COGS - sum of all debits minus credits for COGS accounts in the period
        const cogsAccounts = accounts.filter(a => a.type === AccountType.COGS && a.isActive);
        const cogs = cogsAccounts.map(acc => {
          let amount = 0;
          relevantEntries.forEach(je => {
            je.entries.forEach(e => {
              if (e.accountId === acc.id) {
                // COGS accounts: debits increase COGS, credits decrease
                amount += e.debit - e.credit;
              }
            });
          });
          return { account: acc, amount: Math.max(0, amount) }; // COGS should not be negative
        }).filter(item => item.amount > 0); // Only show accounts with COGS

        const totalCOGS = cogs.reduce((sum, item) => sum + item.amount, 0);

        // Calculate gross profit
        const grossProfit = totalRevenue - totalCOGS;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // Calculate expenses - sum of all debits minus credits for expense accounts in the period
        const expenseAccounts = accounts.filter(a => a.type === AccountType.Expense && a.isActive);
        const expenses = expenseAccounts.map(acc => {
          let amount = 0;
          relevantEntries.forEach(je => {
            je.entries.forEach(e => {
              if (e.accountId === acc.id) {
                // Expense accounts: debits increase expenses, credits decrease (e.g., reversals)
                amount += e.debit - e.credit;
              }
            });
          });
          return { account: acc, amount: Math.max(0, amount) }; // Expenses should not be negative
        }).filter(item => item.amount > 0); // Only show accounts with expenses

        const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);

        // Calculate net income
        const netIncome = grossProfit - totalExpenses;
        const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

        return {
          startDate: start,
          endDate: end,
          revenue: {
            accounts: revenue,
            total: totalRevenue,
          },
          cogs: {
            accounts: cogs,
            total: totalCOGS,
          },
          grossProfit,
          grossMargin,
          expenses: {
            accounts: expenses,
            total: totalExpenses,
          },
          netIncome,
          netMargin,
        };
      },

      getCashFlowStatement: (startDate, endDate) => {
        const end = endDate || new Date();
        const start = startDate || new Date(end.getFullYear(), end.getMonth(), 1);

        // Get income statement data
        const incomeStatement = get().getIncomeStatement(start, end);

        // Get cash accounts
        const cashAccount = get().getAccountByCode('1-101');
        const bankAccount = get().getAccountByCode('1-102');

        let beginningCash = 0;
        let endingCash = 0;

        if (cashAccount) {
          const startOfPeriod = new Date(start);
          startOfPeriod.setDate(startOfPeriod.getDate() - 1);
          beginningCash += get().getAccountBalance(cashAccount.id, startOfPeriod);
          endingCash += get().getAccountBalance(cashAccount.id, end);
        }

        if (bankAccount) {
          const startOfPeriod = new Date(start);
          startOfPeriod.setDate(startOfPeriod.getDate() - 1);
          beginningCash += get().getAccountBalance(bankAccount.id, startOfPeriod);
          endingCash += get().getAccountBalance(bankAccount.id, end);
        }

        // Simplified cash flow calculation
        // Operating activities
        const operatingAdjustments: Array<{ description: string; amount: number }> = [];

        // Get inventory change
        const inventoryAccount = get().getAccountByCode('1-201');
        if (inventoryAccount) {
          const startOfPeriod = new Date(start);
          startOfPeriod.setDate(startOfPeriod.getDate() - 1);
          const startInventory = get().getAccountBalance(inventoryAccount.id, startOfPeriod);
          const endInventory = get().getAccountBalance(inventoryAccount.id, end);
          const inventoryChange = endInventory - startInventory;
          if (inventoryChange !== 0) {
            operatingAdjustments.push({
              description: 'تغییرات موجودی کالا',
              amount: -inventoryChange, // Increase in inventory uses cash
            });
          }
        }

        // Get AP change
        const apAccount = get().getAccountByCode('2-101');
        if (apAccount) {
          const startOfPeriod = new Date(start);
          startOfPeriod.setDate(startOfPeriod.getDate() - 1);
          const startAP = get().getAccountBalance(apAccount.id, startOfPeriod);
          const endAP = get().getAccountBalance(apAccount.id, end);
          const apChange = endAP - startAP;
          if (apChange !== 0) {
            operatingAdjustments.push({
              description: 'تغییرات حساب‌های پرداختنی',
              amount: apChange, // Increase in AP provides cash
            });
          }
        }

        const totalOperatingAdjustments = operatingAdjustments.reduce((sum, adj) => sum + adj.amount, 0);
        const netCashFromOperating = incomeStatement.netIncome + totalOperatingAdjustments;

        // Investing and financing activities (minimal for now)
        const investingItems: Array<{ description: string; amount: number }> = [];
        const financingItems: Array<{ description: string; amount: number }> = [];

        const netCashFromInvesting = investingItems.reduce((sum, item) => sum + item.amount, 0);
        const netCashFromFinancing = financingItems.reduce((sum, item) => sum + item.amount, 0);

        const netCashFlow = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;

        return {
          startDate: start,
          endDate: end,
          operatingActivities: {
            netIncome: incomeStatement.netIncome,
            adjustments: operatingAdjustments,
            total: netCashFromOperating,
          },
          investingActivities: {
            items: investingItems,
            total: netCashFromInvesting,
          },
          financingActivities: {
            items: financingItems,
            total: netCashFromFinancing,
          },
          netCashFlow,
          beginningCash,
          endingCash,
        };
      },

      // ========== TAX REPORTS (PHASE 3) ==========
      getTaxReport: (startDate, endDate) => {
        const end = endDate || new Date();
        const start = startDate || new Date(end.getFullYear(), end.getMonth(), 1);

        const transactions = get().sellTransactions.filter(t => {
          const transDate = new Date(t.date);
          return transDate >= start && transDate <= end && !t.isRefund;
        });

        let taxableRevenue = 0;
        let nonTaxableRevenue = 0;
        let taxCollected = 0;
        const taxTransactions: TaxReportData['transactions'] = [];

        transactions.forEach(trans => {
          const transTaxAmount = trans.taxAmount || 0;
          const transSubtotal = trans.subtotal || trans.totalAmount;

          if (transTaxAmount > 0) {
            taxableRevenue += transSubtotal;
            taxCollected += transTaxAmount;
            taxTransactions.push({
              id: trans.id,
              date: trans.date,
              receiptNumber: trans.receiptNumber,
              amount: transSubtotal,
              taxAmount: transTaxAmount,
              taxRate: transSubtotal > 0 ? transTaxAmount / transSubtotal : 0,
            });
          } else {
            nonTaxableRevenue += transSubtotal;
          }
        });

        const totalRevenue = taxableRevenue + nonTaxableRevenue;
        const averageTaxRate = taxableRevenue > 0 ? taxCollected / taxableRevenue : 0;

        return {
          startDate: start,
          endDate: end,
          taxableRevenue,
          nonTaxableRevenue,
          totalRevenue,
          taxCollected,
          taxRate: averageTaxRate,
          transactions: taxTransactions,
        };
      },

      // ========== CUSTOMER & INVOICE FUNCTIONS (PHASE 4) ==========

      addCustomer: (customerData) => {
        const newCustomer: Customer = {
          ...customerData,
          id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          balance: 0,
          isActive: customerData.isActive ?? true,
        };
        set(state => ({ customers: [...state.customers, newCustomer] }));
        debouncedSaveData(get);
        return newCustomer.id;
      },

      updateCustomer: (customerId, updates) => {
        set(state => ({
          customers: state.customers.map(c =>
            c.id === customerId ? { ...c, ...updates } : c
          )
        }));
        debouncedSaveData(get);
      },

      deleteCustomer: (customerId) => {
        // Check if customer has outstanding invoices
        const hasInvoices = get().invoices.some(inv =>
          inv.customerId === customerId && inv.status !== InvoiceStatus.Paid && inv.status !== InvoiceStatus.Cancelled
        );
        if (hasInvoices) {
          throw new Error('Cannot delete customer with outstanding invoices');
        }
        set(state => ({ customers: state.customers.filter(c => c.id !== customerId) }));
        debouncedSaveData(get);
      },

      getCustomerById: (customerId) => {
        return get().customers.find(c => c.id === customerId);
      },

      getCustomerBalance: (customerId) => {
        const customer = get().getCustomerById(customerId);
        if (!customer) return 0;

        // Calculate from unpaid invoices
        const invoices = get().invoices.filter(inv =>
          inv.customerId === customerId &&
          inv.type === InvoiceType.Sale &&
          inv.status !== InvoiceStatus.Paid &&
          inv.status !== InvoiceStatus.Cancelled
        );

        return invoices.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);
      },

      createInvoice: (invoiceData) => {
        const newInvoice: Invoice = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          paidAmount: 0,
          status: InvoiceStatus.Draft,
          ...invoiceData,
        };
        set(state => ({ invoices: [...state.invoices, newInvoice] }));
        debouncedSaveData(get);

        // Create journal entry if not draft
        if (newInvoice.status !== InvoiceStatus.Draft) {
          get()._createInvoiceJournalEntry(newInvoice);
        }

        return newInvoice.id;
      },

      updateInvoice: (invoiceId, updates) => {
        set(state => ({
          invoices: state.invoices.map(inv =>
            inv.id === invoiceId ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
          )
        }));
        debouncedSaveData(get);
      },

      deleteInvoice: (invoiceId) => {
        const invoice = get().getInvoiceById(invoiceId);
        if (invoice && invoice.paidAmount > 0) {
          throw new Error('Cannot delete invoice with payments');
        }
        set(state => ({ invoices: state.invoices.filter(inv => inv.id !== invoiceId) }));
        debouncedSaveData(get);
      },

      getInvoiceById: (invoiceId) => {
        return get().invoices.find(inv => inv.id === invoiceId);
      },

      getInvoicesByCustomer: (customerId) => {
        return get().invoices.filter(inv => inv.customerId === customerId);
      },

      getInvoicesByVendor: (vendorId) => {
        return get().invoices.filter(inv => inv.vendorId === vendorId);
      },

      getOverdueInvoices: (type) => {
        const now = new Date();
        return get().invoices.filter(inv => {
          if (type === 'receivable' && inv.type !== InvoiceType.Sale) return false;
          if (type === 'payable' && inv.type !== InvoiceType.Purchase) return false;
          if (inv.status === InvoiceStatus.Paid || inv.status === InvoiceStatus.Cancelled) return false;

          const dueDate = new Date(inv.dueDate);
          return dueDate < now;
        });
      },

      recordPayment: (paymentData) => {
        const invoice = get().getInvoiceById(paymentData.invoiceId);
        if (!invoice) {
          throw new Error('Invoice not found');
        }

        const newPayment: Payment = {
          id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          ...paymentData,
        };

        // Update invoice
        const newPaidAmount = invoice.paidAmount + paymentData.amount;
        let newStatus = invoice.status;

        if (newPaidAmount >= invoice.totalAmount) {
          newStatus = InvoiceStatus.Paid;
        } else if (newPaidAmount > 0) {
          newStatus = InvoiceStatus.PartiallyPaid;
        }

        get().updateInvoice(invoice.id, {
          paidAmount: newPaidAmount,
          status: newStatus,
        });

        set(state => ({ payments: [...state.payments, newPayment] }));
        debouncedSaveData(get);

        // Create journal entry for payment
        get()._createPaymentJournalEntry(newPayment, invoice);

        return newPayment.id;
      },

      getPaymentsByInvoice: (invoiceId) => {
        return get().payments.filter(p => p.invoiceId === invoiceId);
      },

      getAgingReport: (type, asOfDate) => {
        const asOf = asOfDate || new Date();
        const invoices = get().invoices.filter(inv => {
          if (type === 'receivable' && inv.type !== InvoiceType.Sale) return false;
          if (type === 'payable' && inv.type !== InvoiceType.Purchase) return false;
          if (inv.status === InvoiceStatus.Paid || inv.status === InvoiceStatus.Cancelled) return false;

          const invDate = new Date(inv.issueDate);
          return invDate <= asOf;
        });

        const current: AgingBucket = { period: '0-30 days', amount: 0, count: 0 };
        const days31to60: AgingBucket = { period: '31-60 days', amount: 0, count: 0 };
        const days61to90: AgingBucket = { period: '61-90 days', amount: 0, count: 0 };
        const over90: AgingBucket = { period: 'Over 90 days', amount: 0, count: 0 };

        const details: AgingReportData['details'] = [];

        invoices.forEach(inv => {
          const dueDate = new Date(inv.dueDate);
          const daysOverdue = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          const outstanding = inv.totalAmount - inv.paidAmount;

          let name = '';
          if (inv.customerId) {
            const customer = get().getCustomerById(inv.customerId);
            name = customer?.name || 'Unknown Customer';
          } else if (inv.vendorId) {
            const vendor = get().vendors.find(v => v.id === inv.vendorId);
            name = vendor?.name || 'Unknown Vendor';
          }

          details.push({
            id: inv.id,
            name,
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.issueDate,
            dueDate: inv.dueDate,
            amount: outstanding,
            daysOverdue,
          });

          // Only count invoices that are actually due (daysOverdue >= 0)
          // Invoices with negative daysOverdue are not yet due and should be excluded
          if (daysOverdue < 0) {
            // Not yet due - exclude from aging report
            return;
          } else if (daysOverdue <= 30) {
            current.amount += outstanding;
            current.count++;
          } else if (daysOverdue <= 60) {
            days31to60.amount += outstanding;
            days31to60.count++;
          } else if (daysOverdue <= 90) {
            days61to90.amount += outstanding;
            days61to90.count++;
          } else {
            // daysOverdue > 90
            over90.amount += outstanding;
            over90.count++;
          }
        });

        const total = current.amount + days31to60.amount + days61to90.amount + over90.amount;

        return {
          type,
          asOfDate: asOf,
          current,
          days31to60,
          days61to90,
          over90,
          total,
          details: details.sort((a, b) => b.daysOverdue - a.daysOverdue),
        };
      },

      // Internal helper functions for journal entries
      _createInvoiceJournalEntry: (invoice: Invoice) => {
        const entries: Array<{accountId: string, debit: number, credit: number, description?: string}> = [];

        if (invoice.type === InvoiceType.Sale) {
          // Accounts Receivable entry
          const arAccount = get().getAccountByCode('1-301'); // AR
          const revenueAccount = get().getAccountByCode('4-101'); // Revenue
          const taxPayableAccount = get().getAccountByCode('2-201'); // Tax Payable

          if (arAccount && revenueAccount) {
            entries.push({
              accountId: arAccount.id,
              debit: invoice.totalAmount,
              credit: 0,
              description: 'حساب‌های دریافتنی',
            });

            entries.push({
              accountId: revenueAccount.id,
              debit: 0,
              credit: invoice.subtotal,
              description: 'درآمد فروش',
            });

            if (invoice.taxAmount > 0 && taxPayableAccount) {
              entries.push({
                accountId: taxPayableAccount.id,
                debit: 0,
                credit: invoice.taxAmount,
                description: 'مالیات فروش',
              });
            }

            get().createJournalEntry({
              date: invoice.issueDate,
              description: `فاکتور فروش #${invoice.invoiceNumber}`,
              reference: invoice.id,
              referenceType: 'sale',
              entries,
              isAutomatic: true,
            });
          }
        } else if (invoice.type === InvoiceType.Purchase) {
          // Accounts Payable entry
          const apAccount = get().getAccountByCode('2-101'); // AP
          const expenseAccount = get().getAccountByCode('6-101'); // Expense or Inventory

          if (apAccount && expenseAccount) {
            entries.push({
              accountId: expenseAccount.id,
              debit: invoice.totalAmount,
              credit: 0,
              description: 'هزینه خرید',
            });

            entries.push({
              accountId: apAccount.id,
              debit: 0,
              credit: invoice.totalAmount,
              description: 'حساب‌های پرداختنی',
            });

            get().createJournalEntry({
              date: invoice.issueDate,
              description: `فاکتور خرید #${invoice.invoiceNumber}`,
              reference: invoice.id,
              referenceType: 'purchase',
              entries,
              isAutomatic: true,
            });
          }
        }
      },

      _createPaymentJournalEntry: (payment: Payment, invoice: Invoice) => {
        const entries: Array<{accountId: string, debit: number, credit: number, description?: string}> = [];

        // Determine cash/bank account
        const cashAccount = get().getAccountByCode('1-101');
        const bankAccount = get().getAccountByCode('1-102');
        const paymentAccount = payment.paymentMethod === PaymentMethod.Cash ? cashAccount : bankAccount;

        if (invoice.type === InvoiceType.Sale) {
          // Customer payment - reduce AR, increase Cash/Bank
          const arAccount = get().getAccountByCode('1-301');

          if (arAccount && paymentAccount) {
            entries.push({
              accountId: paymentAccount.id,
              debit: payment.amount,
              credit: 0,
              description: 'دریافت وجه',
            });

            entries.push({
              accountId: arAccount.id,
              debit: 0,
              credit: payment.amount,
              description: 'کاهش حساب دریافتنی',
            });

            get().createJournalEntry({
              date: payment.paymentDate,
              description: `دریافت وجه فاکتور #${invoice.invoiceNumber}`,
              reference: payment.id,
              referenceType: 'payment',
              entries,
              isAutomatic: true,
            });
          }
        } else if (invoice.type === InvoiceType.Purchase) {
          // Vendor payment - reduce AP, decrease Cash/Bank
          const apAccount = get().getAccountByCode('2-101');

          if (apAccount && paymentAccount) {
            entries.push({
              accountId: apAccount.id,
              debit: payment.amount,
              credit: 0,
              description: 'کاهش حساب پرداختنی',
            });

            entries.push({
              accountId: paymentAccount.id,
              debit: 0,
              credit: payment.amount,
              description: 'پرداخت وجه',
            });

            get().createJournalEntry({
              date: payment.paymentDate,
              description: `پرداخت وجه فاکتور #${invoice.invoiceNumber}`,
              reference: payment.id,
              referenceType: 'payment',
              entries,
              isAutomatic: true,
            });
          }
        }
      },

      // User Management
      addUser: (userData) => {
        const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const salt = crypto.getRandomValues(new Uint8Array(16)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        // Note: passwordHash must be provided or will be set to empty string (user should set password via updateUser)
        const passwordHash = userData.passwordHash || '';

        const newUser: User = {
          id: userId,
          username: userData.username,
          role: userData.role || 'cashier',
          passwordHash,
          salt,
        };

        set((state) => ({ users: [...state.users, newUser] }));
        return userId;
      },

      updateUser: (userId, updates) => {
        set((state) => ({
          users: state.users.map((user) =>
            user.id === userId ? { ...user, ...updates } : user
          ),
        }));
      },

      deleteUser: (userId) => {
        const currentUser = get().currentUser;
        if (currentUser?.id === userId) {
          // Don't allow deleting the currently logged-in user
          throw new Error('Cannot delete the currently logged-in user');
        }
        set((state) => ({
          users: state.users.filter((user) => user.id !== userId),
        }));
      },
}));
