/**
 * Sistema de emblemas / conquistas Nullysh.
 * Todos salvos na conta; apenas 1 equipado e visível no perfil.
 */

import type { Post, User, UserPublic } from "./types";

export type EmblemCategory =
  | "revenue"
  | "title"
  | "role"
  | "tenure"
  | "special"
  | "rank";

export type EmblemId =
  | "revenue-500"
  | "revenue-1k"
  | "revenue-5k"
  | "revenue-10k"
  | "revenue-50k"
  | "revenue-100k"
  | "title-mestre"
  | "title-grao-mestre"
  | "title-desafiante"
  | "title-lendario"
  | "title-divino"
  | "title-soberano"
  | "role-moderador"
  | "role-vip"
  | "role-suporte"
  | "role-mentor"
  | "role-elite"
  | "role-admin"
  | "tenure-1m"
  | "tenure-6m"
  | "tenure-1y"
  | "tenure-2y"
  | "tenure-5y"
  | "tenure-10y"
  | "special-top-autor"
  | "special-mais-ativo"
  | "special-evento"
  | "special-criador-ideias"
  | "special-viral"
  | "special-lendario"
  | "rank-ferro"
  | "rank-bronze"
  | "rank-prata"
  | "rank-ouro"
  | "rank-platina"
  | "rank-diamante";

export type EmblemDef = {
  id: EmblemId;
  name: string;
  category: EmblemCategory;
  description: string;
  src: string;
};

const CAT_LABEL: Record<EmblemCategory, string> = {
  revenue: "Faturamento",
  title: "Títulos",
  role: "Função",
  tenure: "Tempo de casa",
  special: "Especiais",
  rank: "Rank",
};

export function emblemCategoryLabel(c: EmblemCategory): string {
  return CAT_LABEL[c];
}

function e(
  id: EmblemId,
  name: string,
  category: EmblemCategory,
  description: string
): EmblemDef {
  return {
    id,
    name,
    category,
    description,
    src: `/brand/emblems/${id}.png`,
  };
}

export const EMBLEMS: EmblemDef[] = [
  // Faturamento
  e("revenue-500", "R$500", "revenue", "Alcançou R$500 de faturamento"),
  e("revenue-1k", "R$1k", "revenue", "Alcançou R$1.000 de faturamento"),
  e("revenue-5k", "R$5k", "revenue", "Alcançou R$5.000 de faturamento"),
  e("revenue-10k", "R$10k", "revenue", "Alcançou R$10.000 de faturamento"),
  e("revenue-50k", "R$50k", "revenue", "Alcançou R$50.000 de faturamento"),
  e("revenue-100k", "R$100k", "revenue", "Alcançou R$100.000 de faturamento"),
  // Títulos
  e("title-mestre", "Mestre", "title", "Título de Mestre na comunidade"),
  e("title-grao-mestre", "Grão-Mestre", "title", "Título de Grão-Mestre"),
  e("title-desafiante", "Desafiante", "title", "Título Desafiante"),
  e("title-lendario", "Lendário", "title", "Título Lendário"),
  e("title-divino", "Divino", "title", "Título Divino"),
  e("title-soberano", "Soberano", "title", "Título Soberano"),
  // Função
  e("role-moderador", "Moderador", "role", "Moderador da comunidade"),
  e("role-vip", "VIP", "role", "Membro do Plano VIP"),
  e("role-suporte", "Suporte", "role", "Equipe de suporte"),
  e("role-mentor", "Mentor", "role", "Oferece mentoria na comunidade"),
  e("role-elite", "Elite", "role", "Membro Elite"),
  e("role-admin", "Admin", "role", "Administrador Nullysh"),
  // Tempo
  e("tenure-1m", "1 Mês", "tenure", "1 mês na Nullysh Forum"),
  e("tenure-6m", "6 Meses", "tenure", "6 meses na comunidade"),
  e("tenure-1y", "1 Ano", "tenure", "1 ano de casa"),
  e("tenure-2y", "2 Anos", "tenure", "2 anos de casa"),
  e("tenure-5y", "5 Anos", "tenure", "5 anos de casa"),
  e("tenure-10y", "10 Anos", "tenure", "10 anos de casa"),
  // Especiais
  e("special-top-autor", "Top Autor", "special", "Entre os autores mais curtidos"),
  e(
    "special-mais-ativo",
    "Mais Ativo",
    "special",
    "Alta atividade de publicações"
  ),
  e("special-evento", "Evento Especial", "special", "Participou de evento especial"),
  e(
    "special-criador-ideias",
    "Criador de Ideias",
    "special",
    "Compartilha ideias e discussões"
  ),
  e("special-viral", "Viral", "special", "Teve um post com alto engajamento"),
  e(
    "special-lendario",
    "Lendário",
    "special",
    "Conquista especial lendária de engajamento"
  ),
  // Ranks
  e("rank-ferro", "Ferro", "rank", "Rank Ferro de engajamento"),
  e("rank-bronze", "Bronze", "rank", "Rank Bronze de engajamento"),
  e("rank-prata", "Prata", "rank", "Rank Prata de engajamento"),
  e("rank-ouro", "Ouro", "rank", "Rank Ouro de engajamento"),
  e("rank-platina", "Platina", "rank", "Rank Platina de engajamento"),
  e("rank-diamante", "Diamante", "rank", "Rank Diamante de engajamento"),
];

const BY_ID = new Map(EMBLEMS.map((x) => [x.id, x]));

export function getEmblem(id: string | null | undefined): EmblemDef | null {
  if (!id) return null;
  return BY_ID.get(id as EmblemId) ?? null;
}

export function isEmblemId(v: unknown): v is EmblemId {
  return typeof v === "string" && BY_ID.has(v as EmblemId);
}

export function emblemsByCategory(): {
  category: EmblemCategory;
  label: string;
  items: EmblemDef[];
}[] {
  const order: EmblemCategory[] = [
    "role",
    "tenure",
    "rank",
    "special",
    "title",
    "revenue",
  ];
  return order.map((category) => ({
    category,
    label: CAT_LABEL[category],
    items: EMBLEMS.filter((e) => e.category === category),
  }));
}

function monthsSince(iso: string, now = Date.now()): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / (1000 * 60 * 60 * 24 * 30.44));
}

export type BadgeStats = {
  /** Soma de likes nos posts do user */
  totalLikes: number;
  /** Total de posts */
  postCount: number;
  /** Maior likes em um único post */
  bestPostLikes: number;
  /** Faturamento (admin / futuro) */
  revenueBrl?: number;
  /** Flags manuais (eventos etc.) */
  flags?: string[];
};

export function computeBadgeStats(
  userId: string,
  posts: Post[]
): BadgeStats {
  const mine = posts.filter((p) => p.authorId === userId);
  let totalLikes = 0;
  let bestPostLikes = 0;
  for (const p of mine) {
    const L = p.likes ?? 0;
    totalLikes += L;
    if (L > bestPostLikes) bestPostLikes = L;
  }
  return {
    totalLikes,
    postCount: mine.length,
    bestPostLikes,
  };
}

/**
 * Avalia conquistas desbloqueadas (não remove as já salvas).
 */
export function evaluateEmblems(
  user: Pick<
    User | UserPublic,
    | "id"
    | "role"
    | "isVip"
    | "createdAt"
    | "offeringMentorship"
    | "badgesUnlocked"
  >,
  stats: BadgeStats
): EmblemId[] {
  const unlocked = new Set<EmblemId>(
    (user.badgesUnlocked ?? []).filter(isEmblemId)
  );

  // Roles
  if (user.role === "admin") {
    unlocked.add("role-admin");
    unlocked.add("role-elite");
    unlocked.add("role-vip");
  }
  if (user.isVip || user.role === "vip" || user.role === "admin") {
    unlocked.add("role-vip");
  }
  if (user.offeringMentorship) unlocked.add("role-mentor");

  // Tenure
  const m = monthsSince(user.createdAt);
  if (m >= 1) unlocked.add("tenure-1m");
  if (m >= 6) unlocked.add("tenure-6m");
  if (m >= 12) unlocked.add("tenure-1y");
  if (m >= 24) unlocked.add("tenure-2y");
  if (m >= 60) unlocked.add("tenure-5y");
  if (m >= 120) unlocked.add("tenure-10y");

  // Revenue (manual / campo futuro)
  const rev = stats.revenueBrl ?? 0;
  if (rev >= 500) unlocked.add("revenue-500");
  if (rev >= 1_000) unlocked.add("revenue-1k");
  if (rev >= 5_000) unlocked.add("revenue-5k");
  if (rev >= 10_000) unlocked.add("revenue-10k");
  if (rev >= 50_000) unlocked.add("revenue-50k");
  if (rev >= 100_000) unlocked.add("revenue-100k");

  // Engagement ranks
  const likes = stats.totalLikes;
  if (likes >= 1) unlocked.add("rank-ferro");
  if (likes >= 25) unlocked.add("rank-bronze");
  if (likes >= 80) unlocked.add("rank-prata");
  if (likes >= 200) unlocked.add("rank-ouro");
  if (likes >= 500) unlocked.add("rank-platina");
  if (likes >= 1200) unlocked.add("rank-diamante");

  // Specials
  if (stats.postCount >= 5) unlocked.add("special-criador-ideias");
  if (stats.postCount >= 15) unlocked.add("special-mais-ativo");
  if (stats.bestPostLikes >= 50) unlocked.add("special-viral");
  if (stats.totalLikes >= 300) unlocked.add("special-top-autor");
  if (stats.totalLikes >= 800) unlocked.add("special-lendario");

  // Titles ladder by total likes
  if (likes >= 40) unlocked.add("title-mestre");
  if (likes >= 100) unlocked.add("title-grao-mestre");
  if (likes >= 180) unlocked.add("title-desafiante");
  if (likes >= 350) unlocked.add("title-lendario");
  if (likes >= 600) unlocked.add("title-divino");
  if (likes >= 1000) unlocked.add("title-soberano");

  // Flags manuais
  for (const f of stats.flags ?? []) {
    if (f === "evento" || f === "special-evento") unlocked.add("special-evento");
    if (f === "moderador" || f === "role-moderador")
      unlocked.add("role-moderador");
    if (f === "suporte" || f === "role-suporte") unlocked.add("role-suporte");
    if (f === "elite" || f === "role-elite") unlocked.add("role-elite");
  }

  return Array.from(unlocked);
}

export function normalizeBadgesUnlocked(raw: unknown): EmblemId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEmblemId);
}

export function normalizeBadgeEquipped(
  raw: unknown,
  unlocked: EmblemId[]
): EmblemId | null {
  if (!isEmblemId(raw)) return null;
  if (!unlocked.includes(raw)) return null;
  return raw;
}
