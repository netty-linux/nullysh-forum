/**
 * NullPass — cofre de benefícios VIP (tom Vault).
 *
 * Linguagem consciente:
 * - São benefícios do clube / acessos gerenciados, não "contas piratas".
 * - Entrega real é operacional (staff); o catálogo é a vitrine.
 * - Free nunca vê notas de fulfillment.
 */

export type NullpassBadge = "novo" | "custo-membro" | "limitado";

export type NullpassProduct = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  badge?: NullpassBadge;
  /** Gradiente CSS da capa (estilo poster Netflix) */
  posterGradient: string;
  /** Inicial / monograma na capa */
  monogram: string;
  description: string;
  /** Ex.: "Custo membro" */
  priceLabel: string;
  priceHint?: string;
  features: string[];
  /**
   * Instrução pós-solicitação (só VIP).
   * Nunca colocar senhas/links sensíveis aqui no código-fonte.
   */
  vipFulfillmentNote: string;
};

export const NULLPASS_BADGE_LABEL: Record<NullpassBadge, string> = {
  novo: "Novo",
  "custo-membro": "Custo membro",
  limitado: "Vagas limitadas",
};

/** Categorias na ordem das fileiras Netflix */
export const NULLPASS_ROW_ORDER = [
  "Design & criativo",
  "Produtividade",
  "IA & automação",
  "Marketing",
] as const;

/**
 * Catálogo seed — edite aqui até existir painel admin.
 * Capas usam gradientes (sem asset externo) para performance e branding.
 */
export const NULLPASS_CATALOG: NullpassProduct[] = [
  {
    id: "canva-pro",
    title: "Canva Pro",
    tagline: "Design sem freio para o dia a dia",
    category: "Design & criativo",
    badge: "custo-membro",
    posterGradient:
      "linear-gradient(145deg, #0f766e 0%, #115e59 40%, #042f2e 100%)",
    monogram: "C",
    description:
      "Benefício do clube para criação de peças, posts e apresentações com recursos Pro. Acesso gerenciado pela equipe Nullysh — sem links públicos.",
    priceLabel: "Custo membro",
    priceHint: "Abaixo do valor de prateleira",
    features: [
      "Recursos Pro do ecossistema Canva",
      "Foco em creators e operação de conteúdo",
      "Solicitação com fila VIP e entrega assistida",
    ],
    vipFulfillmentNote:
      "Abra o bate-papo com o staff (DM) e informe o ID do benefício. A liberação é feita de forma gerenciada — nunca compartilhe senhas em canais públicos.",
  },
  {
    id: "capcut-pro",
    title: "CapCut Pro",
    tagline: "Edição rápida para reels e shorts",
    category: "Design & criativo",
    badge: "novo",
    posterGradient:
      "linear-gradient(160deg, #4c1d95 0%, #6d28d9 45%, #1e1b4b 100%)",
    monogram: "CC",
    description:
      "Pacote de edição para quem produz vídeo curto. Acesso como benefício VIP, com orientação de uso responsável dentro das políticas da ferramenta.",
    priceLabel: "Custo membro",
    features: [
      "Export e efeitos pro fluxo de short-form",
      "Ideal para social e mentoria de conteúdo",
      "Entrega via processo interno do clube",
    ],
    vipFulfillmentNote:
      "Solicite no DM do staff com o nome do benefício. Prazo típico em dias úteis, conforme fila.",
  },
  {
    id: "notion-plus",
    title: "Notion Plus",
    tagline: "Workspace organizado para o time",
    category: "Produtividade",
    badge: "custo-membro",
    posterGradient:
      "linear-gradient(150deg, #171717 0%, #404040 50%, #0a0a0a 100%)",
    monogram: "N",
    description:
      "Espaço de notas e docs para operar projetos com mais clareza. Benefício estruturado para membros VIP — uso pessoal/profissional conforme regras do plano.",
    priceLabel: "Custo membro",
    features: [
      "Docs, bases e templates de operação",
      "Encaixa em rotina de builders e agências",
      "Ativação assistida pelo staff",
    ],
    vipFulfillmentNote:
      "Peça no bate-papo VIP/staff citando «Notion Plus». Você receberá o próximo passo de ativação no privado.",
  },
  {
    id: "figma-seat",
    title: "Figma (seat)",
    tagline: "UI/UX com colaborações leves",
    category: "Design & criativo",
    badge: "limitado",
    posterGradient:
      "linear-gradient(135deg, #ea580c 0%, #c2410c 40%, #431407 100%)",
    monogram: "F",
    description:
      "Seat gerenciado para prototipação e handoff. Vagas limitadas por ciclo — prioridade a quem está em trilha ou mentoria ativa.",
    priceLabel: "Custo membro",
    priceHint: "Sujeito a disponibilidade",
    features: [
      "Design system e protótipos",
      "Vagas rotativas do clube",
      "Confirmação manual do staff",
    ],
    vipFulfillmentNote:
      "Vagas limitadas. Envie DM ao staff com uso pretendido (projeto/estudo). Sem vaga na fila, você entra em waitlist.",
  },
  {
    id: "chatgpt-plus",
    title: "ChatGPT Plus",
    tagline: "IA no ritmo da produção",
    category: "IA & automação",
    badge: "custo-membro",
    posterGradient:
      "linear-gradient(145deg, #065f46 0%, #10b981 35%, #022c22 100%)",
    monogram: "AI",
    description:
      "Acesso como benefício do Vault para acelerar copy, código e pesquisa. Uso responsável e alinhado às políticas da OpenAI — o Nullysh gerencia a liberação, não revende “contas soltas” em público.",
    priceLabel: "Custo membro",
    features: [
      "Modelos avançados no fluxo de trabalho",
      "Para estudo, produto e operação",
      "Liberação sob processo VIP",
    ],
    vipFulfillmentNote:
      "Solicite no DM staff com «ChatGPT Plus». Mantenha o uso dentro das regras da plataforma; abuso pode suspender o benefício.",
  },
  {
    id: "midjourney",
    title: "Midjourney",
    tagline: "Imagens e referências visuais",
    category: "IA & automação",
    badge: "novo",
    posterGradient:
      "linear-gradient(160deg, #1e3a8a 0%, #3b82f6 40%, #0c1445 100%)",
    monogram: "MJ",
    description:
      "Geração de imagens para moodboards e campanhas. Benefício VIP com orientação de uso ético (sem deepfake malicioso / conteúdo proibido).",
    priceLabel: "Custo membro",
    features: [
      "Exploração visual rápida",
      "Suporte a briefings de marca",
      "Acesso gerenciado",
    ],
    vipFulfillmentNote:
      "DM ao staff com o benefício e o caso de uso. Entrega conforme fila e política da ferramenta.",
  },
  {
    id: "semrush-lite",
    title: "SEO Toolkit",
    tagline: "Pesquisa e concorrência",
    category: "Marketing",
    badge: "custo-membro",
    posterGradient:
      "linear-gradient(150deg, #9a3412 0%, #ea580c 45%, #431407 100%)",
    monogram: "SEO",
    description:
      "Ferramentas de pesquisa de palavras e análise de presença digital, empacotadas como benefício do clube. Ideal para quem opera conteúdo e aquisição.",
    priceLabel: "Custo membro",
    features: [
      "Keywords e overview de mercado",
      "Apoio a trilhas de marketing",
      "Ativação via staff",
    ],
    vipFulfillmentNote:
      "Peça no privado citando «SEO Toolkit». O staff confirma o plano disponível no ciclo atual.",
  },
  {
    id: "mail-warmup",
    title: "Stack de e-mail",
    tagline: "Envio e deliverability básica",
    category: "Marketing",
    badge: "limitado",
    posterGradient:
      "linear-gradient(145deg, #334155 0%, #64748b 40%, #0f172a 100%)",
    monogram: "EM",
    description:
      "Kit de ferramentas de e-mail para quem valida ofertas e nutre leads. Benefício com vagas controladas — não é bulk spam; uso alinhado a boas práticas.",
    priceLabel: "Custo membro",
    features: [
      "Fluxo de envio responsável",
      "Vagas por ciclo",
      "Onboarding com o staff",
    ],
    vipFulfillmentNote:
      "DM staff + objetivo da campanha. Benefício pode exigir checklist anti-spam antes da liberação.",
  },
  {
    id: "loom-business",
    title: "Loom Business",
    tagline: "Vídeos assíncronos de mentoria",
    category: "Produtividade",
    badge: "novo",
    posterGradient:
      "linear-gradient(155deg, #7c3aed 0%, #a78bfa 40%, #2e1065 100%)",
    monogram: "L",
    description:
      "Gravação rápida de telas e feedbacks — combina com mentorias e handoff de tarefas no fórum.",
    priceLabel: "Custo membro",
    features: [
      "Gravação e compartilhamento ágil",
      "Útil em mentoria e suporte",
      "Liberação VIP assistida",
    ],
    vipFulfillmentNote:
      "Solicite no DM com «Loom Business». Você recebe o passo a passo de ativação no privado.",
  },
];

export function nullpassCategories(products: NullpassProduct[] = NULLPASS_CATALOG) {
  const present = new Set(products.map((p) => p.category));
  const ordered = NULLPASS_ROW_ORDER.filter((c) => present.has(c));
  const extras = Array.from(present).filter(
    (c) => !NULLPASS_ROW_ORDER.includes(c as (typeof NULLPASS_ROW_ORDER)[number])
  );
  return [...ordered, ...extras.sort()];
}

export function nullpassByCategory(
  category: string,
  products: NullpassProduct[] = NULLPASS_CATALOG
) {
  return products.filter((p) => p.category === category);
}

export function getNullpassProduct(id: string) {
  return NULLPASS_CATALOG.find((p) => p.id === id) ?? null;
}
