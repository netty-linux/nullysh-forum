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

export interface TrailStep {
  id: string;
  title: string;
  description: string;
  type: TrailStepType;
  duration?: string;
}

export interface LearningTrail {
  id: string;
  title: string;
  description: string;
  level: TrailLevel;
  interestTags: string[];
  steps: TrailStep[];
  /** true = só VIP acessa a trilha completa */
  vipOnly: boolean;
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

export interface ForumEvent {
  id: string;
  title: string;
  description: string;
  type: "live" | "workshop" | "networking" | "ama";
  startsAt: string;
  durationMin: number;
  hostName: string;
  interestTags: string[];
  vipOnly: boolean;
  capacity: number;
}

export const FORUM_EVENTS: ForumEvent[] = [
  {
    id: "ev1",
    title: "Live: Funis enxutos com um plano VIP",
    description:
      "Como estruturar oferta única, CTA e handoff sem confusão de tiers.",
    type: "live",
    startsAt: "2026-07-18T20:00:00.000Z",
    durationMin: 60,
    hostName: "Nullysh",
    interestTags: ["Negócios Digitais", "Marketing", "Vendas"],
    vipOnly: true,
    capacity: 120,
  },
  {
    id: "ev2",
    title: "Workshop: agentes de IA no fluxo semanal",
    description: "Monte um agente que pesquisa, resume e entrega brief.",
    type: "workshop",
    startsAt: "2026-07-22T19:00:00.000Z",
    durationMin: 90,
    hostName: "Nullysh · IA",
    interestTags: ["IA", "Automação", "Produtividade"],
    vipOnly: true,
    capacity: 40,
  },
  {
    id: "ev3",
    title: "Networking aberto: mostre o que está construindo",
    description: "Sala aberta para pitch de 2 min e feedback da galera.",
    type: "networking",
    startsAt: "2026-07-15T21:00:00.000Z",
    durationMin: 75,
    hostName: "Comunidade",
    interestTags: ["Comunidade", "Negócios digitais", "Conteúdo"],
    vipOnly: false,
    capacity: 200,
  },
  {
    id: "ev4",
    title: "AMA: conteúdo e mídia",
    description: "Perguntas e respostas sobre nicho, formato e monetização.",
    type: "ama",
    startsAt: "2026-07-25T18:30:00.000Z",
    durationMin: 45,
    hostName: "Nullysh · Conteúdo",
    interestTags: ["Conteúdo", "Marketing", "Comunidade"],
    vipOnly: false,
    capacity: 80,
  },
  {
    id: "ev5",
    title: "Office hours de programação",
    description: "Tire dúvidas de stack, arquitetura e ship de MVPs.",
    type: "workshop",
    startsAt: "2026-07-28T20:00:00.000Z",
    durationMin: 60,
    hostName: "Nullysh · Tech",
    interestTags: ["Programação", "IA", "Automação"],
    vipOnly: true,
    capacity: 30,
  },
];

export function interestOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => setB.has(x.toLowerCase()));
}
