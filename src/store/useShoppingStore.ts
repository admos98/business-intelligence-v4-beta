// src/store/useShoppingStore.ts

import { create } from 'zustand';
// FIX: Removed unused 'User' type
import { ShoppingList, ShoppingItem, CafeCategory, Vendor, OcrResult, Unit, ItemStatus, PaymentStatus, PaymentMethod, PendingPaymentItem, SmartSuggestion, SummaryData, RecentPurchaseItem, MasterItem, AuthSlice, ShoppingState, InflationData, InflationDetail, InflationPoint } from '../../shared/types.ts';
import { t } from '../../shared/translations.ts';
import { parseJalaliDate, toJalaliDateString, gregorianToJalali } from '../../shared/jalali.ts';
// FIX: Added .ts extension to resolve module path ambiguity.
import { fetchData, saveData } from '../lib/api.ts';

type SummaryPeriod = '7d' | '30d' | 'mtd' | 'ytd' | 'all';

interface FullShoppingState extends AuthSlice, ShoppingState {
  lists: ShoppingList[];
  customCategories: string[];
  vendors: Vendor[];
  categoryVendorMap: Record<string, string>; // categoryName -> vendorId
  itemInfoMap: Record<string, { unit: Unit, category: string }>;

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


  // Computed
  allCategories: () => string[];
  getKnownItemNames: () => string[];
  getAllKnownItems: () => MasterItem[];
  getItemInfo: (name: string) => { unit: Unit, category: string } | undefined;
  getLatestPricePerUnit: (name: string, unit: Unit) => number | undefined;
  getLatestPurchaseInfo: (name: string, unit: Unit) => { pricePerUnit?: number, vendorId?: string, lastAmount?: number };
  getSmartSuggestions: () => SmartSuggestion[];
  getPendingPayments: () => PendingPaymentItem[];
  getRecentPurchases: (count: number) => RecentPurchaseItem[];
  getExpenseForecast: () => { daily: number, monthly: number } | null;
  getSummaryData: (period: SummaryPeriod) => SummaryData | null;
  getInflationData: (periodInDays: number) => InflationData | null;
  getItemPriceHistory: (name: string, unit: Unit) => { date: string, pricePerUnit: number }[];
  isItemInTodaysPendingList: (name: string, unit: Unit) => boolean;


  // Import/Export
  importData: (jsonData: string) => Promise<void>;
  exportData: () => string;
}

const DEFAULT_CATEGORIES: string[] = Object.values(CafeCategory);

const emptyState = {
  lists: [],
  customCategories: [],
  vendors: [],
  categoryVendorMap: {},
  itemInfoMap: {},
};

// --- Debounced save function ---
let debounceTimer: number;
const debouncedSaveData = (state: FullShoppingState) => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
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
        };
        // FIX: Explicitly typed 'err' as 'any' to resolve implicit 'any' error.
        saveData(dataToSave).catch((err: any) => console.error("Auto-save failed:", err));
    }, 1500); // Debounce for 1.5 seconds
};


export const useShoppingStore = create<FullShoppingState>((set, get) => ({
      isHydrating: false,
      ...emptyState,

      // Auth Slice
      users: [{ id: 'user-1', username: 'mehrnoosh', passwordHash: 'cafe' }],
      currentUser: null,
      login: (username, password) => {
        const user = get().users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === password);
        if (user) {
          set({ currentUser: user, isHydrating: true });
          return true;
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
                  set({ ...data, isHydrating: false });
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
            id: `item-${Date.now()}`,
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

        const newShoppingItems: ShoppingItem[] = ocrItems.map((item, index) => ({
            id: `item-${Date.now()}-${index}`,
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
        set(state => ({
            vendors: state.vendors.filter(v => v.id !== vendorId),
            lists: state.lists.map(list => ({
                ...list,
                items: list.items.map(item => item.vendorId === vendorId ? { ...item, vendorId: undefined } : item)
            }))
        }));
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
              if (originalName !== updates.name && newItemInfoMap[originalName]) {
                  delete newItemInfoMap[originalName];
              }
              newItemInfoMap[updates.name] = { unit: updates.unit, category: updates.category };

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
            stateUpdates.itemInfoMap = { ...get().itemInfoMap, [name.trim()]: { unit, category } };
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
        return get().itemInfoMap[name];
      },
      getLatestPricePerUnit: (name, unit) => {
        return get().getLatestPurchaseInfo(name, unit).pricePerUnit;
      },
      getLatestPurchaseInfo: (name, unit) => {
          const allPurchasesOfItem = get().lists
              .flatMap(list => list.items.map(item => ({ ...item, purchaseDate: new Date(list.createdAt) })))
              .filter(item => item.name === name && item.unit === unit && item.status === ItemStatus.Bought && item.paidPrice && item.purchasedAmount)
              .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime());

          if (allPurchasesOfItem.length > 0) {
              const latest = allPurchasesOfItem[0];
              return {
                  pricePerUnit: latest.paidPrice! / latest.purchasedAmount!,
                  vendorId: latest.vendorId,
                  lastAmount: latest.purchasedAmount
              };
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
            const key = `${item.name}-${item.unit}`;
            const pricePerUnit = item.paidPrice! / item.purchasedAmount!;
            if (!itemPrices.has(key)) {
                itemPrices.set(key, { prices: [], category: item.category });
            }
            itemPrices.get(key)!.prices.push({ date: item.purchaseDate, price: pricePerUnit });
        });

        const itemInflation: InflationDetail[] = [];
        itemPrices.forEach((data, nameAndUnit) => {
            if (data.prices.length >= 2) {
                const startPrice = data.prices[0].price;
                const endPrice = data.prices[data.prices.length - 1].price;
                if (startPrice > 0) {
                    itemInflation.push({
                        name: nameAndUnit.split('-')[0],
                        startPrice,
                        endPrice,
                        changePercentage: ((endPrice - startPrice) / startPrice) * 100,
                    });
                }
            }
        });

        // --- Category Inflation (Corrected Logic) ---
        const categoryItemPrices = new Map<string, Map<string, { prices: { date: Date, price: number }[], totalSpend: number }>>();

        allPurchases.forEach(item => {
            const category = item.category;
            const itemKey = `${item.name}-${item.unit}`;
            const pricePerUnit = item.paidPrice! / item.purchasedAmount!;

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
                    const startPrice = itemData.prices[0].price;
                    const endPrice = itemData.prices[itemData.prices.length - 1].price;
                    const itemSpend = itemData.totalSpend;

                    if (startPrice > 0) {
                        const itemInflationPercentage = ((endPrice - startPrice) / startPrice);

                        weightedInflationSum += itemInflationPercentage * itemSpend;
                        totalSpendInCategory += itemSpend;

                        weightedStartPriceSum += startPrice * itemSpend;
                        weightedEndPriceSum += endPrice * itemSpend;
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
        const firstMonthKey = `${new Date(allPurchases[0].purchaseDate).getFullYear()}/${String(new Date(allPurchases[0].purchaseDate).getMonth() + 1).padStart(2, '0')}`;

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
        const allPurchases = get().lists
            .flatMap(list => list.items.map(item => ({...item, purchaseDate: new Date(list.createdAt)})))
            .filter(item => item.status === ItemStatus.Bought && item.purchasedAmount && item.purchasedAmount > 0)
            .sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());

        const itemHistory = new Map<string, {
            purchases: { date: Date, amount: number }[],
            name: string,
            unit: Unit,
            category: string
        }>();

        allPurchases.forEach(item => {
            const key = `${item.name}-${item.unit}`;
            if (!itemHistory.has(key)) {
                itemHistory.set(key, { purchases: [], name: item.name, unit: item.unit, category: item.category });
            }
            itemHistory.get(key)!.purchases.push({ date: item.purchaseDate, amount: item.purchasedAmount! });
        });

        const suggestions: SmartSuggestion[] = [];
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        const oneDay = 24 * 60 * 60 * 1000;
        const REORDER_BUFFER_DAYS = 3; // Suggest reordering when stock is below 3 days' worth of supply.

        itemHistory.forEach((history) => {
            // We need at least two purchases to calculate a meaningful consumption rate.
            if (history.purchases.length < 2) return;

            const firstPurchase = history.purchases[0];
            const lastPurchase = history.purchases[history.purchases.length - 1];

            const totalQuantityPurchased = history.purchases.reduce((sum, p) => sum + p.amount, 0);
            // Ensure the duration is at least 1 day to avoid division by zero and get a rate for items bought frequently.
            const totalDurationDays = Math.max(1, Math.round((lastPurchase.date.getTime() - firstPurchase.date.getTime()) / oneDay));

            const dailyConsumptionRate = totalQuantityPurchased / totalDurationDays;

            // If the consumption rate is zero, we can't make a prediction.
            if (dailyConsumptionRate <= 0) return;

            const daysSinceLastPurchase = Math.round((today.getTime() - lastPurchase.date.getTime()) / oneDay);
            const consumedAmount = dailyConsumptionRate * daysSinceLastPurchase;
            const estimatedCurrentStock = Math.max(0, lastPurchase.amount - consumedAmount);

            const reorderPointQuantity = dailyConsumptionRate * REORDER_BUFFER_DAYS;

            if (estimatedCurrentStock <= 0) {
                suggestions.push({
                    name: history.name, unit: history.unit, category: history.category,
                    lastPurchaseDate: lastPurchase.date.toISOString(),
                    reason: t.suggestionReasonDepleted,
                    priority: 'high'
                });
            } else if (estimatedCurrentStock <= reorderPointQuantity) {
                const daysLeft = Math.ceil(estimatedCurrentStock / dailyConsumptionRate); // Use ceil to be conservative
                suggestions.push({
                    name: history.name, unit: history.unit, category: history.category,
                    lastPurchaseDate: lastPurchase.date.toISOString(),
                    reason: t.suggestionReasonStockLow(estimatedCurrentStock, history.unit, daysLeft),
                    priority: 'medium'
                });
            }
        });

        return suggestions.sort((a,b) => {
            // Sort by priority first, then by how low the stock is (more urgent first)
            if (a.priority > b.priority) return -1;
            if (a.priority < b.priority) return 1;
            // You could add a secondary sort key here if needed
            return 0;
        });
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
            const data = JSON.parse(jsonData);
            if (Array.isArray(data.lists)) {
                const cleanedLists = data.lists.map((list: any) => ({
                    ...list,
                    items: list.items.map((item: any) => {
                        const { receiptImage, ...rest } = item;
                        return rest;
                    }),
                }));

                const cleanedData = {
                    lists: cleanedLists,
                    customCategories: data.customCategories || [],
                    vendors: data.vendors || [],
                    categoryVendorMap: data.categoryVendorMap || {},
                    itemInfoMap: data.itemInfoMap || {},
                };

                set(cleanedData);
                await saveData(cleanedData);
            } else {
                throw new Error("Invalid data format");
            }
        } catch (error) {
            console.error("Import failed:", error);
            throw error;
        }
      },

      exportData: () => {
        const data = {
            lists: get().lists,
            customCategories: get().customCategories,
            vendors: get().vendors,
            categoryVendorMap: get().categoryVendorMap,
            itemInfoMap: get().itemInfoMap,
        };
        return JSON.stringify(data, null, 2);
      },
}));
