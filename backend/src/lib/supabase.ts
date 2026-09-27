import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';
import { ConfigError } from '../errors.js';

let client: SupabaseClient | undefined;

/**
 * Service-role client (bypasses RLS). This process is the only database client:
 * the browser has no Supabase access at all.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, serviceRoleKey } = env.supabase;
    if (!url || !serviceRoleKey) throw new ConfigError('Supabase');
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'X-Client-Info': 'tutorpro-backend' } },
    });
  }
  return client;
}
