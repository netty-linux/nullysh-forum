"use client";

import type { ForumEvent, ForumEventType } from "./catalog";
import { uid } from "./utils";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** v2: D1 é fonte da verdade (delete no Panel limpa o Forum). */
const STORAGE_VERSION = 2;

/** IDs do seed antigo (catalog FORUM_EVENTS) */
const LEGACY_EVENT_IDS = new Set(["ev1", "ev2", "ev3", "ev4", "ev5"]);

const EVENT_TYPES: ForumEventType[] = [
  "live",
  "workshop",
  "networking",
  "ama",
];

export type CreateEventInput = {
  title: string;
  description: string;
  type: ForumEventType;
  /** ISO datetime do início */
  startsAt: string;
  durationMin: number;
  hostName: string;
  interestTags: string[];
  vipOnly: boolean;
  capacity: number;
  createdById: string;
  createdByName: string;
};

/**
 * D1 (Panel) é a fonte da verdade. Lista vazia no servidor limpa o cache local.
 * Em falha de rede, mantém o cache offline.
 */
export async function hydrateEventsFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/content/events", { cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; items?: ForumEvent[] };
    if (!res.ok || !data.ok || !Array.isArray(data.items)) return;
    const remote = data.items
      .map((e) => normalizeEvent(e as ForumEvent))
      .filter((e): e is ForumEvent => !!e);
    useEventStore.setState({ events: remote });
  } catch {
    /* offline — mantém cache local */
  }
}

function normalizeType(raw: unknown): ForumEventType {
  return EVENT_TYPES.includes(raw as ForumEventType)
    ? (raw as ForumEventType)
    : "live";
}

function normalizeEvent(
  raw: Partial<ForumEvent> & { id: string }
): ForumEvent | null {
  if (!raw.id || LEGACY_EVENT_IDS.has(raw.id)) return null;
  const title = (raw.title || "").trim();
  if (!title) return null;
  const startsAt = raw.startsAt || "";
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return null;
  const durationMin =
    typeof raw.durationMin === "number" && raw.durationMin > 0
      ? Math.min(Math.floor(raw.durationMin), 24 * 60)
      : 60;
  const capacity =
    typeof raw.capacity === "number" && raw.capacity > 0
      ? Math.min(Math.floor(raw.capacity), 100_000)
      : 100;
  return {
    id: raw.id,
    title,
    description: (raw.description || "").trim(),
    type: normalizeType(raw.type),
    startsAt,
    durationMin,
    hostName: (raw.hostName || "Nullysh").trim() || "Nullysh",
    interestTags: Array.isArray(raw.interestTags)
      ? raw.interestTags
          .filter((t) => typeof t === "string" && t.trim())
          .map((t) => t.trim())
          .slice(0, 8)
      : [],
    vipOnly: !!raw.vipOnly,
    capacity,
    createdById: raw.createdById,
    createdByName: raw.createdByName,
    createdAt: raw.createdAt,
  };
}

interface EventState {
  events: ForumEvent[];
  createEvent: (
    input: CreateEventInput
  ) => { ok: true; event: ForumEvent } | { ok: false; error: string };
  updateEvent: (
    id: string,
    input: Omit<CreateEventInput, "createdById" | "createdByName">
  ) => { ok: true; event: ForumEvent } | { ok: false; error: string };
  deleteEvent: (id: string) => { ok: true } | { ok: false; error: string };
  getById: (id: string) => ForumEvent | undefined;
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],

      createEvent: (input) => {
        const title = input.title.trim();
        if (title.length < 3) {
          return { ok: false, error: "Título deve ter pelo menos 3 caracteres." };
        }
        if (title.length > 140) {
          return { ok: false, error: "Título muito longo (máx. 140)." };
        }
        const description = input.description.trim();
        if (description.length < 8) {
          return {
            ok: false,
            error: "Descrição deve ter pelo menos 8 caracteres.",
          };
        }
        const startsAt = input.startsAt.trim();
        const startMs = new Date(startsAt).getTime();
        if (!startsAt || Number.isNaN(startMs)) {
          return { ok: false, error: "Informe data e hora válidas." };
        }
        const durationMin = Math.floor(Number(input.durationMin));
        if (!durationMin || durationMin < 15) {
          return { ok: false, error: "Duração mínima: 15 minutos." };
        }
        if (durationMin > 24 * 60) {
          return { ok: false, error: "Duração máxima: 24 horas." };
        }
        const capacity = Math.floor(Number(input.capacity));
        if (!capacity || capacity < 1) {
          return { ok: false, error: "Capacidade deve ser pelo menos 1." };
        }
        const hostName = input.hostName.trim() || "Nullysh";
        const interestTags = (input.interestTags || [])
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8);

        const event: ForumEvent = {
          id: uid("ev"),
          title,
          description,
          type: normalizeType(input.type),
          startsAt: new Date(startMs).toISOString(),
          durationMin,
          hostName,
          interestTags,
          vipOnly: !!input.vipOnly,
          capacity,
          createdById: input.createdById,
          createdByName: input.createdByName,
          createdAt: new Date().toISOString(),
        };

        set((s) => ({ events: [event, ...s.events] }));
        return { ok: true, event };
      },

      updateEvent: (id, input) => {
        const existing = get().events.find((e) => e.id === id);
        if (!existing) return { ok: false, error: "Evento não encontrado." };

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
        const startsAt = input.startsAt.trim();
        const startMs = new Date(startsAt).getTime();
        if (!startsAt || Number.isNaN(startMs)) {
          return { ok: false, error: "Informe data e hora válidas." };
        }
        const durationMin = Math.floor(Number(input.durationMin));
        if (!durationMin || durationMin < 15) {
          return { ok: false, error: "Duração mínima: 15 minutos." };
        }
        const capacity = Math.floor(Number(input.capacity));
        if (!capacity || capacity < 1) {
          return { ok: false, error: "Capacidade deve ser pelo menos 1." };
        }

        const event: ForumEvent = {
          ...existing,
          title,
          description,
          type: normalizeType(input.type),
          startsAt: new Date(startMs).toISOString(),
          durationMin,
          hostName: input.hostName.trim() || "Nullysh",
          interestTags: (input.interestTags || [])
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
          vipOnly: !!input.vipOnly,
          capacity,
        };

        set((s) => ({
          events: s.events.map((e) => (e.id === id ? event : e)),
        }));
        return { ok: true, event };
      },

      deleteEvent: (id) => {
        if (!get().events.some((e) => e.id === id)) {
          return { ok: false, error: "Evento não encontrado." };
        }
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
        return { ok: true };
      },

      getById: (id) => get().events.find((e) => e.id === id),
    }),
    {
      name: "nullysh-events",
      version: STORAGE_VERSION,
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2) {
          return { events: [] };
        }
        const state = (persisted || {}) as { events?: unknown[] };
        const list = Array.isArray(state.events) ? state.events : [];
        return {
          events: list
            .map((raw) =>
              raw && typeof raw === "object" && "id" in raw
                ? normalizeEvent(raw as Partial<ForumEvent> & { id: string })
                : null
            )
            .filter((e): e is ForumEvent => !!e),
        };
      },
      partialize: (s) => ({ events: s.events }),
    }
  )
);
