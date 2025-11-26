// src/store/useShoppingStoreRefactored.ts
// Refactored store using domain slices - maintains backward compatibility
// This is a new implementation that can gradually replace the old one

import { create } from 'zustand';
import { createAuthSlice, AuthSliceState } from './slices/authSlice';
import { createShoppingSlice, ShoppingSliceState } from './slices/shoppingSlice';
import { logger } from '../utils/logger';
import { fetchData, saveData, StoredData } from '../lib/api';
import { Unit } from '../../shared/types';

// Combined state type
type CombinedState = AuthSliceState & ShoppingSliceState & {
    // Add other slice states as we create them
    hydrateFromCloud: () => Promise<void>;
    _saveTrigger: () => void;
};

// Debounced save logic
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledUserId: string | null = null;

const createDebouncedSave = (getState: () => CombinedState) => {
    if (typeof window === 'undefined') {
        return;
    }

    const currentState = getState();
    const userIdAtSchedule = currentState.currentUser?.username || null;
    scheduledUserId = userIdAtSchedule;

    if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
        const freshState = getState();
        const { currentUser, isHydrating } = freshState;

        if (!currentUser || isHydrating || currentUser.username !== userIdAtSchedule || scheduledUserId !== userIdAtSchedule) {
            if (currentUser?.username !== userIdAtSchedule || scheduledUserId !== userIdAtSchedule) {
                logger.warn('Save cancelled: User changed during debounce period');
            }
            scheduledUserId = null;
            return;
        }

        const dataToSave: StoredData = {
            lists: freshState.lists,
            customCategories: freshState.customCategories,
            vendors: [], // Will be added when vendors slice is created
            categoryVendorMap: freshState.categoryVendorMap,
            itemInfoMap: freshState.itemInfoMap,
            // Add other fields as slices are created
        };

        saveData(dataToSave).catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : "Auto-save failed";
            logger.error("Auto-save failed:", errorMessage);
        });
    }, 1500);
};

// Create the combined store
export const useShoppingStoreRefactored = create<CombinedState>()((...a) => ({
    ...createAuthSlice(...a),
    ...createShoppingSlice(...a),

    // Hydration function
    hydrateFromCloud: async () => {
        const set = a[0];
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
                            if (Object.values(Unit).includes(unit as Unit)) {
                                validatedItemInfoMap[key] = { unit: unit as Unit, category };
                            }
                        }
                    }
                }

                set({
                    lists: data.lists,
                    customCategories: data.customCategories,
                    categoryVendorMap: data.categoryVendorMap,
                    itemInfoMap: validatedItemInfoMap,
                    isHydrating: false,
                });
            } else {
                set({ isHydrating: false });
            }
        } catch (error) {
            logger.error("Failed to hydrate from cloud:", error);
            set({ isHydrating: false });
        }
    },

    // Save trigger function
    _saveTrigger: () => {
        const get = a[1];
        createDebouncedSave(get);
    },
}));
