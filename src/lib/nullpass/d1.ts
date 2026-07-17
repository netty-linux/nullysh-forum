/**
 * Binding D1 do catálogo NullPass (e futuros dados do fórum).
 * Tipos mínimos (sem depender de @cloudflare/workers-types no tsc local).
 */

export type NullpassD1Prepared = {
  bind(...values: unknown[]): NullpassD1Prepared;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
};

export type NullpassD1 = {
  prepare(query: string): NullpassD1Prepared;
  batch(statements: NullpassD1Prepared[]): Promise<unknown[]>;
};

type CloudflareEnvWithDb = {
  NULLYSH_FORUM_DB?: NullpassD1;
};

async function getEnv(): Promise<CloudflareEnvWithDb | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return (ctx?.env as CloudflareEnvWithDb | undefined) ?? null;
  } catch {
    return null;
  }
}

/** null em next dev sem binding — APIs devolvem 503 e o client usa fallback local. */
export async function getNullpassDb(): Promise<NullpassD1 | null> {
  const env = await getEnv();
  return env?.NULLYSH_FORUM_DB ?? null;
}
