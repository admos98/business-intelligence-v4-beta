// src/store/slices/shoppingSlice.ts
// Shopping lists and items domain slice

import { StateCreator } from 'zustand';
import { ShoppingList, ShoppingItem, CafeCategory, Unit, ItemStatus, PaymentStatus, PaymentMethod, OcrResult, SmartSuggestion } from '../../../shared/types';
import { t } from '../../../shared/translations';
import { parseJalaliDate, toJalaliDateString } from '../../../shared/jalali';
import { logger } from '../../utils/logger';

const DEFAULT_CATEGORIES: string[] = Object.values(CafeCategory);

export interface ShoppingSliceState {
    lists: ShoppingList[];
    customCategories: string[];
    categoryVendorMap: Record<string, string>;
    itemInfoMap: Record<string, { unit: Unit; category: string }>;
    isHydrating: boolean;

    // Actions
    createList: (date: Date) => string;
    updateList: (listId: string, updatedList: ShoppingList) => void;
    deleteList: (listId: string) => void;
    updateItem: (listId: string, itemId: string, updates: Partial<ShoppingItem>) => void;
    addItemFromSuggestion: (suggestion: SmartSuggestion) => boolean;
    addCustomData: (item: ShoppingItem) => void;
    addOcrPurchase: (ocrResult: OcrResult, paymentMethod: PaymentMethod, paymentStatus: PaymentStatus, _vendorName?: string) => string;
    addCategory: (name: string) => void;
    updateMasterItem: (originalName: string, originalUnit: Unit, updates: { name: string; unit: Unit; category: string }) => void;

    // Computed
    allCategories: () => string[];
    getKnownItemNames: () => string[];
    getItemInfo: (name: string) => { unit: Unit; category: string } | undefined;
    isItemInTodaysPendingList: (name: string, unit: Unit) => boolean;

    // Internal
    _setIsHydrating: (isHydrating: boolean) => void;
    _setLists: (lists: ShoppingList[]) => void;
    _setCustomCategories: (categories: string[]) => void;
    _setCategoryVendorMap: (map: Record<string, string>) => void;
    _setItemInfoMap: (map: Record<string, { unit: Unit; category: string }>) => void;
}

// Helper to trigger save (will be provided by combined store)
type SaveTrigger = () => void;

export const createShoppingSlice: StateCreator<
    ShoppingSliceState & { _saveTrigger?: SaveTrigger },
    [],
    [],
    ShoppingSliceState
> = (set, get) => ({
    lists: [],
    customCategories: [],
    categoryVendorMap: {},
    itemInfoMap: {},
    isHydrating: false,

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
        get()._saveTrigger?.();
        return newList.id;
    },

    updateList: (listId, updatedList) => {
        set((state) => ({
            lists: state.lists.map((list) => (list.id === listId ? updatedList : list)),
        }));
        get()._saveTrigger?.();
    },

    deleteList: (listId) => {
        set((state) => ({ lists: state.lists.filter((list) => list.id !== listId) }));
        get()._saveTrigger?.();
    },

    updateItem: (listId, itemId, updates) => {
        set((state) => ({
            lists: state.lists.map((list) => {
                if (list.id === listId) {
                    return {
                        ...list,
                        items: list.items.map((item) =>
                            item.id === itemId ? { ...item, ...updates } : item
                        ),
                    };
                }
                return list;
            }),
        }));
        get()._saveTrigger?.();
    },

    addItemFromSuggestion: ({ name, unit, category }) => {
        const today = new Date();
        const listId = get().createList(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));

        const list = get().lists.find((l) => l.id === listId)!;

        const alreadyExists = list.items.some(
            (item) => item.name === name && item.unit === unit && item.status === ItemStatus.Pending
        );
        if (alreadyExists) {
            return false;
        }

        const newItem: ShoppingItem = {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name,
            amount: 1,
            quantity: 1,
            unit,
            category,
            status: ItemStatus.Pending,
            paymentStatus: PaymentStatus.Due,
        };

        get().updateList(listId, { ...list, items: [...list.items, newItem] });
        return true;
    },

    addCustomData: (item) => {
        const { category, name, unit } = item;
        const allCats = get().allCategories();

        let stateChanged = false;
        const stateUpdates: Partial<ShoppingSliceState> = {};

        if (category && !allCats.includes(category)) {
            stateUpdates.customCategories = [...get().customCategories, category];
            stateChanged = true;
        }

        if (name && unit && category) {
            const key = `${name.trim()}-${unit}`;
            stateUpdates.itemInfoMap = { ...get().itemInfoMap, [key]: { unit, category } };
            stateChanged = true;
        }

        if (stateChanged) {
            set(stateUpdates);
            get()._saveTrigger?.();
        }
    },

    addOcrPurchase: (ocrResult, paymentMethod, paymentStatus, _vendorName) => {
        const { date, items: ocrItems } = ocrResult;

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
        const targetList = get().lists.find((l) => l.id === targetListId)!;

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
        }));

        newShoppingItems.forEach((item) => {
            get().addCustomData(item);
        });

        const updatedList = { ...targetList, items: [...targetList.items, ...newShoppingItems] };
        get().updateList(targetListId, updatedList);

        return targetList.name;
    },

    addCategory: (name: string) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        set((state) => {
            if (state.customCategories.includes(trimmed)) return {} as Partial<ShoppingSliceState>;
            return { customCategories: [...state.customCategories, trimmed] } as Partial<ShoppingSliceState>;
        });
        get()._saveTrigger?.();
    },

    updateMasterItem: (originalName, originalUnit, updates) => {
        set((state) => {
            const newLists = state.lists.map((list) => ({
                ...list,
                items: list.items.map((item) => {
                    if (item.name === originalName && item.unit === originalUnit) {
                        return { ...item, ...updates };
                    }
                    return item;
                }),
            }));

            const newItemInfoMap = { ...state.itemInfoMap };
            const originalKey = `${originalName}-${originalUnit}`;
            const newKey = `${updates.name}-${updates.unit}`;

            if (
                (originalName !== updates.name || originalUnit !== updates.unit) &&
                newItemInfoMap[originalKey]
            ) {
                delete newItemInfoMap[originalKey];
            }
            newItemInfoMap[newKey] = { unit: updates.unit, category: updates.category };

            return { lists: newLists, itemInfoMap: newItemInfoMap };
        });
        get()._saveTrigger?.();
    },

    allCategories: () => {
        const { customCategories } = get();
        const combined = [...DEFAULT_CATEGORIES, ...customCategories];
        return [...new Set(combined)];
    },

    getKnownItemNames: () => {
        const itemNames = new Set<string>();
        get().lists.forEach((list) => {
            list.items.forEach((item) => itemNames.add(item.name));
        });
        Object.keys(get().itemInfoMap).forEach((name) => itemNames.add(name));
        return Array.from(itemNames).sort((a, b) => a.localeCompare(b, 'fa'));
    },

    getItemInfo: (name: string) => {
        const allUnits = Object.values(Unit);
        for (const unit of allUnits) {
            const compositeKey = `${name}-${unit}`;
            const value = get().itemInfoMap[compositeKey];
            if (value) {
                return value;
            }
        }

        const direct = get().itemInfoMap[name];
        if (direct) return direct;

        for (const [key, value] of Object.entries(get().itemInfoMap)) {
            if (key.startsWith(`${name}-`)) {
                return value;
            }
        }
        return undefined;
    },

    isItemInTodaysPendingList: (name, unit) => {
        const today = new Date();
        const todayListId = toJalaliDateString(today.toISOString());
        const todayList = get().lists.find((l) => l.id === todayListId);
        if (!todayList) return false;
        return todayList.items.some(
            (item) => item.name === name && item.unit === unit && item.status === ItemStatus.Pending
        );
    },

    // Internal setters for hydration
    _setIsHydrating: (isHydrating) => set({ isHydrating }),
    _setLists: (lists) => set({ lists }),
    _setCustomCategories: (customCategories) => set({ customCategories }),
    _setCategoryVendorMap: (categoryVendorMap) => set({ categoryVendorMap }),
    _setItemInfoMap: (itemInfoMap) => set({ itemInfoMap }),
});
