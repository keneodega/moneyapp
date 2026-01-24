// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  // Sample rate for session replays (10% in production, 100% in dev)
  replaysSessionSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.1 : 1.0,
  // Always capture replays on errors
  replaysOnErrorSampleRate: 1.0,

  // Instrumentation
  integrations: [
    // Browser tracing for performance monitoring
    Sentry.browserTracingIntegration({
      // Trace navigation (route changes)
      enableInp: true, // Interaction to Next Paint
      enableLongTask: true, // Long tasks
    }),
    // Session Replay for debugging
    Sentry.replayIntegration({
      // Mask all text and media for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NEXT_PUBLIC_APP_ENV === 'development',

  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',

  // Performance monitoring options
  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      // Ignore network errors that are likely user's connection issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return null;
      }
    }
    return event;
  },
});
