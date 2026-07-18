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
  supabaseSetVip,
  supabaseUpdateProfile,
} from "./supabase/auth-service";
import {
  normalizeBannerFit,
  type ProfileUpdate,
  type User,
  type UserPublic,
} from "./types";
import {
  isGhostUser,
} from "./ghost-data";
import {
  initials,
  isValidUsername,
  normalizeUsername,
  suggestUsernameFromEmail,
  uid,
  usernameValidationError,
} from "./utils";

export type { ProfileUpdate };

const AUTH_STORAGE_KEY = "nullysh-auth";
/** v2: remove contas seed fantasmas quando Supabase está ativo */
const AUTH_STORAGE_VERSION = 2;

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

/**
 * Seeds só para dev offline (sem Supabase).
 * Credenciais fictícias vivem em dev-seed-users.ts (nunca em produção).
 * FIX #6 — OWASP A07
 */
function loadLocalSeedUsers(): User[] {
  if (isSupabaseConfigured()) return [];
  if (process.env.NODE_ENV === "production") return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./dev-seed-users") as {
      LOCAL_SEED_USERS: User[];
    };
    return mod.LOCAL_SEED_USERS;
  } catch {
    return [];
  }
}

const SEED_USERS: User[] = loadLocalSeedUsers();

function normalizeUser(
  raw: Partial<User> & Pick<User, "id" | "name" | "email">
): User {
  const isAdmin = raw.role === "admin" || raw.email === "admin@nullysh.com";
  const email = (raw.email || "").trim().toLowerCase();
  const fromField = raw.username ? normalizeUsername(raw.username) : "";
  // Aceita handles já gravados (incl. seeds como @nullysh); reserva só bloqueia na edição.
  const username =
    fromField && /^[a-z0-9_]{3,24}$/.test(fromField)
      ? fromField
      : suggestUsernameFromEmail(email || "user");
  return {
    id: raw.id,
    name: raw.name,
    username,
    email,
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

/** Garante @ único no store local (suffix numérico se colidir) */
function allocateUsername(
  desired: string,
  excludeUserId?: string,
  existing: User[] = []
): string {
  let base = normalizeUsername(desired);
  if (!isValidUsername(base)) {
    base = suggestUsernameFromEmail(base || "user");
  }
  const taken = (u: string) =>
    existing.some(
      (x) =>
        x.id !== excludeUserId &&
        normalizeUsername(x.username || "") === u
    );
  if (!taken(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 20)}_${i}`.slice(0, 24);
    if (isValidUsername(candidate) && !taken(candidate)) return candidate;
  }
  return `user_${uid("").slice(-8)}`;
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
  /**
   * Upsert de perfis públicos sem apagar o catálogo existente.
   * Essencial para modal de seguidores / menções quando o bridge
   * carrega só o user atual em falhas parciais de rede.
   */
  mergePublicUsers: (incoming: UserPublic[]) => void;
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
  /** Admin: doa ou revoga VIP em outro membro */
  setVip: (
    userId: string,
    vip: boolean
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  getCurrentUser: () => UserPublic | null;
  getUserById: (id: string) => UserPublic | null;
}

function publicToUser(p: UserPublic): User {
  return normalizeUser({ ...p, password: "" });
}

/** Mescla perfis remotos no catálogo local (remote vence campos de perfil). */
function mergeUserCatalog(
  existing: User[],
  incoming: UserPublic[]
): User[] {
  const map = new Map<string, User>();
  for (const u of existing) {
    map.set(u.id, u);
  }
  for (const p of incoming) {
    if (!p?.id) continue;
    const next = publicToUser(p);
    const prev = map.get(p.id);
    if (!prev) {
      map.set(p.id, next);
      continue;
    }
    map.set(p.id, {
      ...prev,
      ...next,
      // senha local só existe no modo offline
      password: prev.password || next.password || "",
      // se remote veio sem mídia, não apaga a local
      avatarUrl: next.avatarUrl ?? prev.avatarUrl,
      bannerUrl: next.bannerUrl ?? prev.bannerUrl,
      bannerFit: next.bannerFit ?? prev.bannerFit,
    });
  }
  return Array.from(map.values());
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      currentUserId: null,
      hydrated: false,
      remoteMode: isSupabaseConfigured(),
      setHydrated: (v) => set({ hydrated: v }),

      mergePublicUsers: (incoming) => {
        if (!incoming?.length) return;
        set((s) => ({
          users: mergeUserCatalog(s.users, incoming).filter(
            (u) => !isGhostUser(u)
          ),
        }));
      },

      applyRemoteSession: ({ currentUser, users }) => {
        // Logout explícito (SIGNED_OUT / INITIAL_SESSION sem JWT)
        if (!currentUser) {
          set((s) => ({
            remoteMode: true,
            // Mescla perfis públicos recebidos; NÃO zera o catálogo
            // (senão some quem te segue e o modal fica vazio).
            users: (
              users.length > 0
                ? mergeUserCatalog(s.users, users)
                : s.users
            ).filter((u) => !isGhostUser(u)),
            currentUserId: null,
          }));
          return;
        }

        // Login / refresh: mescla catálogo + garante o user atual.
        // Antes: `users: mapped` apagava todo mundo se fetchAllProfiles
        // falhasse ou viesse parcial → followersOf ok, mas modal filtrava tudo.
        set((s) => {
          const base =
            users.length > 0
              ? mergeUserCatalog(s.users, users)
              : mergeUserCatalog(s.users, [currentUser]);
          const withMe = mergeUserCatalog(base, [currentUser]).filter(
            (u) => !isGhostUser(u)
          );
          return {
            remoteMode: true,
            users: withMe,
            currentUserId: currentUser.id,
          };
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
        const username = allocateUsername(
          suggestUsernameFromEmail(normalized),
          undefined,
          get().users
        );
        const user: User = {
          id: uid("user"),
          name: name.trim(),
          username,
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

        // AppSec: strip campos privilegiados mesmo se o caller passar cast sujo
        const safeData = { ...data } as ProfileUpdate & {
          isVip?: unknown;
          role?: unknown;
          isVerified?: unknown;
        };
        delete (safeData as { isVip?: unknown }).isVip;
        delete (safeData as { role?: unknown }).role;
        delete (safeData as { isVerified?: unknown }).isVerified;

        if (isSupabaseConfigured()) {
          const result = await supabaseUpdateProfile(id, safeData);
          if (!result.ok) return result;
          // Garante emblemas no user retornado (colunas podem não existir no DB ainda)
          const withBadges = {
            ...result.user,
            badgesUnlocked:
              safeData.badgesUnlocked ??
              result.user.badgesUnlocked ??
              get().users.find((u) => u.id === id)?.badgesUnlocked ??
              [],
            badgeEquipped:
              safeData.badgeEquipped !== undefined
                ? safeData.badgeEquipped
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

        if (safeData.email) {
          const normalized = safeData.email.trim().toLowerCase();
          const taken = get().users.some(
            (u) => u.email === normalized && u.id !== id
          );
          if (taken) return { ok: false, error: "Este e-mail já está em uso." };
        }

        if (safeData.username !== undefined) {
          const err = usernameValidationError(safeData.username);
          if (err) return { ok: false, error: err };
          const handle = normalizeUsername(safeData.username);
          const taken = get().users.some(
            (u) =>
              u.id !== id &&
              normalizeUsername(u.username || "") === handle
          );
          if (taken) {
            return { ok: false, error: "Este @ já está em uso. Escolha outro." };
          }
        }

        let updated: User | null = null;
        set((s) => ({
          users: s.users.map((raw) => {
            const u = normalizeUser(raw);
            if (u.id !== id) return u;

            const nextName = safeData.name?.trim() ?? u.name;
            const nextUsername =
              safeData.username !== undefined
                ? normalizeUsername(safeData.username)
                : u.username;
            updated = {
              ...u,
              name: nextName,
              username: nextUsername,
              bio: safeData.bio !== undefined ? safeData.bio : u.bio,
              email: safeData.email?.trim().toLowerCase() ?? u.email,
              // isVip / role / isVerified: nunca alteráveis por self-update
              password:
                safeData.password && safeData.password.length >= 6
                  ? safeData.password
                  : u.password,
              avatar: initials(nextName) || u.avatar,
              avatarUrl:
                safeData.avatarUrl !== undefined
                  ? safeData.avatarUrl
                  : u.avatarUrl,
              bannerUrl:
                safeData.bannerUrl !== undefined
                  ? safeData.bannerUrl
                  : u.bannerUrl,
              bannerFit:
                safeData.bannerFit !== undefined
                  ? normalizeBannerFit(safeData.bannerFit)
                  : u.bannerFit,
              avatarFrame: (() => {
                // Free não mantém moldura VIP
                if (!u.isVip && u.role !== "admin") return null;
                if (safeData.avatarFrame === undefined) return u.avatarFrame;
                if (safeData.avatarFrame === null) return null;
                return isAvatarFrameId(safeData.avatarFrame)
                  ? safeData.avatarFrame
                  : null;
              })(),
              interests:
                safeData.interests !== undefined
                  ? safeData.interests
                  : u.interests,
              goals: safeData.goals !== undefined ? safeData.goals : u.goals,
              seekingMentorship:
                safeData.seekingMentorship !== undefined
                  ? safeData.seekingMentorship
                  : u.seekingMentorship,
              offeringMentorship:
                safeData.offeringMentorship !== undefined
                  ? safeData.offeringMentorship
                  : u.offeringMentorship,
              mentorTopics:
                safeData.mentorTopics !== undefined
                  ? safeData.mentorTopics
                  : u.mentorTopics,
              links: safeData.links !== undefined ? safeData.links : u.links,
              favoriteTracks: (() => {
                if (!u.isVip && u.role !== "admin") return [];
                if (safeData.favoriteTracks === undefined)
                  return u.favoriteTracks;
                return normalizeFavoriteTracks(safeData.favoriteTracks).slice(
                  0,
                  6
                );
              })(),
              badgesUnlocked: (() => {
                if (safeData.badgesUnlocked === undefined)
                  return u.badgesUnlocked;
                return normalizeBadgesUnlocked(safeData.badgesUnlocked);
              })(),
              badgeEquipped: (() => {
                const unlocked =
                  safeData.badgesUnlocked !== undefined
                    ? normalizeBadgesUnlocked(safeData.badgesUnlocked)
                    : u.badgesUnlocked;
                if (safeData.badgeEquipped === undefined) {
                  return normalizeBadgeEquipped(u.badgeEquipped, unlocked);
                }
                if (safeData.badgeEquipped === null) return null;
                return normalizeBadgeEquipped(
                  safeData.badgeEquipped,
                  unlocked
                );
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

      setVip: async (userId, vip) => {
        const target = get().users.find((u) => u.id === userId);
        if (target?.role === "admin") {
          return {
            ok: false,
            error: "Contas admin já têm acesso total.",
          };
        }

        if (isSupabaseConfigured()) {
          const result = await supabaseSetVip(userId, vip);
          if (!result.ok) return result;
          set((s) => ({
            users: s.users.map((raw) => {
              const u = normalizeUser(raw);
              if (u.id !== userId) return u;
              return publicToUser(result.user);
            }),
          }));
          // se o catálogo local não tinha o user, injeta
          if (!get().users.some((u) => u.id === userId)) {
            get().mergePublicUsers([result.user]);
          }
          return { ok: true };
        }

        // Modo local / demo sem Supabase
        set((s) => ({
          users: s.users.map((raw) => {
            const u = normalizeUser(raw);
            if (u.id !== userId) return u;
            if (u.role === "admin") return u;
            return {
              ...u,
              isVip: vip,
              role: vip ? "vip" : "member",
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
        return { ok: true };
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
      version: AUTH_STORAGE_VERSION,
      storage: createJSONStorage(() => authStateStorage),
      partialize: (s) => ({
        users: s.users,
        currentUserId: s.currentUserId,
      }),
      migrate: (persisted) => {
        const p = persisted as {
          state?: { users?: User[]; currentUserId?: string | null };
          users?: User[];
          currentUserId?: string | null;
        } | null;
        if (!p) return p as never;
        // Zustand passa o state parcial (não o envelope {state,version})
        const rawUsers = Array.isArray(p.users)
          ? p.users
          : Array.isArray(p.state?.users)
            ? p.state!.users!
            : [];
        const users = rawUsers.filter((u) => !isGhostUser(u as User));
        const currentUserId =
          p.currentUserId ?? p.state?.currentUserId ?? null;
        const stillValid =
          currentUserId && users.some((u) => u.id === currentUserId)
            ? currentUserId
            : currentUserId && isGhostUser({ id: currentUserId })
              ? null
              : currentUserId;
        return {
          users,
          currentUserId: stillValid,
        } as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState> | undefined;
        let users = (p?.users ?? current.users)
          .map((u) => normalizeUser(u as User))
          .filter((u) => !isGhostUser(u));

        // Só injeta seeds no modo 100% local (sem Supabase)
        if (!isSupabaseConfigured()) {
          const ids = new Set(users.map((u) => u.id));
          for (const seed of SEED_USERS) {
            if (!ids.has(seed.id)) users.push(seed);
          }
          users = users.map((u) => {
            const seed = SEED_USERS.find((s) => s.id === u.id);
            const withHandle = normalizeUser({
              ...u,
              username:
                u.username && isValidUsername(u.username)
                  ? u.username
                  : seed?.username || suggestUsernameFromEmail(u.email),
            });
            if (!seed) return withHandle;
            return {
              ...withHandle,
              avatarUrl: withHandle.avatarUrl ?? seed.avatarUrl,
              bannerUrl: withHandle.bannerUrl ?? seed.bannerUrl,
              bannerFit: withHandle.bannerFit ?? seed.bannerFit,
              interests: withHandle.interests.length
                ? withHandle.interests
                : seed.interests,
              goals: withHandle.goals.length ? withHandle.goals : seed.goals,
              seekingMentorship:
                withHandle.seekingMentorship || seed.seekingMentorship,
              offeringMentorship:
                withHandle.offeringMentorship || seed.offeringMentorship,
              mentorTopics: withHandle.mentorTopics.length
                ? withHandle.mentorTopics
                : seed.mentorTopics,
              role:
                withHandle.id === "admin" ||
                withHandle.email === "admin@nullysh.com"
                  ? ("admin" as const)
                  : withHandle.role,
              isVerified:
                withHandle.id === "admin" ||
                withHandle.email === "admin@nullysh.com"
                  ? true
                  : withHandle.isVerified,
              isVip:
                withHandle.id === "admin" ||
                withHandle.email === "admin@nullysh.com"
                  ? true
                  : withHandle.isVip,
            };
          });
        }

        let currentUserId = p?.currentUserId ?? current.currentUserId;
        if (
          currentUserId &&
          (isGhostUser({ id: currentUserId }) ||
            !users.some((u) => u.id === currentUserId))
        ) {
          // Com Supabase o bridge restaura a sessão; local offline zera se fantasma
          if (!isSupabaseConfigured()) currentUserId = null;
        }

        return {
          ...current,
          ...p,
          users,
          currentUserId,
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
