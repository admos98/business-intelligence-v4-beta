import { Component, ErrorInfo, ReactNode } from 'react';
import Card from './Card';
import { logger } from '../../utils/logger';

/**
 * Props for the ErrorBoundary component
 */
interface Props {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI to display when an error occurs */
  fallback?: ReactNode;
}

/**
 * Internal state of the ErrorBoundary component
 */
interface State {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The error that was caught */
  error: Error | null;
  /** Additional error information from React */
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors in child components
 *
 * This component implements React's error boundary pattern to catch errors
 * during rendering, in lifecycle methods, and in constructors of the whole tree below them.
 *
 * @example
 * ```tsx
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error using logger utility
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full">
            <div className="text-center space-y-4">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-primary">خطایی رخ داد</h2>
              <p className="text-secondary">
                متأسفانه مشکلی در نمایش این بخش پیش آمده است.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mt-4 p-4 bg-danger/10 rounded-lg border border-danger/20">
                  <summary className="cursor-pointer text-danger font-semibold mb-2">
                    جزئیات خطا (فقط در حالت توسعه)
                  </summary>
                  <pre className="text-xs text-danger overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3 justify-center mt-6">
                <button
                  onClick={this.handleReset}
                  className="px-6 py-2 bg-accent text-accent-text rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  تلاش مجدد
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-surface border border-border text-primary rounded-lg hover:bg-border transition-colors font-medium"
                >
                  بارگذاری مجدد صفحه
                </button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
