import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 300 });
    expect(result.current).toBe('initial'); // Still initial

    vi.advanceTimersByTime(299);
    expect(result.current).toBe('initial'); // Still initial

    vi.advanceTimersByTime(1);
    expect(result.current).toBe('updated'); // Now updated
  });

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'change1' });
    vi.advanceTimersByTime(200);
    rerender({ value: 'change2' });
    vi.advanceTimersByTime(200);
    rerender({ value: 'change3' });

    expect(result.current).toBe('initial'); // Should still be initial

    vi.advanceTimersByTime(300);
    expect(result.current).toBe('change3'); // Should be the last change
  });

  it('should work with numbers', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useDebounce(value, 300),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 100 });
    vi.advanceTimersByTime(300);
    expect(result.current).toBe(100);
  });

  it('should work with objects', () => {
    const obj1 = { name: 'test1' };
    const obj2 = { name: 'test2' };

    const { result, rerender } = renderHook(
      ({ value }: { value: { name: string } }) => useDebounce(value, 300),
      { initialProps: { value: obj1 } }
    );

    rerender({ value: obj2 });
    vi.advanceTimersByTime(300);
    expect(result.current).toBe(obj2);
  });
});
