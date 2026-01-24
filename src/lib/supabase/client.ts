import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/config';

/**
 * Create a Supabase client for use in the browser (Client Components)
 * 
 * This client automatically connects to the correct Supabase project
 * based on the current environment (development, preview, production).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    env.supabase.url,
    env.supabase.anonKey
  );
}

// Alias for backwards compatibility
export const createClient = createSupabaseBrowserClient;
