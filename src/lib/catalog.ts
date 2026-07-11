/** Catálogo de interesses, objetivos, trilhas e eventos (MVP). */

export const INTEREST_OPTIONS = [
  "IA",
  "Programação",
  "Design",
  "Marketing",
  "Copy",
  "Negócios Digitais",
  "Automação",
  "Conteúdo",
  "Finanças",
  "Comunidade",
  "Produtividade",
  "Vendas",
] as const;

export type InterestTag = (typeof INTEREST_OPTIONS)[number] | string;

/** Placeholder de exemplo no input de objetivo (não é lista clicável) */
export const GOAL_PLACEHOLDER =
  "Ex.: Quero ser um expert em IA";

export const MAX_GOALS = 3;

/** Limite de links na bio por plano */
export const MAX_PROFILE_LINKS_FREE = 1;
export const MAX_PROFILE_LINKS_VIP = 6;

export function maxProfileLinks(isVip: boolean) {
  return isVip ? MAX_PROFILE_LINKS_VIP : MAX_PROFILE_LINKS_FREE;
}

export type TrailStepType = "video" | "material" | "practice" | "live";
export type TrailLevel = "iniciante" | "intermediário" | "avançado";

/** Link personalizado na trilha ou etapa */
export interface TrailLink {
  id: string;
  label: string;
  url: string;
}

/**
 * Anexo (arquivo). Conteúdo pesado fica em IndexedDB (`storageKey`);
 * metadata fica no store persistido.
 */
export interface TrailAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** Ref IndexedDB `idb:trail-attach:…` ou data URL pequena */
  storageKey: string;
}

export interface TrailStep {
  id: string;
  title: string;
  description: string;
  type: TrailStepType;
  duration?: string;
  /** Vídeo da página /app/videos (deep-link) */
  videoId?: string | null;
  videoTitle?: string | null;
  links?: TrailLink[];
  attachments?: TrailAttachment[];
}

export interface LearningTrail {
  id: string;
  title: string;
  /**
   * Descrição em HTML (editor rico estilo Substack).
   * Versões antigas podem ser texto puro.
   */
  description: string;
  level: TrailLevel;
  interestTags: string[];
  steps: TrailStep[];
  /** true = só VIP acessa a trilha completa */
  vipOnly: boolean;
  /** Recursos da trilha (além das etapas) */
  links?: TrailLink[];
  attachments?: TrailAttachment[];
  /** Admin/staff que publicou */
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Seeds estáticos removidos — trilhas vêm do `useTrailStore`
 * (criadas no Painel ADM). Mantido vazio por compat.
 */
export const LEARNING_TRAILS: LearningTrail[] = [];

export type ForumEventType = "live" | "workshop" | "networking" | "ama";

export interface ForumEvent {
  id: string;
  title: string;
  description: string;
  type: ForumEventType;
  startsAt: string;
  durationMin: number;
  hostName: string;
  interestTags: string[];
  vipOnly: boolean;
  capacity: number;
  createdById?: string;
  createdByName?: string;
  createdAt?: string;
}

/**
 * Seeds estáticos removidos — eventos vêm do `useEventStore`
 * (criados no Painel ADM). Mantido vazio por compat.
 */
export const FORUM_EVENTS: ForumEvent[] = [];

export function interestOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => setB.has(x.toLowerCase()));
}
