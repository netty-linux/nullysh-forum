/**
 * Supabase Admin (service role) — SERVER ONLY.
 * Bypass RLS para fulfillment Pay → VIP.
 * NUNCA importar em client components.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

let cached: SupabaseClient | null = null;

export function getSupabaseServiceRoleKey(): string {
  return (
    (typeof process !== "undefined" &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) ||
    ""
  );
}

export function isServiceRoleConfigured(): boolean {
  const k = getSupabaseServiceRoleKey();
  return Boolean(SUPABASE_URL && k.length > 20);
}

/** Client com service role — só em API routes server-side. */
export function getSupabaseAdmin(): SupabaseClient | null {
  const key = getSupabaseServiceRoleKey();
  if (!SUPABASE_URL || key.length < 20) return null;
  if (cached) return cached;
  cached = createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}
