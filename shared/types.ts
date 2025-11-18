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
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
}


export interface ShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: Unit;
  status: ItemStatus;
  category: string;
  paidPrice?: number;
  purchasedAmount?: number;
  vendorId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  estimatedPrice?: number;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string; // Storing as ISO string for easier serialization
  items: ShoppingItem[];
}

export interface AggregatedShoppingItem {
  name: string;
  unit: Unit;
  category: string;
  vendorId?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  totalAmount: number;
  totalPrice: number;
  purchaseHistory: { date: Date, pricePerUnit: number }[];
}

export interface OcrParsedItem {
    name: string;
    quantity: number;
    price: number;
    unit?: Unit;
    suggestedCategory?: string;
}

export interface OcrResult {
  date: string; // Jalali date string YYYY/MM/DD
  items: OcrParsedItem[];
}


// shared/types.ts
export interface SmartSuggestion {
  name: string;
  unit: Unit;
  category: string;
  lastPurchaseDate: string;
  avgPurchaseCycleDays?: number; // <-- Now optional!
  reason: string;
  priority: 'high' | 'medium' | 'low';
}


export interface PendingPaymentItem extends ShoppingItem {
    listId: string;
    listName: string;
    purchaseDate: string;
}

export interface RecentPurchaseItem extends ShoppingItem {
    listId: string;
    purchaseDate: string;
}

export interface MasterItem {
  name: string;
  unit: Unit;
  category: string;
  lastPricePerUnit: number;
  totalQuantity: number;
  totalSpend: number;
  purchaseCount: number;
}


export interface SummaryData {
  kpis: {
    totalSpend: number;
    totalItems: number;
    avgDailySpend: number;
    topCategory: { name: string; amount: number } | null;
    topVendor: { name: string; amount: number } | null;
  };
  charts: {
    spendingOverTime: { labels: string[]; data: number[] };
    spendingByCategory: { labels: string[]; data: number[] };
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
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

export interface InflationPoint {
  period: string; // e.g., '1403/05'
  priceIndex: number; // 100 for baseline, 110 for 10% inflation etc.
}

export interface InflationDetail {
    name: string; // Item or Category name
    startPrice: number;
    endPrice: number;
    changePercentage: number;
}

export interface InflationData {
    overallChange: number;
    priceIndexHistory: InflationPoint[];
    topItemRises: InflationDetail[];
    topCategoryRises: InflationDetail[];
}

// ============================================
// SELL / POS TYPES
// ============================================

export interface POSItem {
  id: string;
  name: string;
  category: string;
  sellPrice: number; // Price per unit
  unit: Unit;
  isRecipe?: boolean; // If true, this item is sold via recipe, not raw item
  recipeId?: string; // Link to recipe if isRecipe=true
  customizations?: POSCustomization[]; // E.g., syrup options, size modifiers
  variants?: POSVariant[]; // Preset variants for fast POS entry
}

export interface POSCustomizationOption {
  id: string;
  label: string; // e.g., "8/20 Robusta", "20ml", "No syrup"
  price: number; // Price for this option
  isCustomAmount?: boolean; // If true, allows custom amount input
  unit?: string; // Unit for custom amount (e.g., "ml", "pump")
  pricePerUnit?: number; // Price per unit for custom amounts
}

export interface POSCustomization {
  id: string;
  name: string; // e.g., "Coffee Type", "Syrup"
  type: 'select' | 'number' | 'text';
  options?: POSCustomizationOption[]; // Options with individual prices
  priceModifier?: number; // Legacy: Additional cost for this customization (deprecated, use options instead)
}

export interface POSVariant {
  id: string;
  name: string; // e.g., "Single", "Double", "50ml Milk"
  priceModifier: number; // delta to base price (can be negative)
  presetCustomizations?: Record<string, string | number>; // e.g., { "Size": "Medium", "Syrup": "Vanilla" }
}

export interface SellTransaction {
  id: string;
  date: string; // ISO string
  items: SellTransactionItem[];
  totalAmount: number; // Revenue
  paymentMethod: PaymentMethod;
  notes?: string;
  discountAmount?: number;
}

export interface SellTransactionItem {
  id: string;
  posItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizationChoices?: Record<string, string | number>; // Customization selections
  costOfGoods?: number; // Calculated raw cost if from recipe
}

// ============================================
// RECIPE TYPES
// ============================================

export interface Recipe {
  id: string;
  name: string;
  category: string;
  baseSellPrice: number; // Base price, can be overridden per transaction
  ingredients: RecipeIngredient[];
  prepNotes?: string;
  createdAt: string; // ISO string
}

export interface RecipeIngredient {
  id: string;
  itemName: string; // Name of bought item
  itemUnit: Unit; // Unit of bought item
  requiredQuantity: number; // How much of this item is needed
  costPerUnit?: number; // Cached cost; recalculate on use
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
