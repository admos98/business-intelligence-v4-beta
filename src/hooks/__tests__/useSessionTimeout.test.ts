import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSessionTimeout } from '../useSessionTimeout';
import { useShoppingStore } from '../../store/useShoppingStore';
import { useToast } from '../../components/common/Toast';

// Mock dependencies
vi.mock('../../store/useShoppingStore');
vi.mock('../../components/common/Toast');

describe('useSessionTimeout', () => {
  const mockLogout = vi.fn();
  const mockAddToast = vi.fn();
  const mockCurrentUser = { id: '1', username: 'test' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    (useShoppingStore as any).mockReturnValue({
      logout: mockLogout,
      currentUser: mockCurrentUser,
    });

    (useToast as any).mockReturnValue({
      addToast: mockAddToast,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should set up timeout when user is logged in', () => {
    renderHook(() => useSessionTimeout({ timeoutMinutes: 1, warningMinutes: 0.5 }));

    expect(mockAddToast).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('should show warning after warning time', () => {
    renderHook(() => useSessionTimeout({ timeoutMinutes: 1, warningMinutes: 0.5 }));

    // Advance time to warning period (0.5 minutes = 30 seconds)
    vi.advanceTimersByTime(30 * 1000);

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('جلسه شما در'),
      'warning'
    );
  });

  it('should logout after timeout period', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useSessionTimeout({
        timeoutMinutes: 1,
        warningMinutes: 0.5,
        onTimeout,
      })
    );

    // Advance past warning
    vi.advanceTimersByTime(30 * 1000);
    // Advance past timeout (1 minute = 60 seconds total)
    vi.advanceTimersByTime(30 * 1000);

    expect(mockLogout).toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('جلسه شما منقضی شد'),
      'error'
    );
    expect(onTimeout).toHaveBeenCalled();
  });

  it('should clear timeouts when user logs out', () => {
    const { rerender } = renderHook(() => useSessionTimeout({ timeoutMinutes: 1 }));

    // Simulate logout
    (useShoppingStore as any).mockReturnValue({
      logout: mockLogout,
      currentUser: null,
    });

    rerender();

    vi.advanceTimersByTime(60 * 1000);

    // Should not logout or show warning
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('should reset timeout on user activity', () => {
    renderHook(() => useSessionTimeout({ timeoutMinutes: 1, warningMinutes: 0.5 }));

    // Advance close to warning
    vi.advanceTimersByTime(29 * 1000);

    // Simulate user activity (click event)
    const clickEvent = new MouseEvent('click', { bubbles: true });
    window.dispatchEvent(clickEvent);

    // Advance time again (should not trigger warning because timeout was reset)
    vi.advanceTimersByTime(29 * 1000);

    // Warning should not have been shown yet
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('should use default timeout values', () => {
    renderHook(() => useSessionTimeout({}));

    // Default: 30 minutes timeout, 5 minutes warning
    // Advance to warning time: (30 - 5) * 60 * 1000 = 25 minutes
    vi.advanceTimersByTime(25 * 60 * 1000);

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('جلسه شما در 5 دقیقه دیگر'),
      'warning'
    );
  });

  it('should return resetTimeout function and lastActivity', () => {
    const { result } = renderHook(() => useSessionTimeout({}));

    expect(typeof result.current.resetTimeout).toBe('function');
    expect(typeof result.current.lastActivity).toBe('number');

    // Call resetTimeout
    result.current.resetTimeout();

    // Should reset the timeout
    vi.advanceTimersByTime(25 * 60 * 1000);
    // Warning should still appear after reset (new timeout was set)
    expect(mockAddToast).toHaveBeenCalled();
  });
});
