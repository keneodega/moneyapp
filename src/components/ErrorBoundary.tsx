'use client';

import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component for catching React errors
 * 
 * Wraps the app to catch and display errors gracefully,
 * while also reporting them to Sentry for monitoring.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorBoundary: true,
      },
    });

    // Log to console in development
    if (process.env.NEXT_PUBLIC_APP_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page to clear any corrupted state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--color-danger)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-headline font-bold text-[var(--color-text)] mb-2">
                Something went wrong
              </h1>
              <p className="text-body text-[var(--color-text-muted)] mb-6">
                We've been notified and are working on a fix. Please try refreshing the page.
              </p>
              {this.state.error && process.env.NEXT_PUBLIC_APP_ENV === 'development' && (
                <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20">
                  <p className="text-caption font-mono text-[var(--color-danger)] text-left">
                    {this.state.error.toString()}
                  </p>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Button
                  variant="primary"
                  onClick={this.handleReset}
                >
                  Reload Page
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => (window.location.href = '/')}
                >
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
