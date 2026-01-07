'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error boundary when resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevResetKeys = prevProps.resetKeys || [];
      const currentResetKeys = this.props.resetKeys;

      if (
        prevResetKeys.length !== currentResetKeys.length ||
        prevResetKeys.some((key, index) => key !== currentResetKeys[index])
      ) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback error={this.state.error} onReset={this.reset} />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="relative bg-gradient-to-br from-[#0f1419] to-[#0a0a0b] rounded-2xl p-8 border border-red-500/20">
          {/* Error Icon */}
          <div className="w-16 h-16 bg-red-500/10 rounded-xl flex items-center justify-center mb-6 mx-auto border border-red-500/20">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Error Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-3">
            Something went wrong
          </h2>

          {/* Error Message */}
          <p className="text-gray-400 text-center mb-6">
            We encountered an unexpected error. Please try again or contact support if the
            problem persists.
          </p>

          {/* Error Details (collapsible) */}
          {error && (
            <details className="mb-6 bg-[#0a0a0b]/50 rounded-lg p-4 border border-red-500/10">
              <summary className="text-sm text-red-400 cursor-pointer hover:text-red-300 transition-colors">
                View error details
              </summary>
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-500">Error Message:</div>
                <pre className="text-xs text-red-300 font-mono overflow-x-auto">
                  {error.message}
                </pre>
                {error.stack && (
                  <>
                    <div className="text-xs text-gray-500 mt-3">Stack Trace:</div>
                    <pre className="text-xs text-gray-400 font-mono overflow-x-auto max-h-40">
                      {error.stack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onReset}
              className="flex-1 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 rounded-lg text-red-300 font-medium transition-all duration-200"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg text-emerald-300 font-medium transition-all duration-200"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

