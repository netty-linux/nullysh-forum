<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Design System Rules

Fonte da verdade: `src/app/globals.css` (CSS variables). **Nenhum valor mágico solto** em componentes novos — consuma tokens.

### Tokens

| Grupo | Valores |
|-------|---------|
| Espaçamento | `--space-1`…`--space-8` → 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px |
| Radius | `--radius-sm` 6 · `--radius-md` 8 · `--radius-lg` 12 · `--radius-xl` 16 · `--radius-full` 9999 |
| Bordas | `--border` = light `rgba(0,0,0,.08)` / dark `rgba(255,255,255,.09)` |
| Sombras | **só 3 níveis**: `--shadow-sm` (hover card) · `--shadow-md` (dropdown) · `--shadow-lg` (modal). Sem sombra pesada em elementos estáticos. |
| Superfícies dark | `--background` → `--surface` → `--surface-elevated` → `--surface-float` (camadas, nunca `#000` puro) |
| Texto | `--text-primary` ~92% · `--text-secondary` ~60% · `--text-tertiary` ~40% (nunca `#fff` puro no dark) |
| Layout | `--feed-max: 640px` · sidebar item `--sidebar-item-h: 40px` |

### Tipografia

- **UI/body:** Inter (`--font-inter`) com `font-feature-settings: "cv05","cv11","ss01"`.
- **Display/headings/marca:** Satoshi (`--font-satoshi` / classe `.font-display`).
- **Escala única (px):** 13 / 14 / 15 / 16 / 18 / 20 / 24 / 32 — proibido fora da escala.
- **Weights UI:** apenas 400 / 500 / 600. Substitua `font-bold` (700) por `font-medium` (600) em UI.
- Feed: corpo do post 15px / lh 1.5; username 15px weight 600; timestamps/contadores 13px terciário.
- Letter-spacing: `-0.01em` em ≥16px; `-0.02em` em headings ≥24px; **nunca** tracking negativo em 13/14px.
- Headings: `text-wrap: balance`. Previews: `line-clamp-2` em títulos de card; `line-clamp-3` em previews.

### Motion

```
--duration-instant: 100ms
--duration-fast:    150ms
--duration-base:    200ms
--duration-slow:    300ms
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)
--ease-in:  cubic-bezier(0.7, 0, 0.84, 0)
--press-scale: 0.98
```

- Feedback: 100–150ms · entradas: 200–300ms · saídas **mais rápidas** que entradas · **nada acima de 400ms**.
- Entrando = ease-out; saindo = ease-in.
- Anime **somente** `transform` e `opacity` (nunca width/height/top em animação contínua).
- Cards do feed: **sem** `translateY` no hover (evita layout shift).
- `@media (prefers-reduced-motion: reduce)`: desligar transforms; manter só opacity se necessário.
- Lib: `motion` (motion.dev) já no projeto.

### Componentes / densidade

- Post card: padding 16px; gap 8px header/corpo/ações; gap 12px avatar↔conteúdo.
- Barra de ações: ícones 18–20px; touch target mín. 40×40; gap ícone↔contador 6px (classe `.post-action`).
- Sidebar: itens h 40px, px 12, radius 8, gap 2px; ativo = background sutil + weight 500.
- Badge verificado: 4px de gap do nome.
- Empty states: use `EmptyState` (`src/components/empty-state.tsx`) — ícone + título + descrição + CTA.

### Estados obrigatórios

Todo controle interativo precisa de: **hover · active · focus-visible** (ring 2px + offset, accent) · **disabled** (opacity .5 + `cursor-not-allowed`) · **loading** (spinner inline, largura travada — prop `loading` no `Button`).

Forms: erro inline 13px + borda vermelha + ícone (`.field-error` / `Input` `error`).

### Skills de design (referência)

- `~/.grok/skills/web-design-guidelines` — checklist a11y / focus / touch
- `~/.grok/skills/frontend-design` — direção estética anti-slop
- `~/.grok/skills/react-best-practices` + `composition-patterns`
- `~/.grok/skills/bencium-*-ux-designer` — MOTION-SPEC / ACCESSIBILITY

### QA visual

```bash
# Dev local sem Supabase (seed admin@nullysh.com / admin123):
# renomeie .env.local temporariamente se necessário
npm run dev
node scripts/design-audit.mjs before   # ou after
```

Screenshots em `./design-audit/{before,after}/`.
