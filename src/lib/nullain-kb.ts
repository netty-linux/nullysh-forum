/**
 * Base de conhecimento da Nullain — assistente da Nullysh Forum (MVP local).
 * Respostas determinísticas por intenção (sem API externa).
 */

export type NullainMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

const WELCOME = `Oi! Eu sou a **Nullain**, assistente da Nullysh Forum ✨

Posso te ajudar com:
• o que é o fórum e para que serve  
• quem é o dono (**Netty**)  
• como usar feed, trilhas, mentorias, materiais…  
• plano VIP, verificação e painel admin  

Pergunte o que quiser — ou toque em um atalho abaixo.`;

export const NULLAIN_WELCOME = WELCOME;

export const NULLAIN_QUICK_PROMPTS = [
  "O que é a Nullysh Forum?",
  "Quem é o Netty?",
  "Como usar o fórum?",
  "O que tem no Plano VIP?",
  "Como funciona o drop de materiais?",
] as const;

type Intent = {
  keys: string[];
  answer: string;
};

const INTENTS: Intent[] = [
  {
    keys: [
      "o que é",
      "o que e",
      "nullysh",
      "forum",
      "fórum",
      "sobre",
      "propósito",
      "proposito",
      "para que",
      "pra que",
    ],
    answer: `A **Nullysh Forum** é a comunidade VIP da Nullysh: um espaço colaborativo para criadores, founders e quem vive de digital.

**Propósito**
Conectar pessoas, compartilhar conhecimento e acelerar resultados com:
• feed social e discussões  
• trilhas de aprendizado  
• match de mentorias  
• eventos, comunidades, vídeos e materiais  
• bate-papo e DMs  

É um hub de networking + conteúdo prático, com área free e benefícios extras no **Plano VIP**.`,
  },
  {
    keys: [
      "netty",
      "dono",
      "dona",
      "fundador",
      "criador",
      "owner",
      "admin",
      "quem criou",
      "quem é o",
      "quem e o",
    ],
    answer: `O dono da Nullysh Forum é o **Netty**.

Ele é o fundador / admin da comunidade: cuida da visão do produto, da operação e da curadoria do que rola no fórum. Contas admin (como a dele) podem gerenciar **verificações** no Painel ADM e têm acesso VIP completo.

Se quiser falar com a comunidade em geral, use o **Bate-papo** ou o **match de mentorias**. Para dúvidas de produto, pode me perguntar 😊`,
  },
  {
    keys: [
      "quando",
      "criada",
      "criado",
      "fundada",
      "fundado",
      "data",
      "ano",
      "história",
      "historia",
      "origem",
    ],
    answer: `A Nullysh Forum nasceu como o **espaço oficial de comunidade da Nullysh**.

No MVP atual a base de membros seed e o calendário de conteúdo estão ancorados em **2026** (lançamento / operação do protótipo). A ideia é crescer como rede social + hub de aprendizado para o ecossistema Nullysh.

O que importa no dia a dia: o fórum está **vivo** — com feed, materiais em drop, mentorias e eventos para você usar agora.`,
  },
  {
    keys: [
      "como usar",
      "como funciona",
      "começar",
      "comecar",
      "tutorial",
      "guia",
      "navegar",
      "passos",
      "primeiros passos",
      "ajuda",
      "help",
    ],
    answer: `**Como usar a Nullysh Forum**

1. **Feed** — publique e curta posts da comunidade  
2. **Trilhas** — siga trilhas e marque passos concluídos  
3. **Mentorias** — complete interesses/objetivos no perfil e veja matches; use **Conversar** para abrir DM  
4. **Eventos** — confira a agenda e faça RSVP  
5. **Comunidades** — entre em salas temáticas (algumas VIP)  
6. **Vídeos & Materiais** — consuma conteúdo; VIP libera o catálogo premium  
7. **Bate-papo** — salas públicas + **Diretas** (DM)  
8. **Perfil** — banner, avatar, bio, links, mentoria e verificação  

Dica: quanto mais completo o **perfil**, melhor o match de mentorias.`,
  },
  {
    keys: [
      "vip",
      "plano",
      "assinatura",
      "preço",
      "preco",
      "pagar",
      "47",
      "premium",
    ],
    answer: `O **Plano VIP** (no protótipo: **R$ 47/mês**, pagamento simulado) libera:

• vídeos e materiais exclusivos  
• comunidades e salas de chat VIP  
• mais links no perfil (free: 1 · VIP: 6)  
• drops de materiais **a cada 6 horas** (free: a cada **24 horas**)  
• acesso completo à rede e networking premium  

Ative em **Pricing / Assinar VIP** no menu. No MVP o VIP é ativado localmente (sem gateway real ainda).`,
  },
  {
    keys: [
      "material",
      "materiais",
      "drop",
      "download",
      "template",
      "checklist",
      "pdf",
    ],
    answer: `Na página **Materiais** você encontra PDFs, templates, checklists, cursos e links curados.

**Drop de materiais**
• **Free:** um material novo a cada **24 horas**  
• **VIP:** drops a cada **6 horas**  

O cronômetro no topo da página mostra o tempo até o próximo drop do seu plano. Itens com selo **VIP** pedem assinatura para baixar.`,
  },
  {
    keys: [
      "mentoria",
      "mentorias",
      "match",
      "mentor",
      "mentorado",
      "conversar",
      "dm",
      "direct",
    ],
    answer: `O **Match de mentorias** conecta mentores e mentorados por **interesses** e **objetivos**.

1. No **Perfil**, marque se busca ou oferece mentoria e preencha tags  
2. Em **Mentorias**, veja conexões sugeridas com score  
3. Clique em **Conversar** → abre a **DM** com aquela pessoa no Bate-papo  
4. **Ver perfil** mostra o perfil público estilo Instagram  

Quanto mais rico o perfil, melhores os matches.`,
  },
  {
    keys: [
      "chat",
      "bate-papo",
      "bate papo",
      "mensagem",
      "mensagens",
      "canal",
      "sala",
    ],
    answer: `O **Bate-papo** tem:

• **Salas** da comunidade (\`#lobby\`, \`#ajuda\`, salas VIP…)  
• **Diretas (DM)** — conversas 1:1 (ex.: vindas do match de mentorias via **Conversar**)  

Salas VIP exigem Plano VIP. DMs funcionam entre membros logados no protótipo local.`,
  },
  {
    keys: [
      "verifica",
      "selo",
      "verificado",
      "fake",
      "painel",
      "adm",
    ],
    answer: `**Verificação**  
Peça o selo azul em **Perfil → Obter perfil verificado** (ou em Verificação). Admins revisam no **Painel ADM** para reduzir perfis fake.

**Painel ADM**  
Só contas com role admin (ex.: Netty) veem a aba e aprovam/rejeitam solicitações.`,
  },
  {
    keys: [
      "perfil",
      "avatar",
      "banner",
      "bio",
      "link",
      "links",
      "foto",
    ],
    answer: `No **Perfil** você edita:

• nome, e-mail, bio e senha  
• **avatar** e **banner** (com crop)  
• interesses, objetivos e flags de mentoria  
• **links** na bio (1 free / 6 VIP)  
• exclusão de conta (exceto admin seed)  

O perfil público fica em \`/app/u/[id]\` — estilo cartão Instagram, com selo se verificado.`,
  },
  {
    keys: ["trilha", "trilhas", "aprender", "curso", "progresso"],
    answer: `**Trilhas** são caminhos de aprendizado com passos que você marca como feitos.

Abra **Trilhas** na sidebar, escolha uma trilha e avance no seu ritmo. Seu progresso fica salvo no protótipo (local no navegador).`,
  },
  {
    keys: ["evento", "eventos", "live", "rsvp", "agenda"],
    answer: `Em **Eventos** você vê a agenda da comunidade (lives, workshops, etc.).

Pode filtrar e fazer **RSVP** nos que quiser participar. É ótimo para networking em tempo real com o ecossistema Nullysh.`,
  },
  {
    keys: ["comunidade", "comunidades", "slug"],
    answer: `**Comunidades** são grupos temáticos (Geral, IAs, Negócios, Design…).

Algumas são **VIP-only**. Entre pela sidebar **Comunidades**, explore posts da sala e participe das discussões do tema.`,
  },
  {
    keys: ["video", "vídeo", "videos", "vídeos", "aula"],
    answer: `Em **Vídeos** ficam tutoriais e aulas da metodologia Nullysh.

Filtre por categoria. Conteúdos com cadeado / VIP pedem o **Plano VIP** para liberar.`,
  },
  {
    keys: ["oi", "olá", "ola", "hey", "hello", "bom dia", "boa tarde", "boa noite"],
    answer: `Oi! 👋 Sou a **Nullain**. Em que posso te ajudar sobre a Nullysh Forum hoje?`,
  },
  {
    keys: ["obrigad", "valeu", "thanks", "vlw"],
    answer: `Por nada! Qualquer dúvida sobre a Nullysh, o Netty ou como usar o fórum, é só chamar 🖤`,
  },
];

const FALLBACK = `Ainda estou aprendendo sobre isso, mas posso te guiar no essencial da **Nullysh Forum**:

• **Propósito** — comunidade VIP de conteúdo, mentoria e networking  
• **Dono** — **Netty**  
• **Como usar** — sidebar: Feed, Trilhas, Mentorias, Eventos, Comunidades, Vídeos, Materiais, Bate-papo, Perfil  

Tente perguntar de outro jeito, ou use um atalho rápido. Exemplos:  
“Quem é o Netty?”, “Como usar o fórum?”, “O que tem no VIP?”`;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

/** Gera resposta da Nullain a partir da pergunta do usuário. */
export function answerNullain(question: string): string {
  const q = normalize(question);
  if (!q) {
    return "Pode escrever sua dúvida — sobre o fórum, o Netty, VIP ou como navegar ✨";
  }

  let best: { score: number; answer: string } | null = null;

  for (const intent of INTENTS) {
    let score = 0;
    for (const key of intent.keys) {
      const k = normalize(key);
      if (q.includes(k)) score += k.length >= 6 ? 3 : 2;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, answer: intent.answer };
    }
  }

  return best?.answer ?? FALLBACK;
}

export function nullainMsgId() {
  return `nl_${Math.random().toString(36).slice(2, 9)}`;
}
