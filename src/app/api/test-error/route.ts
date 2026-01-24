/**
 * Test Error API Route
 * 
 * This route is used to test server-side error tracking in Sentry.
 * It intentionally throws an error to verify Sentry capture.
 * 
 * ⚠️ Only available in development and preview environments
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getAppEnvironment } from '@/lib/config/env';

export async function GET() {
  // Only allow in development and preview
  const env = getAppEnvironment();
  if (env === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  try {
    // Add context to Sentry
    Sentry.setContext('test_error', {
      route: '/api/test-error',
      timestamp: new Date().toISOString(),
      environment: env,
    });

    // Throw a test error
    throw new Error('Test server-side error from /api/test-error route');
  } catch (error) {
    // Capture the error in Sentry
    Sentry.captureException(error);

    return NextResponse.json(
      { 
        message: 'Server error captured! Check Sentry dashboard.',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
