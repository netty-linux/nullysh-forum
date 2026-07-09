# Nullysh Forum

MVP protótipo do **Nullysh Forum** — comunidade VIP com feed social, comunidades, vídeos, materiais e bate-papo.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Zustand** (auth + forum CRUD em localStorage)
- **Phosphor Icons**

## Design

White minimalist / product minimalism:

- Fundo branco, tipografia limpa (Geist)
- Botões pretos, muito whitespace
- Grid editorial suíço, UI SaaS limpa

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Contas demo

| Conta | E-mail | Senha | Acesso |
|-------|--------|-------|--------|
| Admin VIP | `admin@nullysh.com` | `admin123` | VIP + admin |
| Membro free | `demo@nullysh.com` | `demo123` | Free |

Ou crie uma conta em `/register`.

## Funcionalidades do MVP

- Landing + pricing (Plano VIP único, R$ 47/mês simulado)
- Cadastro / login / logout / editar perfil / excluir conta (CRUD local)
- Feed com posts, likes e publicação
- Comunidades (algumas VIP)
- Vídeos e materiais com paywall VIP
- Bate-papo por canais (salas VIP bloqueadas)
- Favicon monograma **N**

## Próximos passos

- OAuth (Google / GitHub)
- Backend real + banco
- Pagamento (Stripe / Hotmart / etc.)
- Upload real de vídeos e arquivos
- Chat em tempo real (WebSocket)

## Estrutura

```
src/
  app/           # rotas (landing, auth, /app/*)
  components/    # UI + layout
  hooks/         # useAuth
  lib/           # stores, types, mock data
public/          # favicon.svg
```
