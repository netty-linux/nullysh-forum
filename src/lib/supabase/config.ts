/**
 * Configuração pública do Supabase (Nullysh Forum).
 *
 * Workers / OpenNext: usar SOMENTE a API REST via @supabase/supabase-js
 * (HTTPS em *.supabase.co). NUNCA connection string Postgres porta 5432
 * no Worker (esgota conexões e não é suportado de forma estável no edge).
 *
 * Se no futuro houver ORM/SQL direto: usar Supavisor pooler porta **6543**
 * (transaction mode), nunca 5432 direto.
 */

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://rijnjymmivsftkjnhnup.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

/** true quando a anon key está configurada no ambiente */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 20);
}

export const SUPABASE_PROJECT_REF = "rijnjymmivsftkjnhnup";
