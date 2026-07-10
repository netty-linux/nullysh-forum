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

export interface TrailStep {
  id: string;
  title: string;
  description: string;
  type: "video" | "material" | "practice" | "live";
  duration?: string;
}

export interface LearningTrail {
  id: string;
  title: string;
  description: string;
  level: "iniciante" | "intermediário" | "avançado";
  interestTags: string[];
  steps: TrailStep[];
  vipOnly: boolean;
}

export const LEARNING_TRAILS: LearningTrail[] = [
  {
    id: "trail-ia-fundamentos",
    title: "Fundamentos de IA na prática",
    description:
      "Do zero ao uso diário de modelos, prompts e fluxos com método Nullysh.",
    level: "iniciante",
    interestTags: ["IA", "Automação", "Produtividade"],
    vipOnly: false,
    steps: [
      {
        id: "s1",
        title: "Mapa mental da IA em 2026",
        description: "Visão geral do ecossistema e o que priorizar.",
        type: "video",
        duration: "12 min",
      },
      {
        id: "s2",
        title: "Prompt engineering enxuto",
        description: "Templates reutilizáveis para copy e operação.",
        type: "practice",
        duration: "25 min",
      },
      {
        id: "s3",
        title: "Pack de prompts (Materials)",
        description: "Baixe e adapte a biblioteca da comunidade.",
        type: "material",
      },
      {
        id: "s4",
        title: "Primeiro agente no dia a dia",
        description: "Monte um fluxo simples e meça resultado.",
        type: "practice",
        duration: "40 min",
      },
    ],
  },
  {
    id: "trail-negocio-digital",
    title: "Oferta e validação em 7 dias",
    description:
      "Trilha para validar demanda real sem gastar com anúncio no começo.",
    level: "intermediário",
    interestTags: ["Negócios Digitais", "Marketing", "Copy", "Vendas"],
    vipOnly: true,
    steps: [
      {
        id: "n1",
        title: "Dor e avatar",
        description: "Pesquisa de dor e entrevistas rápidas.",
        type: "practice",
        duration: "1h",
      },
      {
        id: "n2",
        title: "Landing minimalista",
        description: "Estrutura white minimalist com CTA único.",
        type: "video",
        duration: "32 min",
      },
      {
        id: "n3",
        title: "Checklist de validação",
        description: "Use o material da área de Materials.",
        type: "material",
      },
      {
        id: "n4",
        title: "Live de pricing",
        description: "Assista a gravação e defina o plano único.",
        type: "live",
        duration: "45 min",
      },
    ],
  },
  {
    id: "trail-conteudo",
    title: "Conteúdo que distribui e converte",
    description:
      "Para quem quer divulgar conteúdo (nicho, futebol, tech) com consistência.",
    level: "iniciante",
    interestTags: ["Conteúdo", "Marketing", "Comunidade"],
    vipOnly: false,
    steps: [
      {
        id: "c1",
        title: "Posicionamento em uma frase",
        description: "Defina o que você publica e para quem.",
        type: "practice",
        duration: "20 min",
      },
      {
        id: "c2",
        title: "Calendário semanal mínimo",
        description: "3 formatos que cabem na rotina.",
        type: "video",
        duration: "18 min",
      },
      {
        id: "c3",
        title: "Distribuição e comunidade",
        description: "Como usar o Forum para amplificar.",
        type: "practice",
        duration: "30 min",
      },
    ],
  },
  {
    id: "trail-dev",
    title: "Programação aplicada a produtos",
    description: "Stack leve, ship rápido e integração com IAs.",
    level: "intermediário",
    interestTags: ["Programação", "IA", "Automação"],
    vipOnly: true,
    steps: [
      {
        id: "d1",
        title: "Arquitetura enxuta",
        description: "Next, stores e deploy mental model.",
        type: "video",
        duration: "28 min",
      },
      {
        id: "d2",
        title: "CRUD e auth local → real",
        description: "Como evoluir o MVP sem reescrever tudo.",
        type: "practice",
        duration: "1h",
      },
      {
        id: "d3",
        title: "Ship checklist",
        description: "Checklist de qualidade antes de publicar.",
        type: "material",
      },
    ],
  },
];

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
