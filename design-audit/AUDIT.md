# Design Audit — Nullysh Forum (C1)

**Produto:** fórum/rede social (X + Instagram + Reddit + cursos).  
**Objetivo:** polish sênior (não redesign de layout).  
**Data:** 2026-07-10  
**Stack:** Next 16 · React 19 · Tailwind 4 · Motion  

## Método

- Dev local em modo seed (`admin@nullysh.com` / `admin123`) — Supabase desligado via `.env.local` em backup.
- Playwright Chromium: light/dark × desktop 1440 / mobile 390.
- Checklist: Vercel Web Interface Guidelines + frontend-design + Bencium motion/a11y.

## Crítica por tela (estado pré-polish)

### Feed (`/app`)
| Critério | Achado |
|----------|--------|
| Hierarquia tipográfica | Geist genérico; h1 3xl sem personalidade de rede social; composer em 17px fora da escala |
| Ritmo vertical | Gaps inconsistentes (p-4/p-5, space-y-3 vs mt-3) |
| Contraste | Dark usa remaps de neutral; texto ok; bordas sólidas #e5e5e5 sem opacidade |
| Densidade | Cards com sombra estática leve + padding irregular |
| Estados | Like pop existe; touch targets de ação ~32px (abaixo de 40) |
| Motion | Page transition com translateY+scale (pesado); card hover translateY causa shift |

### Populares / Salvos
- Mesma base de post card; empty state de Salvos já desenhado (bom).
- Populares: headings e chips com `text-xs` / bold 700.

### Trilhas / Mentorias / Eventos / Comunidades / Vídeos / Materiais
- Cards de catálogo: `card-interactive` com translateY hover.
- Títulos sem `line-clamp`; weights 700 em labels.
- Empty states parciais ou só texto.

### Bate-papo
- Densidade alta ok; falta skeleton de lista; focus rings inconsistentes.

### Perfil
- Boa densidade de identidade; tipografia mista; seções com gaps 24/32 não tokenizados.

### Painel ADM
- Utilitário; tabelas/listas com contraste OK; botões danger com translateY hover.

### Login / marketing
- Login funcional; `Entrando...` sem spinner de largura fixa; focus ring forte (bom).

## Violações web-design-guidelines (pré)

| Severidade | Item | Onde |
|------------|------|------|
| Alta | Touch targets < 40px em ações de post | `post-card.tsx` |
| Alta | `transition: all` implícito em alguns botões legacy | CSS global antigo |
| Média | Icon buttons sem aria-label em alguns menus | vários |
| Média | Imagens sem width/height (CLS) | avatars/posts |
| Média | `font-bold` (700) em UI | sidebar, cards |
| Baixa | Loading text com `...` em vez de `…` | login, guards |
| Baixa | Page motion > 300ms / spring pesado | `page-transition.tsx` |
| Alta | Hover translateY em feed cards | `.card-interactive` |
| Média | Dark `#000`-like canvas e texto `#f0f0f0` sem ladder de opacidade | `globals.css` |
| Média | Valores mágicos de radius/shadow/spacing | todo app |

## Direção pós-audit (executada em C2–C6)

1. Tokens únicos em `globals.css` (espaço, radius, border, shadow, motion, type).
2. Inter + Satoshi; escala 13–32; weights ≤600.
3. Post/sidebar densidades da spec; feed max 640px.
4. Motion NN/g + reduced-motion.
5. EmptyState + Button loading + Input error + avatar fade-in.
6. QA screenshots em `design-audit/after/`.
