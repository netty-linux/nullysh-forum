"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserPublic } from "./types";
import { initials, uid } from "./utils";

const SEED_USERS: User[] = [
  {
    id: "admin",
    name: "Nullysh",
    email: "admin@nullysh.com",
    password: "admin123",
    bio: "Fundador da comunidade Nullysh. Conteúdo, metodologia e operação.",
    avatar: "N",
    role: "admin",
    isVip: true,
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
    role: "member",
    isVip: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
];

function stripPassword(user: User): UserPublic {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
}

interface AuthState {
  users: User[];
  currentUserId: string | null;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => { ok: true; user: UserPublic } | { ok: false; error: string };
  login: (
    email: string,
    password: string
  ) => { ok: true; user: UserPublic } | { ok: false; error: string };
  logout: () => void;
  updateProfile: (
    data: Partial<Pick<User, "name" | "bio" | "email" | "password">>
  ) => { ok: true; user: UserPublic } | { ok: false; error: string };
  deleteAccount: () => { ok: true } | { ok: false; error: string };
  activateVip: () => void;
  getCurrentUser: () => UserPublic | null;
  getUserById: (id: string) => UserPublic | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: SEED_USERS,
      currentUserId: null,
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),

      register: ({ name, email, password }) => {
        const normalized = email.trim().toLowerCase();
        if (!name.trim() || !normalized || !password) {
          return { ok: false, error: "Preencha todos os campos." };
        }
        if (password.length < 6) {
          return { ok: false, error: "A senha precisa ter no mínimo 6 caracteres." };
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
          role: "member",
          isVip: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          users: [...s.users, user],
          currentUserId: user.id,
        }));
        return { ok: true, user: stripPassword(user) };
      },

      login: (email, password) => {
        const normalized = email.trim().toLowerCase();
        const user = get().users.find(
          (u) => u.email === normalized && u.password === password
        );
        if (!user) {
          return { ok: false, error: "E-mail ou senha incorretos." };
        }
        set({ currentUserId: user.id });
        return { ok: true, user: stripPassword(user) };
      },

      logout: () => set({ currentUserId: null }),

      updateProfile: (data) => {
        const id = get().currentUserId;
        if (!id) return { ok: false, error: "Você precisa estar logado." };

        if (data.email) {
          const normalized = data.email.trim().toLowerCase();
          const taken = get().users.some(
            (u) => u.email === normalized && u.id !== id
          );
          if (taken) return { ok: false, error: "Este e-mail já está em uso." };
        }

        let updated: User | null = null;
        set((s) => ({
          users: s.users.map((u) => {
            if (u.id !== id) return u;
            updated = {
              ...u,
              name: data.name?.trim() ?? u.name,
              bio: data.bio ?? u.bio,
              email: data.email?.trim().toLowerCase() ?? u.email,
              password: data.password && data.password.length >= 6 ? data.password : u.password,
              avatar: data.name?.trim() ? initials(data.name.trim()) : u.avatar,
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
          return { ok: false, error: "A conta admin não pode ser excluída no MVP." };
        }
        set((s) => ({
          users: s.users.filter((u) => u.id !== id),
          currentUserId: null,
        }));
        return { ok: true };
      },

      activateVip: () => {
        const id = get().currentUserId;
        if (!id) return;
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? {
                  ...u,
                  isVip: true,
                  role: u.role === "admin" ? "admin" : "vip",
                  updatedAt: new Date().toISOString(),
                }
              : u
          ),
        }));
      },

      getCurrentUser: () => {
        const id = get().currentUserId;
        if (!id) return null;
        const user = get().users.find((u) => u.id === id);
        return user ? stripPassword(user) : null;
      },

      getUserById: (id) => {
        const user = get().users.find((u) => u.id === id);
        return user ? stripPassword(user) : null;
      },
    }),
    {
      name: "nullysh-auth",
      partialize: (s) => ({
        users: s.users,
        currentUserId: s.currentUserId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Auth rehydrate failed", error);
        }
        state?.setHydrated(true);
      },
    }
  )
);
