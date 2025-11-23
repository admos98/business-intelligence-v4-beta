export enum ItemStatus {
  Pending = 'PENDING',
  Bought = 'BOUGHT',
}

export enum Unit {
  Kg = 'کیلوگرم',
  Gram = 'گرم',
  Liter = 'لیتر',
  Ml = 'میلی‌لیتر',
  Piece = 'عدد',
  Pack = 'بسته',
  Box = 'جعبه',
  Bottle = 'بطری',
  Can = 'قوطی',
  Jar = 'شیشه',
  Dozen = 'دوجین',
  Sheet = 'برگ',
  Roll = 'رول',
  Bag = 'کیسه',
  Bunch = 'دسته',
  Carton = 'کارتن',
  Sachet = 'ساشه',
  Bar = 'قالب',
}

export enum CafeCategory {
    Dairy = 'لبنیات',
    Produce = 'میوه و سبزیجات',
    Bakery = 'نان و شیرینی',
    DryGoods = 'خشکبار و حبوبات',
    Meat = 'گوشت و مرغ',
    Beverages = 'نوشیدنی‌ها',
    Cleaning = 'لوازم بهداشتی و نظافتی',
    Other = 'متفرقه',
}

export enum PaymentStatus {
  Paid = 'پرداخت شده',
  Due = 'پرداخت نشده',
}

export enum PaymentMethod {
  Cash = 'نقد',
  Card = 'کارت',
  Transfer = 'انتقال بانکی',
  Staff = 'پرسنل',
}

// ============================================
// AUTH & STATE TYPES
// ============================================

export interface User {
  id?: string;
  username: string;
  role?: 'admin' | 'manager' | 'cashier';
  passwordHash?: string;
  salt?: string;
}

export interface AuthSlice {
  users: User[];
  currentUser: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export interface ShoppingState {
  isHydrating: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  unit: Unit;
  quantity: number;
  amount?: number; // Alias for quantity (backward compatibility)
  category: string;
  status: ItemStatus;
  paidPrice?: number;
  estimatedPrice?: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  vendorId?: string;
  notes?: string;
  receiptImage?: string;
  purchasedAmount?: number; // Total amount purchased (quantity * price)
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string; // ISO string
  items: ShoppingItem[];
}

export interface OcrParsedItem {
  name: string;
  unit: Unit;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  suggestedCategory?: string;
  price?: number;
}

export interface OcrResult {
  items: OcrParsedItem[];
  vendorName?: string;
  date?: string;
}

export interface AggregatedShoppingItem {
  name: string;
  unit: Unit;
  category: string;
  vendorId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  totalAmount: number;
  totalPrice: number;
  purchaseHistory: unknown[]; // Array of purchase history entries
}

export interface PendingPaymentItem {
  itemName: string;
  unit: Unit;
  totalDue: number;
  vendorId?: string;
  vendorName?: string;
  listIds: string[];
  purchaseDate?: Date | string; // Date or ISO string
}

export interface SmartSuggestion {
  name: string;
  unit: Unit;
  category: string;
  reason: string;
  score?: number;
  lastPurchaseDate?: Date | string; // Date or ISO string
  priority?: 'high' | 'medium' | 'low' | number;
  avgPurchaseCycleDays?: number;
}

export interface RecentPurchaseItem {
  name: string;
  unit: Unit;
  lastPurchaseDate: Date;
  lastPricePerUnit: number;
  purchaseCount: number;
  listId?: string;
}

export interface MasterItem {
  name: string;
  unit: Unit;
  category: string;
  purchaseCount: number;
  lastPurchaseDate?: Date;
  totalQuantity?: number;
  totalSpend?: number;
  lastPricePerUnit?: number;
}

export interface SummaryData {
  kpis: {
    totalSpend: number;
    totalItems: number;
    avgDailySpend: number;
    topCategory: { name: string; spend: number } | null;
    topVendor: { name: string; spend: number } | null;
  };
  charts: {
    spendOverTime: { labels: string[]; data: number[] };
    spendByCategory: { labels: string[]; data: number[] };
    spendByVendor: { labels: string[]; data: number[] };
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface InflationDetail {
  itemName: string;
  name?: string; // Alias for itemName
  unit: Unit;
  oldPrice: number;
  newPrice: number;
  startPrice?: number; // Alias for oldPrice
  endPrice?: number; // Alias for newPrice
  percentageChange: number;
  changePercentage?: number; // Alias for percentageChange
  daysBetween: number;
}

export interface InflationPoint {
  date: string; // ISO string
  period?: string; // Period label
  averageInflation: number;
  priceIndex?: number;
  itemCount: number;
}

export interface InflationData {
  averageInflation: number;
  totalItems: number;
  details: InflationDetail[];
  timeline: InflationPoint[];
  overallChange?: number;
  priceIndexHistory?: InflationPoint[];
  topItemRises?: InflationDetail[];
  topCategoryRises?: InflationDetail[];
}

// ============================================
// POS / SELL TYPES
// ============================================

export interface POSItem {
  id: string;
  name: string;
  category: string;
  sellPrice: number;
  recipeId?: string; // Link to recipe if this item is made from ingredients
  isTaxable?: boolean; // Whether this item is subject to tax (Phase 3)
  taxRateId?: string; // Specific tax rate for this item (Phase 3)
  variants?: Array<{
    id: string;
    name: string;
    type: 'text' | 'number' | 'choice';
    required?: boolean;
    options?: Array<{
      id: string;
      name: string;
      label?: string; // Display label (falls back to name)
      priceModifier?: number; // Legacy: price modifier
      price?: number; // Fixed price for this option
      isCustomAmount?: boolean; // If true, price is calculated per unit
      unit?: string; // Unit for custom amount (e.g., "گرم", "عدد")
      pricePerUnit?: number; // Price per unit for custom amount
    }>;
    unit?: string; // For number type (e.g., "گرم", "عدد")
    pricePerUnit?: number; // For number type
    priceModifier?: number; // For legacy number/text variants
  }>;
  customizations?: Array<{
    id: string;
    name: string;
    type: 'text' | 'number' | 'choice';
    required?: boolean;
    options?: Array<{
      id: string;
      name: string;
      label?: string; // Display label (falls back to name)
      priceModifier?: number; // Legacy: price modifier
      price?: number; // Fixed price for this option
      isCustomAmount?: boolean; // If true, price is calculated per unit
      unit?: string; // Unit for custom amount (e.g., "گرم", "عدد")
      pricePerUnit?: number; // Price per unit for custom amount
    }>;
    unit?: string; // For number type (e.g., "گرم", "عدد")
    pricePerUnit?: number; // For number type
    priceModifier?: number; // For legacy number/text customizations
  }>;
}

export interface SellTransactionItem {
  id: string;
  posItemId: string;
  name: string; // Full name including variant and customizations
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizationChoices?: Record<string, string | number | { optionId: string; amount: number }>;
  costOfGoods?: number; // COGS if linked to recipe
  taxAmount?: number; // Tax amount for this item (Phase 3)
  taxRate?: number; // Tax rate applied (Phase 3)
  isTaxable?: boolean; // Whether tax was applied (Phase 3)
}

export interface SellTransaction {
  id: string;
  date: string; // ISO string
  receiptNumber?: number; // Sequential receipt number
  items: SellTransactionItem[];
  subtotal?: number; // Subtotal before tax (Phase 3)
  taxAmount?: number; // Total tax amount (Phase 3)
  totalAmount: number; // Revenue (negative for refunds) - includes tax if applicable
  paymentMethod: PaymentMethod; // Primary payment method (for backwards compatibility)
  splitPayments?: Array<{ method: PaymentMethod; amount: number }>; // Split payment amounts
  notes?: string;
  discountAmount?: number;
  isRefund?: boolean; // True if this is a refund/return
  originalTransactionId?: string; // Link to original transaction if this is a refund
  status?: 'draft' | 'completed'; // Draft (ongoing) or completed receipt
}

// ============================================
// RECIPE TYPES
// ============================================

export interface RecipeIngredient {
  id: string;
  itemName: string; // Name of bought item
  itemUnit: Unit; // Unit of bought item
  requiredQuantity: number; // How much of this item is needed
  costPerUnit?: number; // Cached cost; recalculate on use
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  baseSellPrice: number; // Selling price for this recipe/item
  ingredients: RecipeIngredient[];
  prepNotes?: string;
  createdAt: string; // ISO string
}

// ============================================
// STOCK TYPES
// ============================================

export interface StockEntry {
  itemName: string;
  itemUnit: Unit;
  quantity: number; // Current available quantity
  lastUpdated: string; // ISO string
}

// ============================================
// ENHANCED SELL ANALYTICS TYPES
// ============================================

export interface SellSummaryData {
  kpis: {
    totalRevenue: number;
    totalTransactions: number;
    avgTransactionValue: number;
    topItem: { name: string; quantity: number; revenue: number } | null;
    topCategory: { name: string; revenue: number } | null;
  };
  charts: {
    revenueOverTime: { labels: string[]; data: number[] };
    revenueByCategory: { labels: string[]; data: number[] };
    itemPopularity: { labels: string[]; data: number[] }; // By quantity sold
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface FinancialOverviewData {
  buy: {
    totalSpend: number;
    itemCount: number;
    avgDailySpend: number;
  };
  sell: {
    totalRevenue: number;
    transactionCount: number;
    avgTransactionValue: number;
  };
  recipes: {
    totalCostOfGoods: number; // Sum of all recipe ingredient costs sold
  };
  profitAnalysis: {
    grossProfit: number; // Revenue - Cost of Goods Sold (COGS)
    grossMargin: number; // Gross Profit / Revenue * 100
    netProfit: number; // Gross Profit - Other Expenses (simplified: just COGS for now)
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  action: 'transaction_created' | 'transaction_updated' | 'transaction_deleted' |
          'item_created' | 'item_updated' | 'item_deleted' |
          'refund_created' | 'stock_updated' | 'recipe_created' | 'recipe_updated' | 'recipe_deleted';
  userId?: string;
  details: {
    entityId?: string;
    entityName?: string;
    changes?: Record<string, { old?: unknown; new?: unknown }>;
    metadata?: Record<string, unknown>;
  };
}

// ============================================
// SHIFT MANAGEMENT TYPES
// ============================================

export interface Shift {
  id: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  startingCash: number; // Cash in drawer at shift start
  endingCash?: number; // Cash in drawer at shift end
  expectedCash?: number; // Calculated expected cash based on transactions
  difference?: number; // endingCash - expectedCash (variance)
  notes?: string;
  isActive: boolean;
  transactions: string[]; // Transaction IDs for this shift
}

// ============================================
// ACCOUNTING TYPES (PHASE 1)
// ============================================

export enum AccountType {
  Asset = 'دارایی',
  Liability = 'بدهی',
  Equity = 'حقوق صاحبان سهام',
  Revenue = 'درآمد',
  Expense = 'هزینه',
  COGS = 'بهای تمام شده'
}

export interface Account {
  id: string;
  code: string; // e.g., "1-101" for Cash
  name: string; // e.g., "صندوق"
  nameEn?: string; // "Cash" for reference
  type: AccountType;
  parentId?: string; // For sub-accounts
  balance: number; // Current balance
  isActive: boolean;
  description?: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO string
  description: string;
  reference?: string; // Link to transaction/sale/purchase ID
  referenceType?: 'sale' | 'purchase' | 'payment' | 'adjustment' | 'manual';
  entries: Array<{
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
  }>;
  isAutomatic: boolean; // True if generated automatically
  createdBy?: string;
  createdAt: string;
  isReversed?: boolean; // For corrections
  reversalOf?: string; // ID of journal entry being reversed
}

export interface GeneralLedgerEntry {
  account: Account;
  entries: Array<{
    date: string;
    description: string;
    reference?: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  openingBalance: number;
  closingBalance: number;
}

export interface TrialBalanceEntry {
  account: Account;
  debit: number;
  credit: number;
  balance: number;
}

// ============================================
// FINANCIAL STATEMENTS TYPES (PHASE 2)
// ============================================

export interface BalanceSheetData {
  asOfDate: Date;
  assets: {
    current: Array<{ account: Account; amount: number }>;
    nonCurrent: Array<{ account: Account; amount: number }>;
    total: number;
  };
  liabilities: {
    current: Array<{ account: Account; amount: number }>;
    nonCurrent: Array<{ account: Account; amount: number }>;
    total: number;
  };
  equity: {
    accounts: Array<{ account: Account; amount: number }>;
    total: number;
  };
  balanced: boolean;
}

export interface IncomeStatementData {
  startDate: Date;
  endDate: Date;
  revenue: {
    accounts: Array<{ account: Account; amount: number }>;
    total: number;
  };
  cogs: {
    accounts: Array<{ account: Account; amount: number }>;
    total: number;
  };
  grossProfit: number;
  grossMargin: number;
  expenses: {
    accounts: Array<{ account: Account; amount: number }>;
    total: number;
  };
  netIncome: number;
  netMargin: number;
}

export interface CashFlowStatementData {
  startDate: Date;
  endDate: Date;
  operatingActivities: {
    netIncome: number;
    adjustments: Array<{ description: string; amount: number }>;
    total: number;
  };
  investingActivities: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  financingActivities: {
    items: Array<{ description: string; amount: number }>;
    total: number;
  };
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

// ============================================
// TAX MANAGEMENT TYPES (PHASE 3)
// ============================================

export interface TaxRate {
  id: string;
  name: string; // e.g., "مالیات بر ارزش افزوده 9%"
  nameEn?: string; // "VAT 9%"
  rate: number; // e.g., 0.09 for 9%
  isActive: boolean;
  accountId: string; // Link to Tax Payable account
  description?: string;
  createdAt: string;
}

export interface TaxSettings {
  enabled: boolean; // Global tax enable/disable
  defaultTaxRateId?: string; // Default tax rate to apply
  includeTaxInPrice: boolean; // Tax-inclusive vs tax-exclusive pricing
  showTaxOnReceipts: boolean; // Show tax breakdown on receipts
}

export interface TaxReportData {
  startDate: Date;
  endDate: Date;
  taxableRevenue: number;
  nonTaxableRevenue: number;
  totalRevenue: number;
  taxCollected: number;
  taxRate: number;
  transactions: Array<{
    id: string;
    date: string;
    receiptNumber?: number;
    amount: number;
    taxAmount: number;
    taxRate: number;
  }>;
}

// ============================================
// CUSTOMER & ACCOUNTS RECEIVABLE TYPES (PHASE 4)
// ============================================

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string; // Tax identification number
  creditLimit?: number;
  paymentTerms?: number; // Payment terms in days (e.g., Net 30)
  balance: number; // Current outstanding balance
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export enum InvoiceStatus {
  Draft = 'پیش‌نویس',
  Sent = 'ارسال شده',
  Paid = 'پرداخت شده',
  PartiallyPaid = 'پرداخت جزئی',
  Overdue = 'معوق',
  Cancelled = 'لغو شده'
}

export enum InvoiceType {
  Sale = 'فروش', // Accounts Receivable
  Purchase = 'خرید', // Accounts Payable
  Expense = 'هزینه'
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  customerId?: string; // For sales invoices (AR)
  vendorId?: string; // For purchase invoices (AP)
  issueDate: string;
  dueDate: string;
  items: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  reference?: string; // Link to transaction or purchase
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface AgingBucket {
  period: string; // e.g., "0-30 days", "31-60 days"
  amount: number;
  count: number;
}

export interface AgingReportData {
  type: 'receivable' | 'payable';
  asOfDate: Date;
  current: AgingBucket; // 0-30 days
  days31to60: AgingBucket;
  days61to90: AgingBucket;
  over90: AgingBucket;
  total: number;
  details: Array<{
    id: string;
    name: string; // Customer or Vendor name
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    daysOverdue: number;
  }>;
}

// ============================================
// BUDGETING TYPES (PHASE 6)
// ============================================

export interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'closed';
  items: BudgetItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetItem {
  id: string;
  accountId: string;
  accountName: string;
  budgetedAmount: number;
  actualAmount?: number;
  variance?: number;
  variancePercent?: number;
}

export interface BudgetVarianceReport {
  budgetId: string;
  budgetName: string;
  period: { start: Date; end: Date };
  items: Array<{
    accountName: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercent: number;
    status: 'over' | 'under' | 'on-track';
  }>;
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
}

// ============================================
// MULTI-CURRENCY TYPES (PHASE 7)
// ============================================

export interface Currency {
  code: string; // ISO code like "USD", "EUR", "IRR"
  name: string;
  symbol: string;
  isBaseCurrency: boolean;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveDate: string;
  createdAt: string;
}

// ============================================
// ADVANCED REPORTING (PHASE 8)
// ============================================

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  reportType: 'custom' | 'pivot' | 'chart';
  filters: Record<string, unknown>;
  columns: string[];
  sortBy?: string;
  groupBy?: string;
  createdAt: string;
  updatedAt: string;
}
