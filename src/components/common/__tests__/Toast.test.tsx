import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

// Test component that uses the toast
const TestComponent = () => {
  const { addToast } = useToast();

  return (
    <div>
      <button onClick={() => addToast('Success message', 'success')}>Show Success</button>
      <button onClick={() => addToast('Error message', 'error')}>Show Error</button>
      <button onClick={() => addToast('Info message', 'info')}>Show Info</button>
      <button onClick={() => addToast('Warning message', 'warning')}>Show Warning</button>
    </div>
  );
};

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render ToastProvider without crashing', () => {
    render(
      <ToastProvider>
        <div>Test</div>
      </ToastProvider>
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should display success toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Success');
    button.click();

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should display error toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Error');
    button.click();

    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should display info toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Info');
    button.click();

    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('should display warning toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Warning');
    button.click();

    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should auto-dismiss toast after 3 seconds', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Success');
    button.click();

    expect(screen.getByText('Success message')).toBeInTheDocument();

    // Advance time by 3 seconds
    vi.advanceTimersByTime(3000);

    // Toast should be dismissed after animation
    await waitFor(() => {
      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    }, { timeout: 100 });
  });

  it('should allow manual dismissal', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    const button = screen.getByText('Show Success');
    button.click();

    expect(screen.getByText('Success message')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /×/ });
    closeButton.click();

    vi.advanceTimersByTime(300);

    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });

  it('should show multiple toasts', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    screen.getByText('Show Success').click();
    screen.getByText('Show Error').click();
    screen.getByText('Show Info').click();

    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('should throw error if useToast is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const TestComponentOutside = () => {
      useToast();
      return null;
    };

    expect(() => {
      render(<TestComponentOutside />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleSpy.mockRestore();
  });
});
