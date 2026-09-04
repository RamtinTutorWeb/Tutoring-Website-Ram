import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

let client: SupabaseClient | undefined;

/**
 * Service-role Supabase client for server-side use only (bypasses RLS).
 * Memoized per function instance. Never import this from frontend code.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'X-Client-Info': 'tutorpro-api' },
      },
    });
  }
  return client;
}
