import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for use in the browser (Client Components)
 * 
 * This client automatically connects to the correct Supabase project
 * based on the current environment (development, preview, production).
 * 
 * Note: During build time, if env vars are not available, this will
 * create a client with placeholder values to allow the build to complete.
 * The client will fail at runtime if env vars are missing (which is expected).
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // During build, env vars might not be available - provide defaults
  // Runtime will catch these if actually used without proper env vars
  if (!url || !anonKey) {
    // Return a client with placeholder values during build
    // This allows the build to complete, but the client won't work at runtime
    // without proper env vars (which is expected)
    return createBrowserClient(
      url || 'https://placeholder.supabase.co',
      anonKey || 'placeholder-key'
    );
  }
  
  return createBrowserClient(url, anonKey);
}

// Alias for backwards compatibility
export const createClient = createSupabaseBrowserClient;
