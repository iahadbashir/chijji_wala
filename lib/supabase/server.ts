// ============================================================
// HXD — Supabase Server Client (Service Role)
// lib/supabase/server.ts
//
// Use ONLY in Server Actions and Route Handlers.
// The service_role key bypasses RLS — never expose it
// to the client bundle (it has no NEXT_PUBLIC_ prefix).
// ============================================================
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Returns a Supabase client authenticated as the service role.
 * This bypasses all RLS policies, which is intentional for
 * server-side order processing where we need to write to tables
 * that anon users cannot update (e.g. setting order status).
 */
export function createServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,  // server-side — never persist session to storage
      autoRefreshToken: false,
    },
  });
}
