"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Cliente browser (singleton). null se Supabase não configurado.
 * Tipos de domínio: ver `database.types.ts` (mantido manualmente).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (browserClient) return browserClient;
  // isSingleton: true evita múltiplos clients (e múltiplos SIGNED_OUT fantasmas)
  // em HMR / re-mount do layout.
  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    isSingleton: true,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // storage padrão (localStorage) + cookies do @supabase/ssr
      flowType: "pkce",
    },
  });
  return browserClient;
}

export function requireSupabaseBrowser(): SupabaseClient {
  const client = getSupabaseBrowser();
  if (!client) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local"
    );
  }
  return client;
}
