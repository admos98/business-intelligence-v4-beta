# Testing Guide

This guide explains how to write and run tests for the Business Intelligence application.

## Test Setup

The project uses:
- **Vitest** - Fast test runner
- **React Testing Library** - Component testing utilities
- **jsdom** - DOM environment for tests
- **@testing-library/jest-dom** - Custom matchers

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests are organized to mirror the source structure:

```
src/
  components/
    common/
      __tests__/
        ErrorBoundary.test.tsx
        Toast.test.tsx
  hooks/
    __tests__/
      useDebounce.test.ts
      useSessionTimeout.test.ts
  store/
    __tests__/
      useShoppingStore.test.ts
```

## Writing Tests

### Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Hook Tests

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('should return initial value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current).toBe('initial');
  });
});
```

### Store Tests

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShoppingStore } from '../useShoppingStore';

describe('useShoppingStore', () => {
  it('should create a list', () => {
    const { result } = renderHook(() => useShoppingStore());

    act(() => {
      const listId = result.current.createList(new Date());
      expect(listId).toBeTruthy();
    });
  });
});
```

## Best Practices

### 1. Test User Behavior, Not Implementation

❌ Bad:
```typescript
expect(component.state.value).toBe(5);
```

✅ Good:
```typescript
expect(screen.getByDisplayValue('5')).toBeInTheDocument();
```

### 2. Use Descriptive Test Names

❌ Bad:
```typescript
it('works', () => {});
```

✅ Good:
```typescript
it('should display error message when login fails', () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 3 },
  ];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(35);
});
```

### 4. Test Edge Cases

- Empty states
- Error states
- Loading states
- Boundary values
- Invalid inputs

### 5. Mock External Dependencies

```typescript
vi.mock('../../lib/api', () => ({
  fetchData: vi.fn().mockResolvedValue(mockData),
}));
```

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Current Test Coverage

Run `npm run test:coverage` to see current coverage.

Focus areas for improvement:
1. Store actions and computed values
2. Complex business logic
3. Error handling paths
4. User interactions

## Debugging Tests

### Use `screen.debug()`

```typescript
render(<MyComponent />);
screen.debug(); // Shows current DOM
```

### Use `waitFor`

```typescript
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Use `act` for State Updates

```typescript
act(() => {
  result.current.updateValue(5);
});
```

## Common Patterns

### Testing Async Operations

```typescript
it('should load data', async () => {
  render(<DataComponent />);

  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

### Testing User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should submit form', async () => {
  const user = userEvent.setup();
  render(<Form />);

  await user.type(screen.getByLabelText('Name'), 'John');
  await user.click(screen.getByRole('button', { name: 'Submit' }));

  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### Testing Context Providers

```typescript
const Wrapper = ({ children }) => (
  <ToastProvider>{children}</ToastProvider>
);

render(<MyComponent />, { wrapper: Wrapper });
```

### Testing Error Boundaries

```typescript
const ThrowError = () => {
  throw new Error('Test error');
};

render(
  <ErrorBoundary>
    <ThrowError />
  </ErrorBoundary>
);

expect(screen.getByText('خطایی رخ داد')).toBeInTheDocument();
```

## Continuous Integration

Tests should run automatically on:
- Pull requests
- Commits to main branch
- Before deployments

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
