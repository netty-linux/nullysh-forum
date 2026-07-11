import type {
  ChatChannel,
  ChatMessage,
  Community,
  Material,
  Post,
  Video,
} from "./types";

export const VIP_PLAN = {
  name: "Plano VIP",
  price: 47,
  currency: "BRL",
  period: "mês",
  features: [
    "Acesso a todos os vídeos e tutoriais",
    "Comunidades exclusivas Nullysh",
    "Materiais, templates e checklists",
    "Cursos e metodologias",
    "Bate-papo VIP em tempo real",
    "Notícias e ferramentas de IA",
    "Rede social da comunidade",
  ],
} as const;

/**
 * @deprecated Use `useCommunityStore` / `STAFF_COMMUNITIES`.
 * Mantido só para a landing marketing (lista estática oficial).
 */
export const communities: Community[] = [
  {
    id: "staff_anuncios",
    name: "Anúncios Oficiais",
    slug: "anuncios-oficiais",
    description: "Comunicados oficiais. Hashtag #staff (só admin).",
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
    description: "Conversas abertas. Marque #geral.",
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
    description: "Sala VIP. Marque #vips — só VIP marca e lê.",
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

/** Posts seed removidos — o feed começa limpo; só conteúdo real dos membros. */
export const posts: Post[] = [];

export const videos: Video[] = [];

export const materials: Material[] = [
  {
    id: "m1",
    title: "Checklist de validação de oferta",
    description: "Passo a passo de 7 dias para testar demanda real.",
    type: "checklist",
    category: "Negócios",
    size: "240 KB",
    vipOnly: true,
    downloads: 412,
    createdAt: "2026-06-18T10:00:00.000Z",
  },
  {
    id: "m2",
    title: "Pack de prompts para copy",
    description: "Biblioteca de prompts para headlines, VSL e emails.",
    type: "template",
    category: "IA",
    size: "1.2 MB",
    vipOnly: true,
    downloads: 890,
    createdAt: "2026-06-25T10:00:00.000Z",
  },
  {
    id: "m3",
    title: "Template Figma - Landing Minimal",
    description: "Layout white minimalist com grid editorial pronto.",
    type: "template",
    category: "Design",
    size: "8.4 MB",
    vipOnly: true,
    downloads: 567,
    createdAt: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "m4",
    title: "Guia gratuito: primeiros passos",
    description: "Como navegar no forum e tirar o máximo do plano free.",
    type: "pdf",
    category: "Introdução",
    size: "680 KB",
    vipOnly: false,
    downloads: 2104,
    createdAt: "2026-06-10T10:00:00.000Z",
  },
  {
    id: "m5",
    title: "Curso: Nullysh Ops",
    description: "Sistema de operação semanal para criadores e founders.",
    type: "course",
    category: "Metodologia",
    vipOnly: true,
    downloads: 334,
    createdAt: "2026-07-03T10:00:00.000Z",
  },
  {
    id: "m6",
    title: "Diretório de ferramentas",
    description: "Lista curada de IAs, analytics e builders recomendados.",
    type: "link",
    category: "Ferramentas",
    vipOnly: true,
    downloads: 721,
    createdAt: "2026-07-06T10:00:00.000Z",
  },
];

export const chatChannels: ChatChannel[] = [
  {
    id: "ch1",
    name: "lobby",
    description: "Sala aberta para todos os membros",
    vipOnly: false,
  },
  {
    id: "ch2",
    name: "vip-geral",
    description: "Chat exclusivo do Plano VIP",
    vipOnly: true,
  },
  {
    id: "ch3",
    name: "builds",
    description: "Mostre o que está construindo",
    vipOnly: true,
  },
  {
    id: "ch4",
    name: "ajuda",
    description: "Tire dúvidas com a comunidade",
    vipOnly: false,
  },
];

/** Chat seed removido — salas começam vazias. */
export const initialChatMessages: ChatMessage[] = [];

export function toPublicUser<T extends { password: string }>(user: T) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
}
