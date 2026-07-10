"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { isAvatarFrameId } from "./avatar-frames";
import {
  evaluateEmblems,
  isEmblemId,
  normalizeBadgeEquipped,
  normalizeBadgesUnlocked,
  type EmblemId,
} from "./emblems";
import {
  hydrateUserMedia,
  isDataUrl,
  offloadUserMedia,
} from "./media-storage";
import { normalizeFavoriteTracks } from "./music";
import { isSupabaseConfigured } from "./supabase/config";
import {
  fetchAllProfiles,
  supabaseActivateVip,
  supabaseLogin,
  supabaseLogout,
  supabaseRegister,
  supabaseSetVerified,
  supabaseUpdateProfile,
} from "./supabase/auth-service";
import {
  normalizeBannerFit,
  type ProfileUpdate,
  type User,
  type UserPublic,
} from "./types";
import { initials, uid } from "./utils";

export type { ProfileUpdate };

const AUTH_STORAGE_KEY = "nullysh-auth";

/**
 * Persistência híbrida:
 * - metadados em localStorage
 * - avatar/banner (data URLs / GIFs grandes) em IndexedDB
 * Evita QuotaExceededError do localStorage (~5MB).
 */
const authStateStorage: StateStorage = {
  getItem: async (name): Promise<string | null> => {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        state?: { users?: User[]; currentUserId?: string | null };
        version?: number;
      };

      if (parsed?.state?.users && Array.isArray(parsed.state.users)) {
        // Migra data URLs antigos → IDB na leitura
        const withRefs = await offloadUserMedia(parsed.state.users);
        // Se havia data: no localStorage, regrava versão leve
        const hadData = parsed.state.users.some(
          (u) => isDataUrl(u.avatarUrl) || isDataUrl(u.bannerUrl)
        );
        if (hadData) {
          try {
            localStorage.setItem(
              name,
              JSON.stringify({ ...parsed, state: { ...parsed.state, users: withRefs } })
            );
          } catch {
            /* ignore */
          }
        }
        parsed.state.users = await hydrateUserMedia(withRefs);
        return JSON.stringify(parsed);
      }

      return raw;
    } catch {
      // Storage corrompido / estourado — tenta limpar e recomeçar
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
      return null;
    }
  },

  setItem: async (name, value): Promise<void> => {
    try {
      const parsed = JSON.parse(value) as {
        state?: { users?: User[]; currentUserId?: string | null };
        version?: number;
      };

      if (parsed?.state?.users && Array.isArray(parsed.state.users)) {
        parsed.state.users = await offloadUserMedia(parsed.state.users);
      }

      const light = JSON.stringify(parsed);
      try {
        localStorage.setItem(name, light);
      } catch {
        // Último recurso: remove mídia inline restante e tenta de novo
        if (parsed?.state?.users) {
          parsed.state.users = parsed.state.users.map((u) => ({
            ...u,
            avatarUrl:
              isDataUrl(u.avatarUrl) || !u.avatarUrl
                ? null
                : u.avatarUrl?.startsWith("idb:")
                  ? u.avatarUrl
                  : null,
            bannerUrl:
              isDataUrl(u.bannerUrl) || !u.bannerUrl
                ? null
                : u.bannerUrl?.startsWith("idb:")
                  ? u.bannerUrl
                  : null,
          }));
        }
        try {
          localStorage.setItem(name, JSON.stringify(parsed));
        } catch (err) {
          console.error(
            "[nullysh-auth] localStorage cheio mesmo após offload. Mídia está no IndexedDB.",
            err
          );
          // Não relança: estado em memória já está ok
        }
      }
    } catch (err) {
      console.error("[nullysh-auth] falha ao persistir", err);
    }
  },

  removeItem: (name): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

/** Migração imediata se a chave já estiver gigante (antes do 1º save) */
function tryMigrateBloatedAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw || raw.length < 2_000_000) return; // ~2MB+
    void (async () => {
      try {
        const parsed = JSON.parse(raw) as {
          state?: { users?: User[] };
        };
        if (!parsed?.state?.users) return;
        const lightUsers = await offloadUserMedia(parsed.state.users);
        parsed.state.users = lightUsers;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      } catch (e) {
        console.warn("[nullysh-auth] migração de cota falhou", e);
        try {
          // last resort: wipe auth storage so app works again
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {
          /* ignore */
        }
      }
    })();
  } catch {
    /* ignore */
  }
}

tryMigrateBloatedAuthStorage();

const SEED_USERS: User[] = [
  {
    id: "admin",
    name: "Nullysh",
    email: "admin@nullysh.com",
    password: "admin123",
    bio: "Fundador da comunidade Nullysh. Conteúdo, metodologia e operação.",
    avatar: "N",
    avatarUrl: null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: "nullysh",
    role: "admin",
    isVip: true,
    isVerified: true,
    interests: ["IA", "Negócios Digitais", "Comunidade", "Marketing", "Copy"],
    goals: ["Quero escalar a comunidade Nullysh", "Quero formar experts em IA"],
    seekingMentorship: false,
    offeringMentorship: true,
    mentorTopics: ["IA", "Negócios Digitais", "Comunidade", "Marketing"],
    links: [{ id: "l_admin", label: "Site", url: "https://nullysh.com" }],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "demo",
    name: "Membro Demo",
    email: "demo@nullysh.com",
    password: "demo123",
    bio: "Conta de demonstração do MVP.",
    avatar: "D",
    avatarUrl: null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: null,
    role: "member",
    isVip: false,
    isVerified: false,
    interests: ["IA", "Programação"],
    goals: ["Quero ser um expert em IA"],
    seekingMentorship: true,
    offeringMentorship: false,
    mentorTopics: [],
    links: [],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "u2",
    name: "Marina Costa",
    email: "marina@nullysh.com",
    password: "demo123",
    bio: "Automação, agentes de IA e sistemas de conteúdo.",
    avatar: "M",
    avatarUrl: null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: "spring",
    role: "vip",
    isVip: true,
    isVerified: true,
    interests: ["IA", "Automação", "Produtividade", "Conteúdo"],
    goals: ["Quero dominar automação com agentes"],
    seekingMentorship: false,
    offeringMentorship: true,
    mentorTopics: ["IA", "Automação", "Produtividade"],
    links: [
      { id: "l_marina", label: "LinkedIn", url: "https://linkedin.com" },
    ],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
  },
  {
    id: "u3",
    name: "Rafael Menezes",
    email: "rafael@nullysh.com",
    password: "demo123",
    bio: "Ofertas, funis e validação de produtos digitais.",
    avatar: "R",
    avatarUrl: null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: "summer",
    role: "vip",
    isVip: true,
    isVerified: false,
    interests: ["Negócios Digitais", "Vendas", "Copy", "Programação"],
    goals: ["Quero lançar um produto digital"],
    seekingMentorship: false,
    offeringMentorship: true,
    mentorTopics: ["Negócios Digitais", "Vendas", "Copy"],
    links: [],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
  },
  {
    id: "u4",
    name: "Ana Beatriz",
    email: "ana@nullysh.com",
    password: "demo123",
    bio: "Cursos, info produtos e networking.",
    avatar: "A",
    avatarUrl: null,
    bannerUrl: null,
    bannerFit: null,
    avatarFrame: null,
    role: "member",
    isVip: false,
    isVerified: false,
    interests: ["Conteúdo", "Marketing", "Comunidade"],
    goals: ["Quero divulgar meu conteúdo com consistência"],
    seekingMentorship: true,
    offeringMentorship: false,
    mentorTopics: [],
    links: [],
    favoriteTracks: [],
    badgesUnlocked: [],
    badgeEquipped: null,
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  },
];

function normalizeUser(
  raw: Partial<User> & Pick<User, "id" | "name" | "email">
): User {
  const isAdmin = raw.role === "admin" || raw.email === "admin@nullysh.com";
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    password: raw.password ?? "",
    bio: raw.bio ?? "",
    avatar: raw.avatar || initials(raw.name) || "U",
    avatarUrl: raw.avatarUrl ?? null,
    bannerUrl: raw.bannerUrl ?? null,
    bannerFit: normalizeBannerFit(raw.bannerFit),
    avatarFrame: isAvatarFrameId(raw.avatarFrame) ? raw.avatarFrame : null,
    role: isAdmin ? "admin" : (raw.role ?? "member"),
    isVip: raw.isVip ?? false,
    isVerified: isAdmin ? true : (raw.isVerified ?? false),
    interests: Array.isArray(raw.interests) ? raw.interests : [],
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    seekingMentorship: raw.seekingMentorship ?? false,
    offeringMentorship: raw.offeringMentorship ?? false,
    mentorTopics: Array.isArray(raw.mentorTopics) ? raw.mentorTopics : [],
    links: Array.isArray(raw.links)
      ? raw.links
          .filter((l) => l && typeof l.url === "string" && l.url.trim())
          .map((l) => ({
            id: l.id || uid("link"),
            label: (l.label || "").trim(),
            url: l.url.trim(),
          }))
      : [],
    favoriteTracks: normalizeFavoriteTracks(raw.favoriteTracks),
    badgesUnlocked: normalizeBadgesUnlocked(raw.badgesUnlocked),
    badgeEquipped: normalizeBadgeEquipped(
      raw.badgeEquipped,
      normalizeBadgesUnlocked(raw.badgesUnlocked)
    ),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function stripPassword(user: User): UserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
}

interface AuthState {
  users: User[];
  currentUserId: string | null;
  hydrated: boolean;
  /** true quando NEXT_PUBLIC_SUPABASE_ANON_KEY está setada */
  remoteMode: boolean;
  setHydrated: (v: boolean) => void;
  /** Sincroniza sessão remota (Supabase) no store local */
  applyRemoteSession: (payload: {
    currentUser: UserPublic | null;
    users: UserPublic[];
  }) => void;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) =>
    | Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }>
    | { ok: true; user: UserPublic }
    | { ok: false; error: string };
  login: (
    email: string,
    password: string
  ) =>
    | Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }>
    | { ok: true; user: UserPublic }
    | { ok: false; error: string };
  logout: () => void | Promise<void>;
  updateProfile: (
    data: ProfileUpdate
  ) =>
    | Promise<{ ok: true; user: UserPublic } | { ok: false; error: string }>
    | { ok: true; user: UserPublic }
    | { ok: false; error: string };
  deleteAccount: () => { ok: true } | { ok: false; error: string };
  activateVip: () => void | Promise<void>;
  setVerified: (
    userId: string,
    verified: boolean
  ) => void | Promise<void>;
  getCurrentUser: () => UserPublic | null;
  getUserById: (id: string) => UserPublic | null;
}

function publicToUser(p: UserPublic): User {
  return normalizeUser({ ...p, password: "" });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      currentUserId: null,
      hydrated: false,
      remoteMode: isSupabaseConfigured(),
      setHydrated: (v) => set({ hydrated: v }),

      applyRemoteSession: ({ currentUser, users }) => {
        const mapped = users.map(publicToUser);

        // Logout explícito (SIGNED_OUT / INITIAL_SESSION sem JWT)
        if (!currentUser) {
          set({
            remoteMode: true,
            users: mapped,
            currentUserId: null,
          });
          return;
        }

        // Login / refresh: nunca perde o user atual
        const nextUsers =
          mapped.length > 0 ? [...mapped] : [publicToUser(currentUser)];
        if (!nextUsers.some((u) => u.id === currentUser.id)) {
          nextUsers.unshift(publicToUser(currentUser));
        }
        set({
          remoteMode: true,
          users: nextUsers,
          currentUserId: currentUser.id,
        });
      },

      register: async ({ name, email, password }) => {
        if (isSupabaseConfigured()) {
          const result = await supabaseRegister({ name, email, password });
          if (!result.ok) return result;
          const profiles = await fetchAllProfiles();
          get().applyRemoteSession({
            currentUser: result.user,
            users: profiles.length ? profiles : [result.user],
          });
          return result;
        }

        const normalized = email.trim().toLowerCase();
        if (!name.trim() || !normalized || !password) {
          return { ok: false, error: "Preencha todos os campos." };
        }
        if (password.length < 6) {
          return {
            ok: false,
            error: "A senha precisa ter no mínimo 6 caracteres.",
          };
        }
        const exists = get().users.some((u) => u.email === normalized);
        if (exists) {
          return { ok: false, error: "Este e-mail já está cadastrado." };
        }
        const now = new Date().toISOString();
        const user: User = {
          id: uid("user"),
          name: name.trim(),
          email: normalized,
          password,
          bio: "",
          avatar: initials(name.trim()) || "U",
          avatarUrl: null,
          bannerUrl: null,
          bannerFit: null,
          avatarFrame: null,
          role: "member",
          isVip: false,
          isVerified: false,
          interests: [],
          goals: [],
          seekingMentorship: false,
          offeringMentorship: false,
          mentorTopics: [],
          links: [],
          favoriteTracks: [],
          badgesUnlocked: [],
          badgeEquipped: null,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          users: [...s.users, user],
          currentUserId: user.id,
        }));
        return { ok: true, user: stripPassword(user) };
      },

      login: async (email, password) => {
        if (isSupabaseConfigured()) {
          const result = await supabaseLogin(email, password);
          if (!result.ok) return result;
          const profiles = await fetchAllProfiles();
          get().applyRemoteSession({
            currentUser: result.user,
            users: profiles.length ? profiles : [result.user],
          });
          return result;
        }

        const normalized = email.trim().toLowerCase();
        const user = get().users.find(
          (u) => u.email === normalized && u.password === password
        );
        if (!user) {
          return { ok: false, error: "E-mail ou senha incorretos." };
        }
        set({ currentUserId: user.id });
        return { ok: true, user: stripPassword(normalizeUser(user)) };
      },

      logout: async () => {
        if (isSupabaseConfigured()) {
          await supabaseLogout();
        }
        set({ currentUserId: null });
      },

      updateProfile: async (data) => {
        const id = get().currentUserId;
        if (!id) return { ok: false, error: "Você precisa estar logado." };

        if (isSupabaseConfigured()) {
          const result = await supabaseUpdateProfile(id, data);
          if (!result.ok) return result;
          // Garante emblemas no user retornado (colunas podem não existir no DB ainda)
          const withBadges = {
            ...result.user,
            badgesUnlocked:
              data.badgesUnlocked ??
              result.user.badgesUnlocked ??
              get().users.find((u) => u.id === id)?.badgesUnlocked ??
              [],
            badgeEquipped:
              data.badgeEquipped !== undefined
                ? data.badgeEquipped
                : result.user.badgeEquipped ??
                  get().users.find((u) => u.id === id)?.badgeEquipped ??
                  null,
          };
          set((s) => ({
            users: s.users.map((u) =>
              u.id === id ? publicToUser(withBadges) : u
            ),
          }));
          // refresh lista — preserva emblemas do currentUser
          void fetchAllProfiles().then((profiles) => {
            if (profiles.length) {
              const users = profiles.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      badgesUnlocked: withBadges.badgesUnlocked,
                      badgeEquipped: withBadges.badgeEquipped,
                    }
                  : p
              );
              get().applyRemoteSession({
                currentUser: withBadges,
                users,
              });
            }
          });
          return { ok: true, user: withBadges };
        }

        if (data.email) {
          const normalized = data.email.trim().toLowerCase();
          const taken = get().users.some(
            (u) => u.email === normalized && u.id !== id
          );
          if (taken) return { ok: false, error: "Este e-mail já está em uso." };
        }

        let updated: User | null = null;
        set((s) => ({
          users: s.users.map((raw) => {
            const u = normalizeUser(raw);
            if (u.id !== id) return u;

            const nextName = data.name?.trim() ?? u.name;
            updated = {
              ...u,
              name: nextName,
              bio: data.bio !== undefined ? data.bio : u.bio,
              email: data.email?.trim().toLowerCase() ?? u.email,
              password:
                data.password && data.password.length >= 6
                  ? data.password
                  : u.password,
              avatar: initials(nextName) || u.avatar,
              avatarUrl:
                data.avatarUrl !== undefined ? data.avatarUrl : u.avatarUrl,
              bannerUrl:
                data.bannerUrl !== undefined ? data.bannerUrl : u.bannerUrl,
              bannerFit:
                data.bannerFit !== undefined
                  ? normalizeBannerFit(data.bannerFit)
                  : u.bannerFit,
              avatarFrame: (() => {
                // Free não mantém moldura VIP
                if (!u.isVip && u.role !== "admin") return null;
                if (data.avatarFrame === undefined) return u.avatarFrame;
                if (data.avatarFrame === null) return null;
                return isAvatarFrameId(data.avatarFrame)
                  ? data.avatarFrame
                  : null;
              })(),
              interests:
                data.interests !== undefined ? data.interests : u.interests,
              goals: data.goals !== undefined ? data.goals : u.goals,
              seekingMentorship:
                data.seekingMentorship !== undefined
                  ? data.seekingMentorship
                  : u.seekingMentorship,
              offeringMentorship:
                data.offeringMentorship !== undefined
                  ? data.offeringMentorship
                  : u.offeringMentorship,
              mentorTopics:
                data.mentorTopics !== undefined
                  ? data.mentorTopics
                  : u.mentorTopics,
              links: data.links !== undefined ? data.links : u.links,
              favoriteTracks: (() => {
                if (!u.isVip && u.role !== "admin") return [];
                if (data.favoriteTracks === undefined) return u.favoriteTracks;
                return normalizeFavoriteTracks(data.favoriteTracks).slice(0, 6);
              })(),
              badgesUnlocked: (() => {
                if (data.badgesUnlocked === undefined) return u.badgesUnlocked;
                return normalizeBadgesUnlocked(data.badgesUnlocked);
              })(),
              badgeEquipped: (() => {
                const unlocked =
                  data.badgesUnlocked !== undefined
                    ? normalizeBadgesUnlocked(data.badgesUnlocked)
                    : u.badgesUnlocked;
                if (data.badgeEquipped === undefined) {
                  return normalizeBadgeEquipped(u.badgeEquipped, unlocked);
                }
                if (data.badgeEquipped === null) return null;
                return normalizeBadgeEquipped(data.badgeEquipped, unlocked);
              })(),
              updatedAt: new Date().toISOString(),
            };
            return updated;
          }),
        }));
        if (!updated) return { ok: false, error: "Usuário não encontrado." };
        return { ok: true, user: stripPassword(updated) };
      },

      deleteAccount: () => {
        const id = get().currentUserId;
        if (!id) return { ok: false, error: "Você precisa estar logado." };
        if (id === "admin") {
          return {
            ok: false,
            error: "A conta admin não pode ser excluída no MVP.",
          };
        }
        set((s) => ({
          users: s.users.filter((u) => u.id !== id),
          currentUserId: null,
        }));
        return { ok: true };
      },

      activateVip: async () => {
        const id = get().currentUserId;
        if (!id) return;

        if (isSupabaseConfigured()) {
          const result = await supabaseActivateVip(id);
          if (result.ok) {
            set((s) => ({
              users: s.users.map((u) =>
                u.id === id ? publicToUser(result.user) : u
              ),
            }));
          }
          return;
        }

        set((s) => ({
          users: s.users.map((raw) => {
            const u = normalizeUser(raw);
            if (u.id !== id) return u;
            return {
              ...u,
              isVip: true,
              role: u.role === "admin" ? "admin" : "vip",
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      setVerified: async (userId, verified) => {
        if (isSupabaseConfigured()) {
          await supabaseSetVerified(userId, verified);
        }
        set((s) => ({
          users: s.users.map((raw) => {
            const u = normalizeUser(raw);
            if (u.id !== userId) return u;
            return {
              ...u,
              isVerified: verified,
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      getCurrentUser: () => {
        const id = get().currentUserId;
        if (!id) return null;
        const user = get().users.find((u) => u.id === id);
        return user ? stripPassword(normalizeUser(user)) : null;
      },

      getUserById: (id) => {
        const user = get().users.find((u) => u.id === id);
        return user ? stripPassword(normalizeUser(user)) : null;
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => authStateStorage),
      partialize: (s) => ({
        users: s.users,
        currentUserId: s.currentUserId,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState> | undefined;
        const users = (p?.users ?? current.users).map((u) =>
          normalizeUser(u as User)
        );
        const ids = new Set(users.map((u) => u.id));
        for (const seed of SEED_USERS) {
          if (!ids.has(seed.id)) users.push(seed);
        }
        // merge seed enrichment for empty interests on known ids (soft upgrade)
        const enriched = users.map((u) => {
          const seed = SEED_USERS.find((s) => s.id === u.id);
          if (!seed) return u;
          return {
            ...u,
            // preserva mídia já hidratada do IDB / local
            avatarUrl: u.avatarUrl ?? seed.avatarUrl,
            bannerUrl: u.bannerUrl ?? seed.bannerUrl,
            bannerFit: u.bannerFit ?? seed.bannerFit,
            interests: u.interests.length ? u.interests : seed.interests,
            goals: u.goals.length ? u.goals : seed.goals,
            seekingMentorship: u.seekingMentorship || seed.seekingMentorship,
            offeringMentorship: u.offeringMentorship || seed.offeringMentorship,
            mentorTopics: u.mentorTopics.length
              ? u.mentorTopics
              : seed.mentorTopics,
            role:
              u.id === "admin" || u.email === "admin@nullysh.com"
                ? ("admin" as const)
                : u.role,
            isVerified:
              u.id === "admin" || u.email === "admin@nullysh.com"
                ? true
                : u.isVerified,
            isVip:
              u.id === "admin" || u.email === "admin@nullysh.com"
                ? true
                : u.isVip,
          };
        });
        return {
          ...current,
          ...p,
          users: enriched,
          currentUserId: p?.currentUserId ?? current.currentUserId,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Auth rehydrate failed", error);
        }
        // Com Supabase, a sessão real vem da bridge (INITIAL_SESSION).
        // Marcar hydrated aqui fazia o AuthGuard ver user=null e deslogar
        // antes do Supabase restaurar o JWT.
        if (!isSupabaseConfigured()) {
          state?.setHydrated(true);
        }
      },
    }
  )
);
