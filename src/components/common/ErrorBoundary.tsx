import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-background text-primary p-4">
                    <div className="max-w-md w-full bg-surface border border-border rounded-lg p-6 shadow-card">
                        <h2 className="text-xl font-bold text-danger mb-4">خطایی رخ داد</h2>
                        <p className="text-secondary mb-4">
                            متأسفانه مشکلی در نمایش این صفحه پیش آمده است. لطفاً صفحه را رفرش کنید.
                        </p>
                        {this.state.error && (
                            <details className="mb-4">
                                <summary className="cursor-pointer text-sm text-secondary mb-2">
                                    جزئیات خطا
                                </summary>
                                <pre className="text-xs bg-background p-2 rounded border border-border overflow-auto">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                            className="w-full px-4 py-2 bg-accent text-accent-text font-medium rounded-lg hover:opacity-90 transition-opacity"
                        >
                            رفرش صفحه
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
