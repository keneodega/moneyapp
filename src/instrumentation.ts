/**
 * Instrumentation file for Next.js
 * 
 * This file is executed once when the server starts.
 * Use it to initialize Sentry and other monitoring tools.
 * 
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry for server-side
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for edge runtime
    await import('../sentry.edge.config');
  }
}
