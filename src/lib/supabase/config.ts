/** Configuração pública do Supabase (Nullysh Forum). */

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
