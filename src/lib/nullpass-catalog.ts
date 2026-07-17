/**
 * NullPass — cofre de benefícios VIP (tom Vault).
 *
 * Linguagem consciente:
 * - Benefícios do clube / acessos gerenciados (não "contas piratas").
 * - Catálogo seed + store admin (localStorage) abastecem a vitrine.
 */

export type NullpassBadge = "novo" | "custo-membro" | "limitado" | null;

/** Capa vertical Netflix (cards 2:3) */
export const NULLPASS_COVER_RECOMMENDED = {
  width: 600,
  height: 900,
  aspect: "2:3",
  label: "600 × 900 px (proporção 2:3)",
  hint: "Poster vertical. JPG/PNG/WebP · ideal ~600×900. Upload grava no R2; a vitrine usa /api/nullpass/cover/…",
} as const;

export type NullpassProductKind = "single" | "combo";

export type NullpassProduct = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  badge?: NullpassBadge;
  /** single = 1 benefício · combo = pacote de vários */
  kind?: NullpassProductKind;
  /** IDs dos produtos inclusos no combo */
  bundleIds?: string[];
  /**
   * Order bumps oferecidos neste checkout (IDs de outros produtos).
   * Tipicamente itens marcados como bump elegíveis.
   */
  orderBumpIds?: string[];
  /** Pode ser oferecido como order bump em outros produtos */
  isOrderBump?: boolean;
  /** Gradiente CSS de fallback se não houver capa */
  posterGradient: string;
  /** Capa (URL https ou data URL) — opcional · ideal 600×900 */
  coverUrl?: string | null;
  monogram: string;
  description: string;
  /**
   * Preço cheio em BRL (ex.: 19.9). Null = só usa priceLabel.
   */
  price?: number | null;
  /** Preço promocional (exibe riscado o price se promoActive) */
  promoPrice?: number | null;
  promoActive?: boolean;
  /** Ex.: "Custo membro" — se vazio e price set, formata R$ */
  priceLabel: string;
  priceHint?: string;
  features: string[];
  vipFulfillmentNote: string;
  /** false = oculto na vitrine (só admin vê no painel) */
  active?: boolean;
  sortOrder?: number;
  /**
   * Fixado no carrossel "Em destaque" da vitrine.
   * Independente de badge (novo / custo-membro / limitado).
   */
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const NULLPASS_BADGE_LABEL: Record<
  Exclude<NullpassBadge, null>,
  string
> = {
  novo: "Novo",
  "custo-membro": "Custo membro",
  limitado: "Vagas limitadas",
};

export const NULLPASS_ROW_ORDER = [
  "Design & criativo",
  "Produtividade",
  "IA & automação",
  "Marketing",
] as const;

export const NULLPASS_CATEGORIES = [
  ...NULLPASS_ROW_ORDER,
  "Outros",
] as const;

export const NULLPASS_GRADIENTS = [
  "linear-gradient(145deg, #0f766e 0%, #115e59 40%, #042f2e 100%)",
  "linear-gradient(160deg, #4c1d95 0%, #6d28d9 45%, #1e1b4b 100%)",
  "linear-gradient(150deg, #171717 0%, #404040 50%, #0a0a0a 100%)",
  "linear-gradient(135deg, #ea580c 0%, #c2410c 40%, #431407 100%)",
  "linear-gradient(145deg, #065f46 0%, #10b981 35%, #022c22 100%)",
  "linear-gradient(160deg, #1e3a8a 0%, #3b82f6 40%, #0c1445 100%)",
  "linear-gradient(150deg, #9a3412 0%, #ea580c 45%, #431407 100%)",
  "linear-gradient(145deg, #334155 0%, #64748b 40%, #0f172a 100%)",
  "linear-gradient(155deg, #7c3aed 0%, #a78bfa 40%, #2e1065 100%)",
] as const;

/** Seed inicial (primeira visita / store vazio). */
export const NULLPASS_SEED: NullpassProduct[] = [
  {
    id: "canva-pro",
    title: "Canva Pro",
    tagline: "Design sem freio para o dia a dia",
    category: "Design & criativo",
    badge: "custo-membro",
    posterGradient: NULLPASS_GRADIENTS[0],
    monogram: "C",
    description:
      "Benefício do clube para criação de peças, posts e apresentações com recursos Pro. Acesso gerenciado pela equipe Nullysh — sem links públicos.",
    price: null,
    priceLabel: "Custo membro",
    priceHint: "Abaixo do valor de prateleira",
    features: [
      "Recursos Pro do ecossistema Canva",
      "Foco em creators e operação de conteúdo",
      "Solicitação com fila VIP e entrega assistida",
    ],
    vipFulfillmentNote:
      "Abra o bate-papo com o staff (DM) e informe o ID do benefício. A liberação é feita de forma gerenciada — nunca compartilhe senhas em canais públicos.",
    active: true,
    sortOrder: 10,
    isPinned: true,
  },
  {
    id: "capcut-pro",
    title: "CapCut Pro",
    tagline: "Edição rápida para reels e shorts",
    category: "Design & criativo",
    badge: "novo",
    posterGradient: NULLPASS_GRADIENTS[1],
    monogram: "CC",
    description:
      "Pacote de edição para quem produz vídeo curto. Acesso como benefício VIP, com orientação de uso responsável dentro das políticas da ferramenta.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Export e efeitos pro fluxo de short-form",
      "Ideal para social e mentoria de conteúdo",
      "Entrega via processo interno do clube",
    ],
    vipFulfillmentNote:
      "Solicite no DM do staff com o nome do benefício. Prazo típico em dias úteis, conforme fila.",
    active: true,
    sortOrder: 20,
    isPinned: true,
  },
  {
    id: "notion-plus",
    title: "Notion Plus",
    tagline: "Workspace organizado para o time",
    category: "Produtividade",
    badge: "custo-membro",
    posterGradient: NULLPASS_GRADIENTS[2],
    monogram: "N",
    description:
      "Espaço de notas e docs para operar projetos com mais clareza. Benefício estruturado para membros VIP.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Docs, bases e templates de operação",
      "Encaixa em rotina de builders e agências",
      "Ativação assistida pelo staff",
    ],
    vipFulfillmentNote:
      "Peça no bate-papo VIP/staff citando «Notion Plus». Você receberá o próximo passo de ativação no privado.",
    active: true,
    sortOrder: 30,
  },
  {
    id: "figma-seat",
    title: "Figma (seat)",
    tagline: "UI/UX com colaborações leves",
    category: "Design & criativo",
    badge: "limitado",
    posterGradient: NULLPASS_GRADIENTS[3],
    monogram: "F",
    description:
      "Seat gerenciado para prototipação e handoff. Vagas limitadas por ciclo.",
    price: null,
    priceLabel: "Custo membro",
    priceHint: "Sujeito a disponibilidade",
    features: [
      "Design system e protótipos",
      "Vagas rotativas do clube",
      "Confirmação manual do staff",
    ],
    vipFulfillmentNote:
      "Vagas limitadas. Envie DM ao staff com uso pretendido. Sem vaga na fila, você entra em waitlist.",
    active: true,
    sortOrder: 40,
  },
  {
    id: "chatgpt-plus",
    title: "ChatGPT Plus",
    tagline: "IA no ritmo da produção",
    category: "IA & automação",
    badge: "custo-membro",
    posterGradient: NULLPASS_GRADIENTS[4],
    monogram: "AI",
    description:
      "Acesso como benefício do Vault para acelerar copy, código e pesquisa. Uso responsável — o Nullysh gerencia a liberação.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Modelos avançados no fluxo de trabalho",
      "Para estudo, produto e operação",
      "Liberação sob processo VIP",
    ],
    vipFulfillmentNote:
      "Solicite no DM staff com «ChatGPT Plus». Mantenha o uso dentro das regras da plataforma.",
    active: true,
    sortOrder: 50,
    isPinned: true,
  },
  {
    id: "midjourney",
    title: "Midjourney",
    tagline: "Imagens e referências visuais",
    category: "IA & automação",
    badge: "novo",
    posterGradient: NULLPASS_GRADIENTS[5],
    monogram: "MJ",
    description:
      "Geração de imagens para moodboards e campanhas. Benefício VIP com orientação de uso ético.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Exploração visual rápida",
      "Suporte a briefings de marca",
      "Acesso gerenciado",
    ],
    vipFulfillmentNote:
      "DM ao staff com o benefício e o caso de uso. Entrega conforme fila.",
    active: true,
    sortOrder: 60,
    isPinned: true,
  },
  {
    id: "semrush-lite",
    title: "SEO Toolkit",
    tagline: "Pesquisa e concorrência",
    category: "Marketing",
    badge: "custo-membro",
    posterGradient: NULLPASS_GRADIENTS[6],
    monogram: "SEO",
    description:
      "Ferramentas de pesquisa de palavras e análise de presença digital, empacotadas como benefício do clube.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Keywords e overview de mercado",
      "Apoio a trilhas de marketing",
      "Ativação via staff",
    ],
    vipFulfillmentNote:
      "Peça no privado citando «SEO Toolkit». O staff confirma o plano disponível no ciclo atual.",
    active: true,
    sortOrder: 70,
  },
  {
    id: "mail-warmup",
    title: "Stack de e-mail",
    tagline: "Envio e deliverability básica",
    category: "Marketing",
    badge: "limitado",
    posterGradient: NULLPASS_GRADIENTS[7],
    monogram: "EM",
    description:
      "Kit de ferramentas de e-mail para quem valida ofertas e nutre leads. Uso alinhado a boas práticas.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Fluxo de envio responsável",
      "Vagas por ciclo",
      "Onboarding com o staff",
    ],
    vipFulfillmentNote:
      "DM staff + objetivo da campanha. Benefício pode exigir checklist antes da liberação.",
    active: true,
    sortOrder: 80,
  },
  {
    id: "loom-business",
    title: "Loom Business",
    tagline: "Vídeos assíncronos de mentoria",
    category: "Produtividade",
    badge: "novo",
    posterGradient: NULLPASS_GRADIENTS[8],
    monogram: "L",
    description:
      "Gravação rápida de telas e feedbacks — combina com mentorias e handoff no fórum.",
    price: null,
    priceLabel: "Custo membro",
    features: [
      "Gravação e compartilhamento ágil",
      "Útil em mentoria e suporte",
      "Liberação VIP assistida",
    ],
    vipFulfillmentNote:
      "Solicite no DM com «Loom Business». Você recebe o passo a passo no privado.",
    active: true,
    sortOrder: 90,
  },
];

/** @deprecated use NULLPASS_SEED — mantido para imports legados */
export const NULLPASS_CATALOG = NULLPASS_SEED;

export function monogramFromTitle(title: string): string {
  const t = title.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 3);
  }
  return t.slice(0, 2).toUpperCase();
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Preço efetivo (promo se ativa) */
export function effectiveNullpassPrice(p: NullpassProduct): number | null {
  if (
    p.promoActive &&
    typeof p.promoPrice === "number" &&
    Number.isFinite(p.promoPrice) &&
    p.promoPrice >= 0
  ) {
    return p.promoPrice;
  }
  if (typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0) {
    return p.price;
  }
  return null;
}

/** Label principal de preço na vitrine */
export function formatNullpassPrice(p: NullpassProduct): string {
  const eff = effectiveNullpassPrice(p);
  if (eff != null) return formatBRL(eff);
  return (p.priceLabel || "Custo membro").trim() || "Custo membro";
}

/** Preço cheio riscado quando há promo */
export function formatNullpassCompareAt(p: NullpassProduct): string | null {
  if (
    !p.promoActive ||
    typeof p.promoPrice !== "number" ||
    typeof p.price !== "number"
  ) {
    return null;
  }
  if (p.promoPrice >= p.price) return null;
  return formatBRL(p.price);
}

export function nullpassCategories(products: NullpassProduct[]) {
  const present = new Set(
    products.filter((p) => p.active !== false).map((p) => p.category)
  );
  const ordered = NULLPASS_ROW_ORDER.filter((c) => present.has(c));
  const extras = Array.from(present)
    .filter(
      (c) =>
        !NULLPASS_ROW_ORDER.includes(c as (typeof NULLPASS_ROW_ORDER)[number])
    )
    .sort();
  return [...ordered, ...extras];
}

/**
 * Ordem canônica NullPass:
 * 1) isPinned (true primeiro)
 * 2) sortOrder ASC (menor primeiro)
 * 3) título A–Z (pt-BR)
 */
export function compareNullpassProducts(
  a: NullpassProduct,
  b: NullpassProduct
): number {
  return (
    Number(!!b.isPinned) - Number(!!a.isPinned) ||
    (a.sortOrder ?? 100) - (b.sortOrder ?? 100) ||
    a.title.localeCompare(b.title, "pt-BR")
  );
}

export function nullpassByCategory(
  category: string,
  products: NullpassProduct[]
) {
  return products
    .filter((p) => p.active !== false && p.category === category)
    .sort(compareNullpassProducts);
}

export function sortNullpassProducts(products: NullpassProduct[]) {
  return [...products].sort(compareNullpassProducts);
}

/** Itens fixados para a row "Em destaque" (máx. 6). */
export function nullpassFeatured(
  products: NullpassProduct[],
  limit = 6
): NullpassProduct[] {
  return products
    .filter((p) => p.active !== false && !!p.isPinned)
    .sort(compareNullpassProducts)
    .slice(0, limit);
}
