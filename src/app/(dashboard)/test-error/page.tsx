'use client';

/**
 * Test Error Page
 * 
 * This page is used to test Sentry error tracking.
 * It provides buttons to trigger different types of errors.
 * 
 * ⚠️ Only available in development and preview environments
 */

import { useState } from 'react';
import { Card, Button } from '@/components/ui';
import { getAppEnvironment } from '@/lib/config/env';
import * as Sentry from '@sentry/nextjs';

export default function TestErrorPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Only allow in development and preview
  const env = getAppEnvironment();
  const isProduction = env === 'production';
  if (isProduction) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-headline text-[var(--color-text)] mb-4">Not Available</h1>
        <p className="text-body text-[var(--color-text-muted)]">
          Error testing is not available in production.
        </p>
      </div>
    );
  }

  const triggerClientError = () => {
    try {
      setErrorMessage('Triggering client-side error...');
      // This will throw an error
      throw new Error('Test client-side error from Sentry test page');
    } catch (error) {
      Sentry.captureException(error);
      setErrorMessage('Client error captured! Check Sentry dashboard.');
    }
  };

  const triggerAsyncError = async () => {
    try {
      setErrorMessage('Triggering async error...');
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Test async error from Sentry test page'));
        }, 100);
      });
    } catch (error) {
      Sentry.captureException(error);
      setErrorMessage('Async error captured! Check Sentry dashboard.');
    }
  };

  const triggerServerError = async () => {
    try {
      setErrorMessage('Triggering server error...');
      const response = await fetch('/api/test-error');
      if ( !response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }
      const data = await response.json();
      setErrorMessage(data.message || 'Server error captured! Check Sentry dashboard.');
    } catch (error) {
      Sentry.captureException(error);
      setErrorMessage('Server error captured! Check Sentry dashboard.');
    }
  };

  const triggerMoneyEvent = () => {
    setErrorMessage('Logging test money event...');
    Sentry.addBreadcrumb({
      category: 'money.event',
      message: 'test.event',
      level: 'info',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
    Sentry.captureMessage('Test Money Event', {
      level: 'info',
      tags: {
        event_type: 'money_event',
        event_name: 'test.event',
      },
    });
    setErrorMessage('Money event logged! Check Sentry dashboard.');
  };

  const clearMessage = () => {
    setErrorMessage(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-display text-[var(--color-text)]">Test Error Tracking</h1>
        <p className="text-body text-[var(--color-text-muted)] mt-2">
          Test Sentry error tracking and logging. Errors will be sent to your Sentry project.
        </p>
        <p className="text-small text-[var(--color-text-muted)] mt-2">
          Environment: <strong>{env}</strong>
        </p>
      </div>

      {/* Info Card */}
      <Card variant="outlined" padding="md" className="bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
            <InfoIcon className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h3 className="text-body font-medium text-[var(--color-text)]">
              How to Verify
            </h3>
            <p className="text-small text-[var(--color-text-muted)] mt-1">
              After triggering an error, check your Sentry dashboard at{' '}
              <a 
                href="https://sentry.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] hover:underline"
              >
                sentry.io
              </a>
              {' '}to see the captured error.
            </p>
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {errorMessage && (
        <Card variant="outlined" padding="md" className="bg-[var(--color-success)]/10 border-[var(--color-success)]/20">
          <div className="flex items-start justify-between gap-4">
            <p className="text-small text-[var(--color-success)]">{errorMessage}</p>
            <button
              onClick={clearMessage}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Test Buttons */}
      <Card variant="raised" padding="lg">
        <h2 className="text-title text-[var(--color-text)] mb-4">Test Error Types</h2>
        <div className="space-y-3">
          <Button
            onClick={triggerClientError}
            variant="secondary"
            className="w-full"
          >
            Trigger Client Error
          </Button>
          <p className="text-caption text-[var(--color-text-muted)]">
            Throws a synchronous error in the browser
          </p>

          <Button
            onClick={triggerAsyncError}
            variant="secondary"
            className="w-full"
          >
            Trigger Async Error
          </Button>
          <p className="text-caption text-[var(--color-text-muted)]">
            Throws an error in an async function
          </p>

          <Button
            onClick={triggerServerError}
            variant="secondary"
            className="w-full"
          >
            Trigger Server Error
          </Button>
          <p className="text-caption text-[var(--color-text-muted)]">
            Calls an API route that throws an error
          </p>

          <Button
            onClick={triggerMoneyEvent}
            variant="secondary"
            className="w-full"
          >
            Log Test Money Event
          </Button>
          <p className="text-caption text-[var(--color-text-muted)]">
            Logs a test money event (expense/income/month created)
          </p>
        </div>
      </Card>

      {/* Sentry Status */}
      <Card variant="outlined" padding="md">
        <h3 className="text-body font-medium text-[var(--color-text)] mb-2">
          Sentry Configuration
        </h3>
        <div className="space-y-1 text-small text-[var(--color-text-muted)]">
          <p>
            DSN: {process.env.NEXT_PUBLIC_SENTRY_DSN ? '✅ Configured' : '❌ Not configured'}
          </p>
          <p>
            Environment: {env}
          </p>
          <p>
            Traces Sample Rate: {isProduction ? '10%' : '100%'}
          </p>
        </div>
      </Card>
    </div>
  );
}

// Icons
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
