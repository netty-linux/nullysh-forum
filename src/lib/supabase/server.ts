import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config";

/** Cliente server (App Router / RSC) com cookies de sessão via next/headers. */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* set em Server Component — ignorar */
        }
      },
    },
  });
}

/**
 * Cliente Supabase a partir do Request da Route Handler.
 * Mais confiável no OpenNext/Cloudflare Workers do que `cookies()` sozinho:
 * lê cookies do `NextRequest` (e opcionalmente Bearer).
 */
export function getSupabaseFromRequest(
  req: NextRequest
): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll() {
        /* Route Handlers não precisam gravar cookie aqui */
      },
    },
  });
}

/**
 * Cliente com JWT do browser (Authorization: Bearer …).
 * Preferido em APIs admin quando o cookie SSR não chega no Worker.
 */
export function getSupabaseWithAccessToken(
  accessToken: string
): SupabaseClient | null {
  if (!isSupabaseConfigured() || !accessToken.trim()) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
