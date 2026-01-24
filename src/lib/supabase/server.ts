import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/config';

/**
 * Create a Supabase client for use in Server Components, Route Handlers, and Server Actions
 * 
 * This client automatically connects to the correct Supabase project
 * based on the current environment (development, preview, production).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.supabase.url,
    env.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

// Alias for backwards compatibility
export const createClient = createSupabaseServerClient;
