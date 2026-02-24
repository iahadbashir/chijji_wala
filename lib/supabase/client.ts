// ============================================================
// HXD — Supabase Browser Client
// lib/supabase/client.ts
//
// Use this singleton in Client Components ('use client').
// Do NOT use this in Server Actions or Route Handlers —
// those must use lib/supabase/server.ts.
// ============================================================
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
