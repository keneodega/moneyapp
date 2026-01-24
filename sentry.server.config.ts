// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 0.1 : 1.0,

  // Server-side instrumentation
  integrations: [
    // Automatically instrument Next.js API routes and Server Components
    Sentry.anrIntegration({
      // Capture exceptions in ANR (Application Not Responding) detection
    }),
  ],

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NEXT_PUBLIC_APP_ENV === 'development',

  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
});
