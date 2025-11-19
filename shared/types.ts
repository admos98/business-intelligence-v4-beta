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

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  unit: Unit;
  quantity: number;
  category: string;
  status: ItemStatus;
  paidPrice?: number;
  paymentStatus: PaymentStatus;
  vendorId?: string;
  notes?: string;
  receiptImage?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string; // ISO string
  items: ShoppingItem[];
}

export interface OcrResult {
  items: Array<{
    name: string;
    unit: Unit;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
  }>;
  vendorName?: string;
  date?: string;
}

export interface PendingPaymentItem {
  itemName: string;
  unit: Unit;
  totalDue: number;
  vendorId?: string;
  vendorName?: string;
  listIds: string[];
}

export interface SmartSuggestion {
  name: string;
  unit: Unit;
  category: string;
  reason: string;
  score: number;
}

export interface RecentPurchaseItem {
  name: string;
  unit: Unit;
  lastPurchaseDate: Date;
  lastPricePerUnit: number;
  purchaseCount: number;
}

export interface MasterItem {
  name: string;
  unit: Unit;
  category: string;
  purchaseCount: number;
  lastPurchaseDate?: Date;
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
  unit: Unit;
  oldPrice: number;
  newPrice: number;
  percentageChange: number;
  daysBetween: number;
}

export interface InflationPoint {
  date: string; // ISO string
  averageInflation: number;
  itemCount: number;
}

export interface InflationData {
  averageInflation: number;
  totalItems: number;
  details: InflationDetail[];
  timeline: InflationPoint[];
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
}

export interface SellTransaction {
  id: string;
  date: string; // ISO string
  receiptNumber?: number; // Sequential receipt number
  items: SellTransactionItem[];
  totalAmount: number; // Revenue (negative for refunds)
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
