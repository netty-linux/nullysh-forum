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

## Supabase (banco + storage)

O app usa **Supabase** quando a anon key está configurada; sem ela, continua no modo local (Zustand/localStorage).

### 1. Variáveis de ambiente

Copie `.env.local.example` → `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rijnjymmivsftkjnhnup.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
```

A key fica em: Dashboard → **Settings → API → anon public**.

### 2. Schema SQL

No Dashboard → **SQL Editor**, execute o arquivo:

`supabase/migrations/20260710_nullysh_init.sql`

Isso cria: `profiles`, `posts`, `comments`, `chat_messages`, `custom_emojis`, `verification_requests`, progress/RSVP, RLS e buckets de Storage (`avatars`, `banners`, `emojis`, `posts`).

### 3. Auth

- Cadastro/login usam **Supabase Auth**
- Perfil extra em `public.profiles` (trigger cria linha no signup)
- Avatar/banner/GIF sobem para **Storage** (não estouram localStorage)

### 4. Admin

Após criar sua conta:

```sql
update public.profiles
set role = 'admin', is_vip = true, is_verified = true
where email = 'seu@email.com';
```

### 5. MCP (opcional)

Config em `.vscode/mcp.json` (projeto `rijnjymmivsftkjnhnup`, read-only).

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
