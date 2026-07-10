/**
 * Ranqueamento do feed:
 * - Qualidade: maior % de dislike → pior posição
 * - Volume: log de engajamento
 * - Freshness: meia-vida suave
 * - Launch window: posts novos sobem ao topo por um curto período
 *   (mesmo neutros) para terem chance de engajamento
 */

import type { Post } from "./types";

/** Minutos em que posts novos têm prioridade alta no topo */
export const LAUNCH_WINDOW_MINUTES = 25;
/** Primeiros minutos com boost máximo (quase garantido no topo) */
const LAUNCH_PEAK_MINUTES = 8;
/**
 * Boost aditivo no pico — supera posts com bom engajamento antigo
 * (ex.: 1000L/300D ≈ score ~3–4 sem launch).
 */
const LAUNCH_BOOST_MAX = 14;

function likesOf(p: Post): number {
  return Math.max(0, p.likes ?? 0);
}

function dislikesOf(p: Post): number {
  return Math.max(0, p.dislikes ?? 0);
}

function ageMinutes(createdAt: string, now: number): number {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - t) / 60_000);
}

/**
 * Qualidade Bayesian (Laplace): (L+1)/(L+D+2)
 * - 0/0 → 0.5 (neutro)
 * - 10L/5D → ≈0.65
 * - 1000L/300D → ≈0.77
 */
export function postQualityScore(likes: number, dislikes: number): number {
  const L = Math.max(0, likes);
  const D = Math.max(0, dislikes);
  return (L + 1) / (L + D + 2);
}

/** % de dislikes entre as reações (0–1). */
export function postDislikeRatio(likes: number, dislikes: number): number {
  const n = likes + dislikes;
  if (n === 0) return 0;
  return dislikes / n;
}

/**
 * Volume em log: mais engajamento conta, sem esmagar.
 * 0 reações → 1; 15 → ~2.2; 1300 → ~4.1
 */
export function postVolumeScore(likes: number, dislikes: number): number {
  return Math.log10(likes + dislikes + 1) + 1;
}

/**
 * Freshness suave (meia-vida ~10h) — mantém posts recentes competitivos
 * depois da janela de lançamento.
 */
export function postFreshnessScore(createdAt: string, now = Date.now()): number {
  const ageH = ageMinutes(createdAt, now) / 60;
  if (!Number.isFinite(ageH)) return 1;
  return 1 + 1.4 * Math.exp(-ageH / 10);
}

/**
 * Boost de lançamento (aditivo):
 * - 0–8 min: boost máximo → sobe ao topo mesmo neutro
 * - 8–25 min: decai linearmente até 0
 * - depois: só qualidade × volume × freshness
 *
 * Posts com muitos dislikes ainda sofrem na qualidade, mas
 * o launch dá a “vitrine” inicial para engajar.
 */
export function postLaunchBoost(createdAt: string, now = Date.now()): number {
  const ageMin = ageMinutes(createdAt, now);
  if (ageMin >= LAUNCH_WINDOW_MINUTES) return 0;

  // 0–8 min: boost máximo → chance clara no topo
  if (ageMin <= LAUNCH_PEAK_MINUTES) {
    return LAUNCH_BOOST_MAX;
  }

  // 8–25 min: decai linearmente até 0
  const t =
    (ageMin - LAUNCH_PEAK_MINUTES) /
    (LAUNCH_WINDOW_MINUTES - LAUNCH_PEAK_MINUTES);
  return Math.max(0, LAUNCH_BOOST_MAX * (1 - t));
}

/**
 * Score final (maior = mais no topo).
 * base = qualidade × volume × freshness
 * total = base + launchBoost
 */
export function postRankScore(post: Post, now = Date.now()): number {
  const L = likesOf(post);
  const D = dislikesOf(post);
  const quality = postQualityScore(L, D);
  const volume = postVolumeScore(L, D);
  const fresh = postFreshnessScore(post.createdAt, now);
  const launch = postLaunchBoost(post.createdAt, now);
  return quality * volume * fresh + launch;
}

/**
 * true se o post ainda está na janela de “vitrine” no topo.
 * (útil para UI / debug)
 */
export function isInLaunchWindow(createdAt: string, now = Date.now()): boolean {
  return ageMinutes(createdAt, now) < LAUNCH_WINDOW_MINUTES;
}

/** Ordena posts do feed (melhor score primeiro; empate → mais recente). */
export function rankFeedPosts(posts: Post[], now = Date.now()): Post[] {
  return [...posts].sort((a, b) => {
    const sa = postRankScore(a, now);
    const sb = postRankScore(b, now);
    if (sb !== sa) return sb - sa;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
