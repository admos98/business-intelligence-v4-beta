import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShoppingStore } from '../useShoppingStore';
import { Unit, ItemStatus, PaymentStatus } from '../../../shared/types';
import type { ShoppingList, ShoppingItem, Vendor } from '../../../shared/types';

// Mock the API functions
vi.mock('../../lib/api', () => ({
  fetchData: vi.fn().mockResolvedValue(null),
  saveData: vi.fn().mockResolvedValue(undefined),
}));

// Mock IndexedDB
vi.mock('../../lib/indexedDB', () => ({
  indexedDBManager: {
    saveData: vi.fn().mockResolvedValue(undefined),
    getData: vi.fn().mockResolvedValue(null),
  },
  isOnline: vi.fn().mockReturnValue(true),
}));

describe('useShoppingStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    const { result } = renderHook(() => useShoppingStore());
    act(() => {
      // Reset all state
      result.current.logout();
    });
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      const { result } = renderHook(() => useShoppingStore());

      await act(async () => {
        const success = await result.current.login('admin', 'admin123');
        expect(success).toBe(true);
      });

      expect(result.current.currentUser).toBeTruthy();
      expect(result.current.currentUser?.username).toBe('admin');
    });

    it('should reject invalid credentials', async () => {
      const { result } = renderHook(() => useShoppingStore());

      await act(async () => {
        const success = await result.current.login('admin', 'wrongpassword');
        expect(success).toBe(false);
      });

      expect(result.current.currentUser).toBeNull();
    });

    it('should logout user', () => {
      const { result } = renderHook(() => useShoppingStore());

      act(() => {
        result.current.login('admin', 'admin123');
      });

      expect(result.current.currentUser).toBeTruthy();

      act(() => {
        result.current.logout();
      });

      expect(result.current.currentUser).toBeNull();
    });
  });

  describe('List Management', () => {
    it('should create a new list', () => {
      const { result } = renderHook(() => useShoppingStore());

      act(() => {
        const listId = result.current.createList(new Date());
        expect(listId).toBeTruthy();
      });

      expect(result.current.lists.length).toBeGreaterThan(0);
    });

    it('should update a list', () => {
      const { result } = renderHook(() => useShoppingStore());

      let listId: string;

      act(() => {
        listId = result.current.createList(new Date());
      });

      const list = result.current.lists.find((l: ShoppingList) => l.id === listId!);
      expect(list).toBeTruthy();

      act(() => {
        if (list) {
          const updatedList = {
            ...list,
            items: [
              {
                id: 'item-1',
                name: 'Test Item',
                unit: Unit.Piece,
                quantity: 1,
                category: 'Test',
                status: ItemStatus.Pending,
                paymentStatus: PaymentStatus.Paid,
              },
            ],
          };
          result.current.updateList(listId!, updatedList);
        }
      });

      const updatedList = result.current.lists.find((l: ShoppingList) => l.id === listId!);
      expect(updatedList?.items.length).toBe(1);
      expect(updatedList?.items[0].name).toBe('Test Item');
    });

    it('should delete a list', () => {
      const { result } = renderHook(() => useShoppingStore());

      let listId: string;

      act(() => {
        listId = result.current.createList(new Date());
      });

      expect(result.current.lists.find((l: ShoppingList) => l.id === listId!)).toBeTruthy();

      act(() => {
        result.current.deleteList(listId!);
      });

      expect(result.current.lists.find((l: ShoppingList) => l.id === listId!)).toBeFalsy();
    });
  });

  describe('Vendor Management', () => {
    it('should add a vendor', () => {
      const { result } = renderHook(() => useShoppingStore());

      act(() => {
        const vendorId = result.current.addVendor({
          name: 'Test Vendor',
          phone: '1234567890',
        });

        expect(vendorId).toBeTruthy();
      });

      const vendor = result.current.vendors.find((v: Vendor) => v.name === 'Test Vendor');
      expect(vendor).toBeTruthy();
      expect(vendor?.phone).toBe('1234567890');
    });

    it('should find or create vendor', () => {
      const { result } = renderHook(() => useShoppingStore());

      let vendorId: string | undefined;

      act(() => {
        vendorId = result.current.findOrCreateVendor('New Vendor');
      });

      expect(vendorId).toBeTruthy();

      // Should find existing vendor
      act(() => {
        const foundId = result.current.findOrCreateVendor('New Vendor');
        expect(foundId).toBe(vendorId);
      });
    });

    it('should update vendor', () => {
      const { result } = renderHook(() => useShoppingStore());

      let vendorId: string;

      act(() => {
        vendorId = result.current.addVendor({ name: 'Test Vendor' });
      });

      act(() => {
        result.current.updateVendor(vendorId, { phone: '9999999999' });
      });

      const vendor = result.current.vendors.find((v: Vendor) => v.id === vendorId);
      expect(vendor?.phone).toBe('9999999999');
    });

    it('should delete vendor', () => {
      const { result } = renderHook(() => useShoppingStore());

      let vendorId: string;

      act(() => {
        vendorId = result.current.addVendor({ name: 'Test Vendor' });
      });

      expect(result.current.vendors.find((v: Vendor) => v.id === vendorId)).toBeTruthy();

      act(() => {
        result.current.deleteVendor(vendorId);
      });

      expect(result.current.vendors.find((v: Vendor) => v.id === vendorId)).toBeFalsy();
    });
  });

  describe('Item Info Memory', () => {
    it('should remember item info', () => {
      const { result } = renderHook(() => useShoppingStore());

      const item = {
        id: 'item-1',
        name: 'Milk',
        unit: Unit.Liter,
        quantity: 2,
        category: 'Dairy',
        status: ItemStatus.Pending,
        paymentStatus: PaymentStatus.Paid,
      };

      act(() => {
        result.current.addCustomData(item);
      });

      const rememberedInfo = result.current.getItemInfo('Milk');
      expect(rememberedInfo).toBeTruthy();
      expect(rememberedInfo?.unit).toBe(Unit.Liter);
      expect(rememberedInfo?.category).toBe('Dairy');
    });

    it('should get latest price per unit', () => {
      const { result } = renderHook(() => useShoppingStore());

      let listId: string;

      act(() => {
        listId = result.current.createList(new Date());
      });

      const list = result.current.lists.find((l: ShoppingList) => l.id === listId!);

      act(() => {
        if (list) {
          const item: ShoppingItem = {
            id: 'item-1',
            name: 'Bread',
            unit: Unit.Piece,
            quantity: 2,
            category: 'Bakery',
            status: ItemStatus.Bought,
            paymentStatus: PaymentStatus.Paid,
            paidPrice: 20000,
            purchasedAmount: 2,
          };
          result.current.updateList(listId!, {
            ...list,
            items: [item],
          });
        }
      });

      const pricePerUnit = result.current.getLatestPricePerUnit('Bread', Unit.Piece);
      expect(pricePerUnit).toBe(10000); // 20000 / 2
    });
  });

  describe('Category Management', () => {
    it('should add a category', () => {
      const { result } = renderHook(() => useShoppingStore());

      act(() => {
        result.current.addCategory('New Category');
      });

      expect(result.current.customCategories).toContain('New Category');
    });

    it('should not add duplicate category', () => {
      const { result } = renderHook(() => useShoppingStore());

      act(() => {
        result.current.addCategory('Category');
        result.current.addCategory('Category');
      });

      const count = result.current.customCategories.filter((c: string) => c === 'Category').length;
      expect(count).toBe(1);
    });
  });
});
