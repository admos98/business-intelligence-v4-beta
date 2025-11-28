# Store Refactoring Documentation

## Overview

The store has been refactored to use a domain slice pattern while maintaining 100% backward compatibility. This improves maintainability and allows for better code organization.

## What's Been Done

### 1. Lazy Loading ✅
- All route components are now lazy-loaded
- Reduces initial bundle size significantly
- Components load on-demand when routes are accessed

### 2. Store Slices Created ✅
- **Auth Slice** (`src/store/slices/authSlice.ts`): Handles authentication, users, login/logout
- **Shopping Slice** (`src/store/slices/shoppingSlice.ts`): Handles shopping lists, items, categories

### 3. Store Structure
- Original store (`useShoppingStore.ts`) remains functional
- New refactored store (`useShoppingStoreRefactored.ts`) demonstrates the slice pattern
- Both can coexist during migration

## Architecture

### Domain Slices Pattern

Each domain slice is self-contained:
```typescript
// Example: authSlice.ts
export const createAuthSlice: StateCreator<AuthSliceState> = (set, get) => ({
  // State
  users: [],
  currentUser: null,

  // Actions
  login: async (username, password) => { ... },
  logout: () => { ... },
  // ...
});
```

### Combined Store

Slices are combined using Zustand's pattern:
```typescript
export const useShoppingStore = create<CombinedState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createShoppingSlice(...a),
  // ... other slices
}));
```

## Remaining Slices to Create

The following domains still need to be extracted into slices:

1. **Vendors Slice**: Vendor management
2. **POS/Sell Slice**: Point of sale, transactions, shifts
3. **Recipes Slice**: Recipe management
4. **Stock Slice**: Inventory/stock management
5. **Accounting Slice**: Accounts, journal entries
6. **Financial Statements Slice**: Balance sheet, income statement, cash flow
7. **Tax Slice**: Tax settings and rates
8. **Customers/Invoices Slice**: Customer and invoice management
9. **Analytics Slice**: Computed functions (inflation, suggestions, summaries)

## Migration Strategy

### Phase 1: Foundation (Current)
- ✅ Lazy loading implemented
- ✅ Auth slice created
- ✅ Shopping slice created
- ✅ Helper functions extracted

### Phase 2: Core Domains (Next)
- Create Vendors, POS, Recipes, Stock slices
- Migrate related functionality

### Phase 3: Financial Domains
- Create Accounting, Financial Statements, Tax slices
- Migrate financial calculations

### Phase 4: Advanced Features
- Create Customers/Invoices, Analytics slices
- Complete migration

### Phase 5: Cleanup
- Remove old monolithic store
- Update all imports
- Final testing

## Benefits

1. **Maintainability**: Each domain is isolated and easier to understand
2. **Testability**: Slices can be tested independently
3. **Performance**: Lazy loading reduces initial bundle size
4. **Scalability**: Easy to add new domains without touching existing code
5. **Type Safety**: Better TypeScript inference with smaller slices

## Usage

The store continues to work exactly as before:

```typescript
import { useShoppingStore } from './store/useShoppingStore';

const MyComponent = () => {
  const { lists, createList, login } = useShoppingStore();
  // Works exactly as before!
};
```

## Next Steps

1. Continue creating remaining slices incrementally
2. Test each slice as it's created
3. Gradually migrate functionality
4. Monitor bundle size improvements
5. Update documentation as slices are added

## Notes

- The original store (`useShoppingStore.ts`) remains the active store
- The refactored version (`useShoppingStoreRefactored.ts`) is a reference implementation
- Both can coexist during the migration period
- No breaking changes have been introduced

