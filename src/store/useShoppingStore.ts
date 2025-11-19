// src/store/useShoppingStore.ts

import { create } from 'zustand';
import { ShoppingList, ShoppingItem, CafeCategory, Vendor, OcrResult, Unit, ItemStatus, PaymentStatus, PaymentMethod, PendingPaymentItem, SmartSuggestion, SummaryData, RecentPurchaseItem, MasterItem, AuthSlice, ShoppingState, InflationData, InflationDetail, InflationPoint, POSItem, SellTransaction, Recipe, StockEntry, SellSummaryData, FinancialOverviewData, AuditLogEntry, Shift } from '../../shared/types.ts';
import { t } from '../../shared/translations.ts';
import { parseJalaliDate, toJalaliDateString, gregorianToJalali } from '../../shared/jalali.ts';
import { fetchData, saveData } from '../lib/api.ts';
import { defaultUsers } from '../config/auth.ts';
import { findFuzzyMatches, calculateSimilarity } from '../lib/fuzzyMatch.ts';

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

  // Category actions
  addCategory: (name: string) => void;
  addPOSCategory: (name: string) => void; // Add POS-specific category

  hydrateFromCloud: () => Promise<void>;

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
};

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

// --- Debounced save function ---
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedSaveData = (state: FullShoppingState) => {
    if (typeof window === 'undefined') {
        return;
    }
    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        const { currentUser, isHydrating } = state;
        // Do not save if no user or during initial hydration.
        if (!currentUser || isHydrating) {
            return;
        }

        const dataToSave = {
            lists: state.lists,
            customCategories: state.customCategories,
            vendors: state.vendors,
            categoryVendorMap: state.categoryVendorMap,
            itemInfoMap: state.itemInfoMap,
            posItems: state.posItems,
            posCategories: state.posCategories,
            sellTransactions: state.sellTransactions,
            recipes: state.recipes,
            stockEntries: state.stockEntries,
        };
        saveData(dataToSave).catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : "Auto-save failed";
            const errorDetails = err instanceof Error ? {
                message: errorMessage,
                name: err.name,
                stack: err.stack
            } : { message: errorMessage };

            console.error("Auto-save failed:", errorDetails);

            // Retry logic for transient network errors
            const isNetworkError = errorMessage.includes('Failed to fetch') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('NetworkError');

            if (isNetworkError) {
                // Retry once after 3 seconds for network errors
                setTimeout(() => {
                    console.log("Retrying auto-save after network error...");
                    saveData(dataToSave).catch((retryErr: unknown) => {
                        const retryMessage = retryErr instanceof Error ? retryErr.message : "Retry failed";
                        console.error("Auto-save retry also failed:", retryMessage);
                        // TODO: Consider showing a toast notification to the user here
                        // This would require passing a callback or using a global event system
                    });
                }, 3000);
            } else {
                // For non-network errors (validation, auth, etc.), log but don't retry
                console.error("Auto-save failed with non-retryable error:", errorMessage);
                // TODO: Show user notification for critical errors (auth failures, etc.)
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
        const user = get().users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
            return false;
        }

        try {
            const hashedInput = await hashPassword(password, user.salt);
            if (hashedInput === user.passwordHash) {
                set({ currentUser: user, isHydrating: true });
                return true;
            }
        } catch (error) {
            console.error("Login failed due to hashing error:", error);
        }

        return false;
      },
      logout: () => {
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
                      isHydrating: false,
                  };
                  set(hydratedState);
              } else {
                  set({ ...emptyState, isHydrating: false });
              }
          } catch (error) {
              console.error("Failed to hydrate from cloud:", error);
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
        debouncedSaveData(get());
        return newList.id;
      },

      updateList: (listId, updatedList) => {
        set((state) => ({
          lists: state.lists.map((list) => (list.id === listId ? updatedList : list)),
        }));
        debouncedSaveData(get());
      },

      deleteList: (listId) => {
        set((state) => ({ lists: state.lists.filter((list) => list.id !== listId) }));
        debouncedSaveData(get());
      },

      updateItem: (listId, itemId, updates) => {
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
        debouncedSaveData(get());
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
            unit,
            category,
            status: ItemStatus.Pending,
            estimatedPrice: latestInfo.pricePerUnit ? latestInfo.pricePerUnit * (latestInfo.lastAmount || 1) : undefined
        };

        get().updateList(listId, { ...list, items: [...list.items, newItem] });
        return true;
      },

      addOcrPurchase: (ocrResult, paymentMethod, paymentStatus, vendorName) => {
        const { date, items: ocrItems } = ocrResult;
        const vendorId = get().findOrCreateVendor(vendorName);

        const parsedDate = parseJalaliDate(date);
        if (!parsedDate) {
            console.error("Invalid OCR date, cannot create list:", date);
            return 'Invalid Date';
        }

        const targetListId = get().createList(parsedDate);
        const targetList = get().lists.find(l => l.id === targetListId)!;

        const baseTimestamp = Date.now();
        const newShoppingItems: ShoppingItem[] = ocrItems.map((item, index) => ({
            id: `item-${baseTimestamp}-${index}-${Math.random().toString(36).substr(2, 5)}`,
            name: item.name,
            amount: item.quantity,
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
        });

        const updatedList = { ...targetList, items: [...targetList.items, ...newShoppingItems] };
        get().updateList(targetListId, updatedList);

        return targetList.name;
      },

      addVendor: (vendorData) => {
        const newVendor: Vendor = {
            id: `vendor-${Date.now()}`,
            ...vendorData
        };
        set(state => ({ vendors: [...state.vendors, newVendor] }));
        debouncedSaveData(get());
        return newVendor.id;
      },

      updateVendor: (vendorId, updates) => {
        set(state => ({
            vendors: state.vendors.map(v => v.id === vendorId ? { ...v, ...updates } : v)
        }));
        debouncedSaveData(get());
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
        debouncedSaveData(get());
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
        debouncedSaveData(get());
      },

      addCategory: (name: string) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        set(state => {
          if (state.customCategories.includes(trimmed)) return {} as Partial<FullShoppingState>;
          return { customCategories: [...state.customCategories, trimmed] } as Partial<FullShoppingState>;
        });
        debouncedSaveData(get());
      },

      addPOSCategory: (name: string) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        set(state => {
          if (state.posCategories.includes(trimmed)) return {} as Partial<FullShoppingState>;
          return { posCategories: [...state.posCategories, trimmed] } as Partial<FullShoppingState>;
        });
        debouncedSaveData(get());
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
          debouncedSaveData(get());
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
            debouncedSaveData(get());
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

            currentStats.totalQuantity += item.purchasedAmount || 0;
            currentStats.totalSpend += item.paidPrice || 0;
            currentStats.purchaseCount++;

            if (item.purchaseDate >= currentStats.latestPurchaseDate) {
                currentStats.latestPurchaseDate = item.purchaseDate;
                currentStats.lastPricePerUnit = (item.paidPrice || 0) / (item.purchasedAmount || 1);
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
        // Try direct lookup first (for backward compatibility)
        const direct = get().itemInfoMap[name];
        if (direct) return direct;

        // Try composite keys (name-unit) for all units
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
                  return {
                      pricePerUnit: latest.paidPrice / latest.purchasedAmount,
                      vendorId: latest.vendorId,
                      lastAmount: latest.purchasedAmount
                  };
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
                      history.push({
                          date: list.createdAt,
                          pricePerUnit: item.paidPrice / item.purchasedAmount,
                      });
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
                      const pricePerUnit = item.paidPrice / item.purchasedAmount;
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
                      purchases.push({
                          date: listDate,
                          vendorId: item.vendorId,
                          vendorName: vendor?.name,
                          pricePerUnit: item.paidPrice / item.purchasedAmount,
                          amount: item.purchasedAmount,
                          totalPrice: item.paidPrice
                      });
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
                      purchases.push({
                          date: listDate,
                          itemName: item.name,
                          itemUnit: item.unit,
                          pricePerUnit: item.paidPrice / item.purchasedAmount,
                          amount: item.purchasedAmount,
                          totalPrice: item.paidPrice
                      });
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
            const pricePerUnit = item.paidPrice / item.purchasedAmount;
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
                    itemInflation.push({
                        name: nameAndUnit.split('-')[0],
                        startPrice: previousPrice,
                        endPrice: lastPrice,
                        changePercentage: ((lastPrice - previousPrice) / previousPrice) * 100,
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
            const pricePerUnit = item.paidPrice / item.purchasedAmount;

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
                    name: categoryName,
                    startPrice: avgStartPrice,
                    endPrice: avgEndPrice,
                    changePercentage: overallCategoryInflation,
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
                baseMonthPrices.set(itemKey, item.paidPrice! / item.purchasedAmount!);
            }
        });

        allPurchases.forEach(item => {
            const [jYear, jMonth] = gregorianToJalali(item.purchaseDate.getFullYear(), item.purchaseDate.getMonth() + 1, item.purchaseDate.getDate());
            const jalaliMonthKey = `${jYear}/${String(jMonth).padStart(2, '0')}`;
            const itemKey = `${item.name}-${item.unit}`;
            const basePrice = baseMonthPrices.get(itemKey);

            if (basePrice) {
                const currentPrice = item.paidPrice! / item.purchasedAmount!;
                const priceRatio = currentPrice / basePrice;
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
                    period: monthKey,
                    priceIndex: (data.weightedPriceSum / data.totalSpend) * 100,
                });
            }
        });
        priceIndexHistory.sort((a, b) => a.period.localeCompare(b.period));

        // --- Overall Change & Top Rises ---
        const overallChange = priceIndexHistory.length >= 2
            ? ((priceIndexHistory[priceIndexHistory.length - 1].priceIndex - priceIndexHistory[0].priceIndex) / priceIndexHistory[0].priceIndex) * 100
            : 0;

        const topItemRises = itemInflation.filter(i => i.changePercentage > 0).sort((a, b) => b.changePercentage - a.changePercentage).slice(0, 5);
        const topCategoryRises = categoryInflation.filter(c => c.changePercentage > 0).sort((a, b) => b.changePercentage - a.changePercentage).slice(0, 5);

        return {
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
        recipeBasedConsumption.forEach((data, key) => {
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

        const priorityRank: Record<SmartSuggestion['priority'], number> = { high: 0, medium: 1, low: 2 };
        return suggestions.sort((a, b) => {
          const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
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
                          ...item,
                          listId: list.id,
                          listName: list.name,
                          purchaseDate: list.createdAt,
                      });
                  }
              });
          });
          return pending.sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
      },
      getRecentPurchases: (count) => {
          const recent: RecentPurchaseItem[] = [];
          get().lists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .forEach(list => {
                  list.items.filter(item => item.status === ItemStatus.Bought)
                      .forEach(item => {
                          if (recent.length < count) {
                              recent.push({
                                  ...item,
                                  listId: list.id,
                                  purchaseDate: list.createdAt
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
            topCategory: null as { name: string, amount: number } | null,
            topVendor: null as { name: string, amount: number } | null,
        };

        const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        kpis.avgDailySpend = kpis.totalSpend / totalDays;

        const categorySpend = allPurchases.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + item.paidPrice!;
            return acc;
        }, {} as Record<string, number>);

        const topCat = Object.entries(categorySpend).sort((a,b) => b[1] - a[1])[0];
        if (topCat) kpis.topCategory = { name: topCat[0], amount: topCat[1] };

        const vendorMap = new Map(get().vendors.map(v => [v.id, v.name]));
        const vendorSpend = allPurchases.reduce((acc, item) => {
            if (item.vendorId) {
                const vendorName = vendorMap.get(item.vendorId) || "Unknown";
                acc[vendorName] = (acc[vendorName] || 0) + item.paidPrice!;
            }
            return acc;
        }, {} as Record<string, number>);

        const topVen = Object.entries(vendorSpend).sort((a,b) => b[1] - a[1])[0];
        if (topVen) kpis.topVendor = { name: topVen[0], amount: topVen[1] };

        // Chart Data
        const spendingOverTime: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const timeMap = new Map<string, number>();
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
             const key = toJalaliDateString(d.toISOString());
             timeMap.set(key, 0);
        }
        allPurchases.forEach(item => {
            const key = toJalaliDateString(item.purchaseDate.toISOString());
            timeMap.set(key, (timeMap.get(key) || 0) + item.paidPrice!);
        });
        spendingOverTime.labels = Array.from(timeMap.keys());
        spendingOverTime.data = Array.from(timeMap.values());

        const spendingByCategory: { labels: string[]; data: number[] } = { labels: [], data: [] };
        const sortedCategories = Object.entries(categorySpend).sort((a,b) => b[1] - a[1]);
        spendingByCategory.labels = sortedCategories.map(c => c[0]);
        spendingByCategory.data = sortedCategories.map(c => c[1]);

        return {
            kpis,
            charts: { spendingOverTime, spendingByCategory },
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
                sellTransactions?: unknown[];
                recipes?: unknown[];
                stockEntries?: Record<string, unknown>;
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
            console.error("Import failed:", errorMessage);
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
        debouncedSaveData(get());
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
        debouncedSaveData(get());
      },

      getActiveShift: () => {
        return get().shifts.find(s => s.isActive) || null;
      },

      getShiftTransactions: (shiftId) => {
        const shift = get().shifts.find(s => s.id === shiftId);
          if (!shift) return [];
          return get().sellTransactions.filter(t => shift.transactions.includes(t.id));
        },

      // ========== POS ITEMS ACTIONS ==========
      addPOSItem: (data) => {
        const newPOSItem: POSItem = {
          id: `pos-${Date.now()}`,
          ...data,
        };
        set(state => ({
          posItems: [...state.posItems, newPOSItem],
          ...addAuditLogEntry(state, 'item_created', {
            entityId: newPOSItem.id,
            entityName: newPOSItem.name,
            metadata: { category: newPOSItem.category, price: newPOSItem.sellPrice },
          }),
        }));
        debouncedSaveData(get());
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
              acc[key] = {
                old: (oldItem as any)?.[key],
                new: (updates as any)[key],
              };
              return acc;
            }, {} as Record<string, { old?: unknown; new?: unknown }>),
          }),
        }));
        debouncedSaveData(get());
      },

      deletePOSItem: (posItemId) => {
        set(state => ({ posItems: state.posItems.filter(item => item.id !== posItemId) }));
        debouncedSaveData(get());
      },

      getPOSItemsByCategory: (category) => {
        return get().posItems.filter(item => item.category === category);
      },

      getFrequentPOSItems: (limit) => {
        const itemSaleCount = new Map<string, number>();
        get().sellTransactions.forEach(transaction => {
          transaction.items.forEach(item => {
            itemSaleCount.set(item.posItemId, (itemSaleCount.get(item.posItemId) || 0) + item.quantity);
          });
        });

        return get().posItems
          .sort((a, b) => (itemSaleCount.get(b.id) || 0) - (itemSaleCount.get(a.id) || 0))
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
        debouncedSaveData(get());
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
              acc[key] = {
                old: (oldRecipe as any)?.[key],
                new: (updates as any)[key],
              };
              return acc;
            }, {} as Record<string, { old?: unknown; new?: unknown }>),
          }),
        }));
        debouncedSaveData(get());
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
        debouncedSaveData(get());
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
        newTransaction.items.forEach(item => {
          // If this is a recipe item, deduct ingredients
          const posItem = get().posItems.find(p => p.id === item.posItemId);
          if (posItem && posItem.recipeId) {
            const recipe = get().recipes.find(r => r.id === posItem.recipeId);
            if (recipe) {
              recipe.ingredients.forEach(ingredient => {
                get().updateStock(ingredient.itemName, ingredient.itemUnit, -(ingredient.requiredQuantity * item.quantity));
              });
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
        debouncedSaveData(get());
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
                acc[key] = {
                  old: (oldTransaction as any)?.[key],
                  new: (updates as any)[key],
                };
                return acc;
              }, {} as Record<string, { old?: unknown; new?: unknown }>),
            }),
          };
          return newState;
        });
        debouncedSaveData(get());
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
        debouncedSaveData(get());
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
        debouncedSaveData(get());
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
          kpis.totalRevenue += trans.totalAmount;
          trans.items.forEach(item => {
            const posItem = get().posItems.find(p => p.id === item.posItemId);
            if (posItem) {
              const existing = itemStats.get(item.posItemId) || { quantity: 0, revenue: 0, category: posItem.category };
              existing.quantity += item.quantity;
              existing.revenue += item.totalPrice;
              itemStats.set(item.posItemId, existing);

              categoryRevenue.set(posItem.category, (categoryRevenue.get(posItem.category) || 0) + item.totalPrice);
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
}));
