"use client";

import type {
  LearningTrail,
  TrailAttachment,
  TrailLevel,
  TrailLink,
  TrailStep,
  TrailStepType,
} from "./catalog";
import { isEmptyTrailHtml, sanitizeTrailHtml, stripHtml } from "./trail-html";
import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** v4: D1 (Panel) é fonte da verdade — limpa fantasmas do localStorage. */
const STORAGE_VERSION = 4;

/** IDs das trilhas seed antigas — purgar do localStorage */
const LEGACY_TRAIL_IDS = new Set([
  "trail-ia-fundamentos",
  "trail-negocio-digital",
  "trail-conteudo",
  "trail-dev",
]);

export type CreateTrailStepInput = {
  /** Preserva id ao editar (progresso dos membros) */
  id?: string;
  title: string;
  description: string;
  type: TrailStepType;
  duration?: string;
  videoId?: string | null;
  videoTitle?: string | null;
  links?: TrailLink[];
  attachments?: TrailAttachment[];
};

export type CreateTrailInput = {
  title: string;
  description: string;
  level: TrailLevel;
  vipOnly: boolean;
  interestTags: string[];
  steps: CreateTrailStepInput[];
  links?: TrailLink[];
  attachments?: TrailAttachment[];
  createdById: string;
  createdByName: string;
};

/**
 * Sincroniza trilhas com o D1 (escrito pelo Nullysh Panel).
 * D1 é a fonte da verdade: itens removidos no Panel somem do Forum.
 * Em falha de rede/API, mantém o cache local (offline).
 */
export async function hydrateTrailsFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/content/trails", { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      items?: LearningTrail[];
    };
    if (!res.ok || !data.ok || !Array.isArray(data.items)) return;
    const remote = data.items
      .map((t) => normalizeTrail(t as LearningTrail))
      .filter((t): t is LearningTrail => !!t);
    // Substitui o store inteiro — inclusive lista vazia (delete no Panel).
    useTrailStore.setState({ trails: remote });
  } catch {
    /* offline — mantém cache local */
  }
}

function normalizeLinks(raw: unknown): TrailLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const l = item as Partial<TrailLink>;
      const label = (l.label || "").trim();
      const url = (l.url || "").trim();
      if (!label || !url) return null;
      return {
        id: l.id || uid("tlink"),
        label: label.slice(0, 80),
        url: url.slice(0, 500),
      };
    })
    .filter((x): x is TrailLink => !!x)
    .slice(0, 12);
}

function normalizeAttachments(raw: unknown): TrailAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const a = item as Partial<TrailAttachment>;
      if (!a.id || !a.name || !a.storageKey) return null;
      return {
        id: a.id,
        name: String(a.name).slice(0, 120),
        size: typeof a.size === "number" ? a.size : 0,
        mimeType: a.mimeType || "application/octet-stream",
        storageKey: a.storageKey,
      };
    })
    .filter((x): x is TrailAttachment => !!x)
    .slice(0, 12);
}

function normalizeStep(
  raw: Partial<TrailStep> & { title?: string },
  index: number
): TrailStep | null {
  const title = (raw.title || "").trim();
  if (!title) return null;
  const type: TrailStepType =
    raw.type === "material" ||
    raw.type === "practice" ||
    raw.type === "live" ||
    raw.type === "video"
      ? raw.type
      : "practice";
  return {
    id: raw.id || uid(`step${index}`),
    title,
    description: (raw.description || "").trim(),
    type,
    duration: raw.duration?.trim() || undefined,
    videoId: raw.videoId?.trim() || null,
    videoTitle: raw.videoTitle?.trim() || null,
    links: normalizeLinks(raw.links),
    attachments: normalizeAttachments(raw.attachments),
  };
}

function normalizeTrail(
  raw: Partial<LearningTrail> & { id: string }
): LearningTrail | null {
  if (!raw.id || LEGACY_TRAIL_IDS.has(raw.id)) return null;
  const title = (raw.title || "").trim();
  if (!title) return null;
  const level: TrailLevel =
    raw.level === "intermediário" || raw.level === "avançado"
      ? raw.level
      : "iniciante";
  const steps = (raw.steps || [])
    .map((s, i) => normalizeStep(s, i))
    .filter((s): s is TrailStep => !!s);
  const description = sanitizeTrailHtml(raw.description || "");
  return {
    id: raw.id,
    title,
    description,
    level,
    interestTags: Array.isArray(raw.interestTags)
      ? raw.interestTags.filter((t) => typeof t === "string" && t.trim())
      : [],
    steps,
    vipOnly: !!raw.vipOnly,
    links: normalizeLinks(raw.links),
    attachments: normalizeAttachments(raw.attachments),
    createdById: raw.createdById,
    createdByName: raw.createdByName,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

interface TrailState {
  trails: LearningTrail[];
  createTrail: (
    input: CreateTrailInput
  ) => { ok: true; trail: LearningTrail } | { ok: false; error: string };
  updateTrail: (
    id: string,
    input: Omit<CreateTrailInput, "createdById" | "createdByName">
  ) => { ok: true; trail: LearningTrail } | { ok: false; error: string };
  deleteTrail: (id: string) => { ok: true } | { ok: false; error: string };
  getById: (id: string) => LearningTrail | undefined;
}

function validateInput(
  input: Pick<CreateTrailInput, "title" | "description" | "steps">
): string | null {
  const title = input.title.trim();
  if (title.length < 3) return "Título com no mínimo 3 caracteres.";
  if (title.length > 80) return "Título com no máximo 80 caracteres.";
  const plain = stripHtml(input.description);
  if (isEmptyTrailHtml(input.description) || plain.length < 8) {
    return "Descrição com no mínimo 8 caracteres.";
  }
  if (plain.length > 8000) return "Descrição muito longa.";
  if (!input.steps.length) return "Adicione pelo menos 1 etapa.";
  for (let i = 0; i < input.steps.length; i++) {
    if (!input.steps[i].title.trim()) {
      return `Etapa ${i + 1}: informe o título.`;
    }
  }
  return null;
}

function mapSteps(
  inputSteps: CreateTrailStepInput[],
  existing?: TrailStep[]
): TrailStep[] {
  const existingById = new Map((existing || []).map((s) => [s.id, s]));
  return inputSteps
    .map((s, i) => {
      const keepId =
        (s.id && existingById.has(s.id) ? s.id : undefined) ||
        existing?.[i]?.id;
      return normalizeStep(
        {
          id: keepId,
          title: s.title,
          description: s.description,
          type: s.type,
          duration: s.duration,
          videoId: s.videoId,
          videoTitle: s.videoTitle,
          links: s.links,
          attachments: s.attachments,
        },
        i
      );
    })
    .filter((s): s is TrailStep => !!s);
}

export const useTrailStore = create<TrailState>()(
  persist(
    (set, get) => ({
      trails: [],

      createTrail: (input) => {
        const err = validateInput(input);
        if (err) return { ok: false, error: err };

        const now = new Date().toISOString();
        const steps = mapSteps(input.steps);

        const trail: LearningTrail = {
          id: uid("trail"),
          title: input.title.trim(),
          description: sanitizeTrailHtml(input.description),
          level: input.level,
          interestTags: input.interestTags
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
          steps,
          vipOnly: !!input.vipOnly,
          links: normalizeLinks(input.links),
          attachments: normalizeAttachments(input.attachments),
          createdById: input.createdById,
          createdByName: input.createdByName,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({ trails: [trail, ...s.trails] }));
        return { ok: true, trail };
      },

      updateTrail: (id, input) => {
        const existing = get().trails.find((t) => t.id === id);
        if (!existing) return { ok: false, error: "Trilha não encontrada." };
        const err = validateInput(input);
        if (err) return { ok: false, error: err };

        const steps = mapSteps(input.steps, existing.steps);

        const trail: LearningTrail = {
          ...existing,
          title: input.title.trim(),
          description: sanitizeTrailHtml(input.description),
          level: input.level,
          interestTags: input.interestTags
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
          steps,
          vipOnly: !!input.vipOnly,
          links: normalizeLinks(input.links),
          attachments: normalizeAttachments(input.attachments),
          updatedAt: new Date().toISOString(),
        };

        set((s) => ({
          trails: s.trails.map((t) => (t.id === id ? trail : t)),
        }));
        return { ok: true, trail };
      },

      deleteTrail: (id) => {
        if (!get().trails.some((t) => t.id === id)) {
          return { ok: false, error: "Trilha não encontrada." };
        }
        set((s) => ({ trails: s.trails.filter((t) => t.id !== id) }));
        return { ok: true };
      },

      getById: (id) => get().trails.find((t) => t.id === id),
    }),
    {
      name: "nullysh-trails",
      version: STORAGE_VERSION,
      partialize: (s) => ({ trails: s.trails }),
      migrate: (persisted, fromVersion) => {
        // Antes de v4 o hydrate só fazia merge e nunca removia deletes do D1.
        if (fromVersion < 4) {
          return { trails: [] } as never;
        }
        const p = (persisted || {}) as { trails?: LearningTrail[] };
        const trails = (p.trails || [])
          .map((t) => normalizeTrail(t as LearningTrail))
          .filter((t): t is LearningTrail => !!t);
        return { trails } as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<TrailState> | undefined;
        const trails = (p?.trails || current.trails)
          .map((t) => normalizeTrail(t))
          .filter((t): t is LearningTrail => !!t);
        return { ...current, ...p, trails };
      },
    }
  )
);
