# Design Pass Report — Nullysh Forum (Senior Polish)

**Branch:** `design/senior-polish`  
**Date:** 2026-07-10  
**Scope:** Visual/interaction polish only — no route or business-logic changes.

---

## Phase status

| Phase | Status |
|-------|--------|
| A — Skills install | Done |
| B — Playwright + Chromium | Done (CLI + package; MCP no `config.toml`) |
| C1 — Visual audit | Done (`AUDIT.md`) |
| C2 — Design tokens | Done (`globals.css`) |
| C3 — Typography | Done (Inter + Satoshi) |
| C4 — Spacing / layout | Done (feed 640, sidebar, post actions) |
| C5 — Motion / depth | Done (tokens + reduced-motion + Motion) |
| C6 — States | Done (Button loading, Input error, EmptyState, skeletons) |
| C7 — QA loop | Done — **52/52** screenshots after |
| C8 — Persist + docs | Done (`AGENTS.md`, this report) |

---

## What changed (by layer)

### Foundation
- **Design tokens** unificados em `src/app/globals.css`: spacing 4–64, radius 6/8/12/16/full, borders com opacidade, 3 shadows, motion durations/easings, text opacity ladder, dark surfaces em camadas.
- **Tipografia:** Inter (next/font) + Satoshi (Fontshare); escala 13–32; features `cv05/cv11/ss01`; weights UI ≤600.
- **AGENTS.md** → seção `## Design System Rules` para trabalho futuro.

### Core UI
- `Button` — variants tokenizadas, `loading` com spinner e largura estável, active scale 0.98, focus-visible accent.
- `Input` — radius 8, error 13px + ícone + `aria-invalid`.
- `Card` / `Avatar` — border tokens; avatar fade-in on load.
- `EmptyState` — componente reutilizável.
- `PageTransition` — crossfade 150ms (só opacity).
- `AuthGuard` — skeleton shimmer em vez de spinner genérico.

### Product surfaces
- **Sidebar:** h-40 items, gap 2px, active weight 500, radius 8.
- **Post card:** p-16, gaps 8/12, action bar 40×40, like spring + count slide, save pop, menu popover motion.
- **Feed:** max-width 640px; stagger first posts; empty state desenhado; composer 15px.
- **Stories ring:** `.story-ring` com gradiente animado só no hover.
- **Confirm dialog:** overlay 200ms, panel 250ms scale 0.97→1; `overscroll-contain`.
- **Salvos:** `EmptyState` padronizado.

### Pages touched (visual)
Feed, Populares, Salvos, Trilhas, Mentorias, Eventos, Comunidades, Vídeos, Materiais, Chat, Perfil, Admin, Login — herdando tokens + headings display.

---

## Guidelines violations fixed

| Antes | Depois |
|-------|--------|
| Touch targets de ação < 40px | `.post-action` min 40×40 |
| Hover translateY no feed | só bg/border/shadow |
| Page transition spring pesado | opacity 150ms |
| font-bold (700) em UI core | font-medium (600) |
| Loading "..." sem spinner fixo | `Button loading` |
| Dark #000 / texto sem ladder | camadas + 92/60/40% |
| Magic radii/shadows | CSS vars |
| Empty feed texto solto | `.empty-state` |
| Prefer reduced motion incompleto | bloco global + Motion `useReducedMotion` |

---

## QA screenshots

Path: `design-audit/after/`  
Manifest: `design-audit/after/manifest.json`  
Matrix: 13 rotas × light/dark × desktop/mobile = **52 PNGs (100% OK)**.

> Nota: o set `before/` falhou na 1ª tentativa (servidor sobrecarregado). Baseline visual está documentada em `AUDIT.md`; after completo acima.

Reproduzir:

```bash
# local seed auth (sem Supabase): mova .env.local temporariamente
npm run dev
node scripts/design-audit.mjs after
```

---

## Self-critique (design reviewer)

| Critério | Parece Linear/X? |
|----------|------------------|
| Feed light | Sim — densidade limpa, sidebar ativa sólida, cards quietos |
| Feed dark | Sim — off-black em camadas, sem preto puro, contraste legível |
| Mobile | Sim — header sticky, touch targets, FABs sem colidir com ações |
| Tipografia | Melhor — Inter/Satoshi vs Geist genérico |
| Ainda genérico? | Chips/catálogo de Vídeos/Materiais ainda podem ganhar line-clamp e tokens em PR follow-up |

---

## Follow-ups opcionais

1. Migrar hex hardcoded restantes (`#1f1f1f`) para `var(--accent)` / `var(--ink)` em páginas de catálogo.
2. Toast global com progress bar (spec C5.7) se ainda não houver sistema de toast.
3. Virtualização do feed se posts > 50.
4. Playwright MCP na sessão Grok (já no `~/.grok/config.toml`) — reiniciar Grok para tools nativas.

---

## Playwright install (done)

- `playwright` + `@playwright/test` em devDependencies  
- Chromium instalado em `%LOCALAPPDATA%\ms-playwright\`  
- MCP: `[mcp_servers.playwright]` em `~/.grok/config.toml` (ativa na próxima sessão)
