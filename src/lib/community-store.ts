"use client";

import type {
  Community,
  CommunityAccess,
  CommunityTagPolicy,
} from "./types";
import { uid } from "./utils";
import {
  isValidHashtag,
  normalizeHashtag,
} from "./community-hashtags";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** v3: hashtags + tagPolicy */
const STORAGE_VERSION = 3;

/** Ícones disponíveis no seletor (Phosphor names) */
export const COMMUNITY_ICONS = [
  "UsersThree",
  "House",
  "Robot",
  "ChartLineUp",
  "Palette",
  "Lightning",
  "Megaphone",
  "Lightbulb",
  "Code",
  "Heart",
  "Star",
  "Rocket",
] as const;

export type CommunityIconName = (typeof COMMUNITY_ICONS)[number];

/**
 * Assuntos oficiais do staff Nullysh.
 *
 * #staff  — só admin posta · free/VIP leem
 * #geral  — todos marcam e leem
 * #vips   — só VIP marca e lê
 */
export const STAFF_COMMUNITIES: Community[] = [
  {
    id: "staff_anuncios",
    name: "Anúncios Oficiais",
    slug: "anuncios-oficiais",
    description:
      "Comunicados e novidades da equipe Nullysh. Use #staff — apenas admin.",
    hashtag: "staff",
    members: 0,
    posts: 0,
    icon: "Megaphone",
    color: "#1f1f1f",
    vipOnly: false,
    access: "everyone",
    tagPolicy: "admin",
    source: "staff",
    creatorId: "staff",
    creatorName: "Nullysh Staff",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "staff_geral",
    name: "Geral",
    slug: "geral",
    description:
      "Conversas abertas. Marque #geral para o post aparecer aqui.",
    hashtag: "geral",
    members: 0,
    posts: 0,
    icon: "House",
    color: "#1f1f1f",
    vipOnly: false,
    access: "everyone",
    tagPolicy: "everyone",
    source: "staff",
    creatorId: "staff",
    creatorName: "Nullysh Staff",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "staff_vip_lounge",
    name: "Lounge VIP",
    slug: "lounge-vip",
    description:
      "Sala VIP. Marque #vips — só membros VIP marcam e leem os posts.",
    hashtag: "vips",
    members: 0,
    posts: 0,
    icon: "Star",
    color: "#1f1f1f",
    vipOnly: true,
    access: "vip",
    tagPolicy: "everyone",
    source: "staff",
    creatorId: "staff",
    creatorName: "Nullysh Staff",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const LEGACY_SEED_IDS = new Set(["c1", "c2", "c3", "c4", "c5"]);

/** Hashtags reservadas dos assuntos staff (não reutilizar) */
export const RESERVED_HASHTAGS = new Set(
  STAFF_COMMUNITIES.map((c) => c.hashtag)
);

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "assunto"
  );
}

function defaultHashtagFromName(name: string): string {
  return normalizeHashtag(name.replace(/\s+/g, "_")).slice(0, 24) || "assunto";
}

function normalizeCommunity(
  raw: Partial<Community> & { id: string }
): Community | null {
  if (!raw.id || LEGACY_SEED_IDS.has(raw.id)) return null;
  const name = (raw.name || "").trim();
  if (!name) return null;
  const access: CommunityAccess =
    raw.access === "vip" || raw.vipOnly ? "vip" : "everyone";
  const source = raw.source === "member" ? "member" : "staff";

  // Staff: força hashtags oficiais
  const staffDef = STAFF_COMMUNITIES.find((s) => s.id === raw.id);
  let hashtag = staffDef
    ? staffDef.hashtag
    : normalizeHashtag(raw.hashtag || defaultHashtagFromName(name));
  if (!isValidHashtag(hashtag)) {
    hashtag = defaultHashtagFromName(name);
  }

  const tagPolicy: CommunityTagPolicy = staffDef
    ? staffDef.tagPolicy
    : raw.tagPolicy === "admin"
      ? "admin"
      : "everyone";

  return {
    id: raw.id,
    name,
    slug: raw.slug || slugify(name),
    description: (raw.description || "").trim(),
    hashtag,
    members: typeof raw.members === "number" ? raw.members : 0,
    posts: typeof raw.posts === "number" ? raw.posts : 0,
    icon: raw.icon || "UsersThree",
    color: raw.color || "#1f1f1f",
    vipOnly: access === "vip",
    access,
    tagPolicy,
    source,
    creatorId: raw.creatorId || "staff",
    creatorName: raw.creatorName || "Nullysh Staff",
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function mergeWithStaff(list: Community[]): Community[] {
  const byId = new Map(list.map((c) => [c.id, c]));
  for (const s of STAFF_COMMUNITIES) {
    // Staff sempre sobrescreve hashtag/policies oficiais
    byId.set(s.id, { ...s, posts: byId.get(s.id)?.posts ?? 0, members: byId.get(s.id)?.members ?? 0 });
  }
  const staff = STAFF_COMMUNITIES.map((s) => byId.get(s.id)!);
  const members = Array.from(byId.values())
    .filter((c) => c.source === "member")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  return [...staff, ...members];
}

interface CommunityState {
  communities: Community[];
  createCommunity: (input: {
    name: string;
    description: string;
    hashtag: string;
    access: CommunityAccess;
    icon: string;
    creatorId: string;
    creatorName: string;
    isVip: boolean;
  }) =>
    | { ok: true; community: Community }
    | { ok: false; error: string };
  getBySlug: (slug: string) => Community | undefined;
  getById: (id: string) => Community | undefined;
  getByHashtag: (tag: string) => Community | undefined;
  setPostCount: (communityId: string, count: number) => void;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      communities: [...STAFF_COMMUNITIES],

      createCommunity: (input) => {
        if (!input.isVip) {
          return {
            ok: false,
            error: "Apenas membros VIP podem criar assuntos.",
          };
        }
        const name = input.name.trim();
        if (name.length < 3) {
          return { ok: false, error: "Nome com no mínimo 3 caracteres." };
        }
        if (name.length > 48) {
          return { ok: false, error: "Nome com no máximo 48 caracteres." };
        }
        const description = input.description.trim();
        if (description.length < 8) {
          return {
            ok: false,
            error: "Descrição com no mínimo 8 caracteres.",
          };
        }
        if (description.length > 280) {
          return {
            ok: false,
            error: "Descrição com no máximo 280 caracteres.",
          };
        }

        const hashtag = normalizeHashtag(input.hashtag || name);
        if (!isValidHashtag(hashtag)) {
          return {
            ok: false,
            error: "Hashtag inválida. Use 2–32 caracteres (a-z, 0-9, _).",
          };
        }
        if (RESERVED_HASHTAGS.has(hashtag)) {
          return {
            ok: false,
            error: `#${hashtag} é reservada aos assuntos oficiais do staff.`,
          };
        }

        const existing = get().communities;
        if (existing.some((c) => normalizeHashtag(c.hashtag) === hashtag)) {
          return {
            ok: false,
            error: `A hashtag #${hashtag} já está em uso por outro assunto.`,
          };
        }

        let baseSlug = slugify(name);
        let slug = baseSlug;
        let n = 2;
        while (existing.some((c) => c.slug === slug)) {
          slug = `${baseSlug.slice(0, 40)}-${n}`;
          n += 1;
        }

        const access: CommunityAccess =
          input.access === "vip" ? "vip" : "everyone";
        const icon = COMMUNITY_ICONS.includes(
          input.icon as CommunityIconName
        )
          ? input.icon
          : "UsersThree";

        const community: Community = {
          id: uid("com"),
          name,
          slug,
          description,
          hashtag,
          members: 1,
          posts: 0,
          icon,
          color: "#1f1f1f",
          vipOnly: access === "vip",
          access,
          tagPolicy: "everyone",
          source: "member",
          creatorId: input.creatorId,
          creatorName: input.creatorName,
          createdAt: new Date().toISOString(),
        };

        set((s) => ({
          communities: mergeWithStaff([community, ...s.communities]),
        }));
        return { ok: true, community };
      },

      getBySlug: (slug) => get().communities.find((c) => c.slug === slug),
      getById: (id) => get().communities.find((c) => c.id === id),
      getByHashtag: (tag) => {
        const t = normalizeHashtag(tag);
        return get().communities.find(
          (c) => normalizeHashtag(c.hashtag) === t
        );
      },
      setPostCount: (communityId, count) => {
        set((s) => ({
          communities: s.communities.map((c) =>
            c.id === communityId ? { ...c, posts: Math.max(0, count) } : c
          ),
        }));
      },
    }),
    {
      name: "nullysh-communities",
      version: STORAGE_VERSION,
      partialize: (s) => ({ communities: s.communities }),
      migrate: (persisted) => {
        const p = (persisted || {}) as { communities?: Community[] };
        const cleaned = (p.communities || [])
          .map((c) => normalizeCommunity(c as Community))
          .filter((c): c is Community => !!c);
        return {
          communities: mergeWithStaff(cleaned),
        } as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<CommunityState> | undefined;
        const cleaned = (p?.communities || current.communities)
          .map((c) => normalizeCommunity(c))
          .filter((c): c is Community => !!c);
        return {
          ...current,
          ...p,
          communities: mergeWithStaff(cleaned),
        };
      },
    }
  )
);
