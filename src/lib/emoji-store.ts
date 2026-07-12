"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  isDataUrl,
  isMediaRef,
  mediaDelete,
  mediaGet,
  mediaSet,
} from "./media-storage";
import { isSupabaseConfigured } from "./supabase/config";
import { uploadUserMedia } from "./supabase/storage";
import { uid } from "./utils";

export type CustomEmoji = {
  id: string;
  /** Nome sem dois-pontos, ex.: Founders */
  name: string;
  /** URL pública (Supabase), data: (só em memória) ou idb: (persistido) */
  imageUrl: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

const MAX_PER_USER = 24;
const MAX_NAME = 32;
const MIN_NAME = 2;
const MAX_EMOJI_FILE = 3 * 1024 * 1024; // 3 MB
const EMOJI_EDGE = 128;
const EMOJI_TARGET_BYTES = 80 * 1024;
const LS_KEY = "nullysh-custom-emojis";
const IDB_STORE_KEY = `zustand:${LS_KEY}`;

function emojiBlobKey(id: string) {
  return `idb:emoji:${id}`;
}

interface EmojiState {
  emojis: CustomEmoji[];
  hydrated: boolean;
  /** Catálogo remoto = fonte multi-user (todos veem; VIP cria). */
  hydrateEmojis: (remote: CustomEmoji[]) => void;
  upsertEmoji: (emoji: CustomEmoji) => void;
  removeEmojiById: (id: string) => void;
  createEmoji: (data: {
    name: string;
    imageUrl: string;
    userId: string;
    userName: string;
  }) => Promise<{ ok: true; emoji: CustomEmoji } | { ok: false; error: string }>;
  deleteEmoji: (
    id: string,
    userId: string,
    isAdmin: boolean
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  getByName: (name: string) => CustomEmoji | undefined;
}

/** Mescla remoto (prioridade) + locais com https que ainda não subiram. */
function mergeEmojiCatalog(
  remote: CustomEmoji[],
  local: CustomEmoji[]
): CustomEmoji[] {
  const byName = new Map<string, CustomEmoji>();
  for (const e of remote) {
    if (!e?.name || !e.imageUrl) continue;
    byName.set(e.name.toLowerCase(), e);
  }
  // Mantém locais só se tiverem URL pública e o nome não existir no remoto
  // (legado VIP: imagem no Storage, linha ainda não na tabela)
  for (const e of local) {
    if (!e?.name) continue;
    const key = e.name.toLowerCase();
    if (byName.has(key)) continue;
    if (
      e.imageUrl.startsWith("http://") ||
      e.imageUrl.startsWith("https://")
    ) {
      byName.set(key, e);
    }
  }
  return Array.from(byName.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function normalizeEmojiName(raw: string): string {
  return raw
    .trim()
    .replace(/^:+|:+$/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, MAX_NAME);
}

export function isValidEmojiName(name: string): boolean {
  return (
    name.length >= MIN_NAME &&
    name.length <= MAX_NAME &&
    /^[a-zA-Z0-9_]+$/.test(name)
  );
}

export function validateEmojiImage(
  file: File
): { ok: true } | { ok: false; error: string } {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Envie uma imagem (PNG, JPG, GIF ou WebP)." };
  }
  if (file.size > MAX_EMOJI_FILE) {
    return { ok: false, error: "Emoji deve ter no máximo 3 MB." };
  }
  return { ok: true };
}

export function emojiShortcode(name: string) {
  return `:${normalizeEmojiName(name)}:`;
}

function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

/** Comprime emoji estático (128px). GIF animado não passa pelo canvas. */
async function compressEmojiDataUrl(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith("data:image/gif")) return dataUrl;
  if (dataUrlByteLength(dataUrl) <= EMOJI_TARGET_BYTES) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          EMOJI_EDGE / (img.naturalWidth || img.width || EMOJI_EDGE),
          EMOJI_EDGE / (img.naturalHeight || img.height || EMOJI_EDGE)
        );
        const w = Math.max(
          16,
          Math.round((img.naturalWidth || img.width) * scale)
        );
        const h = Math.max(
          16,
          Math.round((img.naturalHeight || img.height) * scale)
        );
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);

        let mime: "image/webp" | "image/png" = "image/png";
        try {
          if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) {
            mime = "image/webp";
          }
        } catch {
          mime = "image/png";
        }

        let best = dataUrl;
        let bestSize = dataUrlByteLength(dataUrl);
        for (let q = 0.9; q >= 0.7; q -= 0.08) {
          const out =
            mime === "image/webp"
              ? canvas.toDataURL("image/webp", q)
              : canvas.toDataURL("image/png");
          const size = dataUrlByteLength(out);
          if (size < bestSize) {
            best = out;
            bestSize = size;
          }
          if (size <= EMOJI_TARGET_BYTES) break;
          if (mime === "image/png") break; // PNG sem quality loop útil
        }
        resolve(best);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * data: → Supabase Storage (preferido) ou IndexedDB.
 * Nunca deixa data URL gigante no localStorage.
 */
async function persistEmojiImage(
  userId: string,
  emojiId: string,
  imageUrl: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return { ok: true, url: imageUrl };
  }
  if (!imageUrl.startsWith("data:")) {
    return { ok: false, error: "Imagem inválida. Envie o arquivo de novo." };
  }

  const compressed = await compressEmojiDataUrl(imageUrl);

  if (isSupabaseConfigured()) {
    const up = await uploadUserMedia({
      bucket: "emojis",
      userId,
      dataUrlOrBlob: compressed,
      filename: `emoji-${emojiId}.${
        compressed.startsWith("data:image/gif")
          ? "gif"
          : compressed.startsWith("data:image/webp")
            ? "webp"
            : "png"
      }`,
    });
    if (up.ok) return { ok: true, url: up.publicUrl };
    console.warn("[emoji] Storage falhou, fallback IndexedDB:", up.error);
  }

  try {
    const key = emojiBlobKey(emojiId);
    await mediaSet(key, compressed);
    return { ok: true, url: key };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Sem espaço para o emoji: ${e.message}`
          : "Sem espaço no navegador para guardar o emoji.",
    };
  }
}

/** Em memória: idb: → data: para <img src>. Persistência usa refs leves. */
async function hydrateEmojiList(emojis: CustomEmoji[]): Promise<CustomEmoji[]> {
  const out: CustomEmoji[] = [];
  for (const e of emojis) {
    if (isMediaRef(e.imageUrl)) {
      const data = await mediaGet(e.imageUrl);
      out.push({ ...e, imageUrl: data || e.imageUrl });
    } else {
      out.push(e);
    }
  }
  return out;
}

/** Antes de gravar: data: → idb: (e grava blob no IDB). https fica. */
async function dehydrateEmojiList(
  emojis: CustomEmoji[]
): Promise<CustomEmoji[]> {
  const out: CustomEmoji[] = [];
  for (const e of emojis) {
    if (isDataUrl(e.imageUrl)) {
      const key = emojiBlobKey(e.id);
      try {
        await mediaSet(key, e.imageUrl);
        out.push({ ...e, imageUrl: key });
      } catch {
        // se IDB falhar, descarta a imagem pesada para não estourar cota
        out.push({ ...e, imageUrl: "" });
      }
    } else {
      out.push(e);
    }
  }
  return out;
}

/**
 * Storage híbrido: IndexedDB como principal (sem cota ~5MB do localStorage).
 * Migra e limpa a chave antiga do localStorage se existir.
 */
const emojiPersistStorage: StateStorage = {
  getItem: async (name): Promise<string | null> => {
    // 1) tenta IDB
    let raw = await mediaGet(`zustand:${name}`);
    // 2) migra localStorage antigo (estourado com data URLs)
    if (!raw && typeof localStorage !== "undefined") {
      try {
        raw = localStorage.getItem(name);
      } catch {
        raw = null;
      }
    }
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as {
        state?: { emojis?: CustomEmoji[] };
        emojis?: CustomEmoji[];
      };
      const state = parsed.state ?? parsed;
      const list = state.emojis ?? [];
      // Offload data URLs legados → IDB refs
      const compact = await dehydrateEmojiList(list);
      if (parsed.state) {
        parsed.state.emojis = compact;
      } else {
        (parsed as { emojis: CustomEmoji[] }).emojis = compact;
      }
      const compactStr = JSON.stringify(parsed);
      // salva versão leve no IDB e limpa LS
      try {
        await mediaSet(`zustand:${name}`, compactStr);
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
      // devolve com imagens hidratadas para a sessão
      const hydrated = await hydrateEmojiList(compact);
      if (parsed.state) {
        parsed.state.emojis = hydrated;
      } else {
        (parsed as { emojis: CustomEmoji[] }).emojis = hydrated;
      }
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  },

  setItem: async (name, value): Promise<void> => {
    try {
      const parsed = JSON.parse(value) as {
        state?: { emojis?: CustomEmoji[] };
        version?: number;
      };
      if (parsed.state?.emojis) {
        parsed.state.emojis = await dehydrateEmojiList(parsed.state.emojis);
      }
      const compact = JSON.stringify(parsed);
      await mediaSet(`zustand:${name}`, compact);
      // Libera cota do localStorage (causa do QuotaExceededError)
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
      // tenta não usar LS; se IDB ok, basta
    } catch (e) {
      // último recurso: tenta IDB com o valor cru
      try {
        await mediaSet(`zustand:${name}`, value);
        try {
          localStorage.removeItem(name);
        } catch {
          /* ignore */
        }
      } catch {
        console.error("[emoji] falha ao persistir", e);
        throw e;
      }
    }
  },

  removeItem: async (name): Promise<void> => {
    await mediaDelete(`zustand:${name}`);
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const useEmojiStore = create<EmojiState>()(
  persist(
    (set, get) => ({
      emojis: [],
      hydrated: false,

      hydrateEmojis: (remote) => {
        const local = get().emojis;
        const merged = mergeEmojiCatalog(remote, local);
        set({ emojis: merged, hydrated: true });

        // Publica legados locais (https no Storage, sem linha na tabela)
        if (isSupabaseConfigured() && local.length) {
          const remoteNames = new Set(
            remote.map((e) => e.name.toLowerCase())
          );
          void import("@/lib/supabase/emoji-service").then(
            ({ insertRemoteEmoji }) => {
              for (const e of local) {
                if (!e.name || remoteNames.has(e.name.toLowerCase())) continue;
                if (
                  !e.imageUrl.startsWith("http://") &&
                  !e.imageUrl.startsWith("https://")
                ) {
                  continue;
                }
                void insertRemoteEmoji({
                  name: e.name,
                  imageUrl: e.imageUrl,
                  createdById: e.createdById,
                  createdByName: e.createdByName,
                }).then((res) => {
                  if (res.ok) {
                    get().upsertEmoji(res.emoji);
                  }
                });
              }
            }
          );
        }
      },

      upsertEmoji: (emoji) => {
        set((s) => {
          const key = emoji.name.toLowerCase();
          const without = s.emojis.filter(
            (e) =>
              e.id !== emoji.id && e.name.toLowerCase() !== key
          );
          return { emojis: [emoji, ...without] };
        });
      },

      removeEmojiById: (id) => {
        set((s) => ({ emojis: s.emojis.filter((e) => e.id !== id) }));
      },

      createEmoji: async ({ name, imageUrl, userId, userName }) => {
        const n = normalizeEmojiName(name);
        if (!isValidEmojiName(n)) {
          return {
            ok: false,
            error: "Nome inválido. Use 2–32 letras, números ou _.",
          };
        }
        if (!imageUrl) {
          return { ok: false, error: "Selecione uma imagem." };
        }
        const exists = get().emojis.some(
          (e) => e.name.toLowerCase() === n.toLowerCase()
        );
        if (exists) {
          return { ok: false, error: `O emoji :${n}: já existe.` };
        }
        const mine = get().emojis.filter((e) => e.createdById === userId);
        if (mine.length >= MAX_PER_USER) {
          return {
            ok: false,
            error: `Limite de ${MAX_PER_USER} emojis por VIP.`,
          };
        }

        const tempId = uid("ce");
        const stored = await persistEmojiImage(userId, tempId, imageUrl);
        if (!stored.ok) return stored;

        // Multi-user: exige URL pública no Storage + linha em custom_emojis
        if (isSupabaseConfigured()) {
          if (
            !stored.url.startsWith("http://") &&
            !stored.url.startsWith("https://")
          ) {
            return {
              ok: false,
              error:
                "Falha no upload do emoji para a nuvem. Tente de novo com uma imagem menor.",
            };
          }
          const { insertRemoteEmoji } = await import(
            "@/lib/supabase/emoji-service"
          );
          const remote = await insertRemoteEmoji({
            name: n,
            imageUrl: stored.url,
            createdById: userId,
            createdByName: userName,
          });
          if (!remote.ok) return remote;

          try {
            set((s) => ({ emojis: [remote.emoji, ...s.emojis] }));
          } catch (e) {
            const msg =
              e instanceof Error ? e.message : "Falha ao guardar o emoji.";
            return { ok: false, error: msg };
          }
          return { ok: true, emoji: remote.emoji };
        }

        // Modo local (sem Supabase)
        let displayUrl = stored.url;
        if (isMediaRef(stored.url)) {
          displayUrl = (await mediaGet(stored.url)) || stored.url;
        }

        const emoji: CustomEmoji = {
          id: tempId,
          name: n,
          imageUrl: displayUrl,
          createdById: userId,
          createdByName: userName,
          createdAt: new Date().toISOString(),
        };

        try {
          set((s) => ({ emojis: [emoji, ...s.emojis] }));
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : "Falha ao guardar o emoji.";
          if (/quota|exceeded|storage/i.test(msg)) {
            return {
              ok: false,
              error:
                "Armazenamento do navegador cheio. Recarregue a página e tente de novo (emojis agora usam Storage/IndexedDB).",
            };
          }
          return { ok: false, error: msg };
        }
        return { ok: true, emoji };
      },

      deleteEmoji: async (id, userId, isAdmin) => {
        const emoji = get().emojis.find((e) => e.id === id);
        if (!emoji) return { ok: false, error: "Emoji não encontrado." };
        if (!isAdmin && emoji.createdById !== userId) {
          return { ok: false, error: "Só o criador ou admin pode remover." };
        }
        if (isSupabaseConfigured()) {
          const { deleteRemoteEmoji } = await import(
            "@/lib/supabase/emoji-service"
          );
          const remote = await deleteRemoteEmoji(id);
          if (!remote.ok) return remote;
        }
        await mediaDelete(emojiBlobKey(id));
        set((s) => ({ emojis: s.emojis.filter((e) => e.id !== id) }));
        return { ok: true };
      },

      getByName: (name) => {
        const n = normalizeEmojiName(name);
        return get().emojis.find(
          (e) => e.name.toLowerCase() === n.toLowerCase()
        );
      },
    }),
    {
      name: LS_KEY,
      storage: createJSONStorage(() => emojiPersistStorage),
      partialize: (s) => ({ emojis: s.emojis }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // garante hidratação de refs idb que possam ter sobrado
        void hydrateEmojiList(state.emojis).then((emojis) => {
          useEmojiStore.setState({ emojis, hydrated: true });
        });
        // limpa chave legada no LS se ainda existir (libera cota)
        try {
          localStorage.removeItem(LS_KEY);
        } catch {
          /* ignore */
        }
      },
    }
  )
);

// limpeza preventiva no load do módulo (antes do 1º create)
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && raw.length > 500_000) {
      // migra async sem bloquear
      void (async () => {
        try {
          await mediaSet(IDB_STORE_KEY, raw);
          localStorage.removeItem(LS_KEY);
          console.info(
            "[emoji] migrado nullysh-custom-emojis do localStorage → IndexedDB"
          );
        } catch (e) {
          console.warn("[emoji] migração LS→IDB falhou, limpando LS", e);
          try {
            localStorage.removeItem(LS_KEY);
          } catch {
            /* ignore */
          }
        }
      })();
    }
  } catch {
    /* ignore */
  }
}
