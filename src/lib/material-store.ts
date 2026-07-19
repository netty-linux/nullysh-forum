"use client";

import type { Material, MaterialType } from "./types";
import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** v2: D1 é fonte da verdade (delete no Panel limpa o Forum). */
const STORAGE_VERSION = 2;

/** IDs do seed antigo (mock-data) — purgar se ainda estiverem no localStorage */
const LEGACY_MATERIAL_IDS = new Set([
  "m1",
  "m2",
  "m3",
  "m4",
  "m5",
  "m6",
]);

const MATERIAL_TYPES: MaterialType[] = [
  "pdf",
  "template",
  "checklist",
  "link",
  "course",
];

export type CreateMaterialInput = {
  title: string;
  description: string;
  type: MaterialType;
  category: string;
  size?: string;
  url?: string;
  vipOnly: boolean;
  createdById: string;
  createdByName: string;
};

/**
 * D1 (Panel) é a fonte da verdade. Lista vazia no servidor limpa o cache local.
 * Em falha de rede, mantém o cache offline.
 */
export async function hydrateMaterialsFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/content/materials", { cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; items?: Material[] };
    if (!res.ok || !data.ok || !Array.isArray(data.items)) return;
    const remote = data.items
      .map((m) => normalizeMaterial(m as Material))
      .filter((m): m is Material => !!m);
    useMaterialStore.setState({ materials: remote });
  } catch {
    /* offline — mantém cache local */
  }
}

function normalizeType(raw: unknown): MaterialType {
  return MATERIAL_TYPES.includes(raw as MaterialType)
    ? (raw as MaterialType)
    : "pdf";
}

function normalizeMaterial(
  raw: Partial<Material> & { id: string }
): Material | null {
  if (!raw.id || LEGACY_MATERIAL_IDS.has(raw.id)) return null;
  const title = (raw.title || "").trim();
  if (!title) return null;
  const category = (raw.category || "").trim() || "Geral";
  return {
    id: raw.id,
    title,
    description: (raw.description || "").trim(),
    type: normalizeType(raw.type),
    category,
    size: raw.size?.trim() || undefined,
    url: raw.url?.trim() || null,
    vipOnly: !!raw.vipOnly,
    downloads:
      typeof raw.downloads === "number" && raw.downloads >= 0
        ? Math.floor(raw.downloads)
        : 0,
    createdAt: raw.createdAt || new Date().toISOString(),
    createdById: raw.createdById,
    createdByName: raw.createdByName,
  };
}

interface MaterialState {
  materials: Material[];
  createMaterial: (
    input: CreateMaterialInput
  ) => { ok: true; material: Material } | { ok: false; error: string };
  updateMaterial: (
    id: string,
    input: Omit<CreateMaterialInput, "createdById" | "createdByName">
  ) => { ok: true; material: Material } | { ok: false; error: string };
  deleteMaterial: (id: string) => { ok: true } | { ok: false; error: string };
  recordDownload: (id: string) => void;
  getById: (id: string) => Material | undefined;
}

export const useMaterialStore = create<MaterialState>()(
  persist(
    (set, get) => ({
      materials: [],

      createMaterial: (input) => {
        const title = input.title.trim();
        if (title.length < 3) {
          return { ok: false, error: "Título deve ter pelo menos 3 caracteres." };
        }
        if (title.length > 120) {
          return { ok: false, error: "Título muito longo (máx. 120)." };
        }
        const description = input.description.trim();
        if (description.length < 8) {
          return {
            ok: false,
            error: "Descrição deve ter pelo menos 8 caracteres.",
          };
        }
        const category = input.category.trim();
        if (!category) {
          return { ok: false, error: "Informe a categoria." };
        }
        const type = normalizeType(input.type);
        const url = input.url?.trim() || null;
        if (url) {
          try {
            // aceita http(s) ou //
            const u = new URL(url.startsWith("//") ? `https:${url}` : url);
            if (!/^https?:$/.test(u.protocol)) {
              return { ok: false, error: "URL deve ser http ou https." };
            }
          } catch {
            return { ok: false, error: "URL inválida." };
          }
        }

        const material: Material = {
          id: uid("mat"),
          title,
          description,
          type,
          category,
          size: input.size?.trim() || undefined,
          url,
          vipOnly: !!input.vipOnly,
          downloads: 0,
          createdAt: new Date().toISOString(),
          createdById: input.createdById,
          createdByName: input.createdByName,
        };

        set((s) => ({ materials: [material, ...s.materials] }));
        return { ok: true, material };
      },

      updateMaterial: (id, input) => {
        const existing = get().materials.find((m) => m.id === id);
        if (!existing) return { ok: false, error: "Material não encontrado." };

        const title = input.title.trim();
        if (title.length < 3) {
          return { ok: false, error: "Título deve ter pelo menos 3 caracteres." };
        }
        const description = input.description.trim();
        if (description.length < 8) {
          return {
            ok: false,
            error: "Descrição deve ter pelo menos 8 caracteres.",
          };
        }
        const category = input.category.trim();
        if (!category) {
          return { ok: false, error: "Informe a categoria." };
        }
        const url = input.url?.trim() || null;
        if (url) {
          try {
            const u = new URL(url.startsWith("//") ? `https:${url}` : url);
            if (!/^https?:$/.test(u.protocol)) {
              return { ok: false, error: "URL deve ser http ou https." };
            }
          } catch {
            return { ok: false, error: "URL inválida." };
          }
        }

        const material: Material = {
          ...existing,
          title,
          description,
          type: normalizeType(input.type),
          category,
          size: input.size?.trim() || undefined,
          url,
          vipOnly: !!input.vipOnly,
        };

        set((s) => ({
          materials: s.materials.map((m) => (m.id === id ? material : m)),
        }));
        return { ok: true, material };
      },

      deleteMaterial: (id) => {
        if (!get().materials.some((m) => m.id === id)) {
          return { ok: false, error: "Material não encontrado." };
        }
        set((s) => ({ materials: s.materials.filter((m) => m.id !== id) }));
        return { ok: true };
      },

      recordDownload: (id) => {
        set((s) => ({
          materials: s.materials.map((m) =>
            m.id === id ? { ...m, downloads: m.downloads + 1 } : m
          ),
        }));
      },

      getById: (id) => get().materials.find((m) => m.id === id),
    }),
    {
      name: "nullysh-materials",
      version: STORAGE_VERSION,
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2) {
          return { materials: [] };
        }
        const state = (persisted || {}) as { materials?: unknown[] };
        const list = Array.isArray(state.materials) ? state.materials : [];
        return {
          materials: list
            .map((raw) =>
              raw && typeof raw === "object" && "id" in raw
                ? normalizeMaterial(raw as Partial<Material> & { id: string })
                : null
            )
            .filter((m): m is Material => !!m),
        };
      },
      partialize: (s) => ({ materials: s.materials }),
    }
  )
);
