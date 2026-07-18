/**
 * ⚠️ ARQUIVO DE DESENVOLVIMENTO — não usar em produção
 * Senhas são fictícias e apenas para teste local sem Supabase.
 * FIX #6 — OWASP A07
 */

if (process.env.NODE_ENV === "production") {
  throw new Error("dev-seed-users.ts não deve ser carregado em produção");
}

import type { User } from "./types";

export const LOCAL_SEED_USERS: User[] = [
  {
    id: "admin",
    name: "Nullysh",
    username: "nullysh",
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
    username: "demo",
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
];
