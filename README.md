<p align="center">
  <img src="public/brand/logo.png" alt="Nullysh Forum" width="72" height="72" />
</p>

<h1 align="center">Nullysh Forum</h1>

<p align="center">
  <strong>A rede social da comunidade Nullysh.</strong><br />
  Feed, perfis, comunidades por hashtag, VIP e conteúdo exclusivo — em um só lugar.
</p>

<p align="center">
  <a href="https://github.com/netty-linux/nullysh-forum"><img src="https://img.shields.io/badge/GitHub-netty--linux%2Fnullysh--forum-181717?style=flat-square&logo=github" alt="GitHub" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-Auth%20%2B%20Storage-3FCF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Design-Inter%20%2B%20Satoshi-111111?style=flat-square" alt="Design" />
</p>

---

## O que é

O **Nullysh Forum** é o hub social da operação Nullysh: um fórum com cara de rede social, feito para membros free e VIP construírem, trocarem e consumirem conteúdo com identidade própria.

Não é só um feed. É o lugar onde a comunidade se encontra, se destaca e evolui.

---

## Como funciona

### Feed social
Publique pensamentos, imagens e localização. Curta, salve, comente e interaja no estilo de uma rede moderna — limpa, rápida e legível.

### Perfis com identidade
Nome público (`@username`), bio, banner (incl. GIF para VIP), links, interesses, objetivos, emblemas e molduras. O e-mail fica privado; o @ é o que o mundo vê.

### Comunidades por hashtag
Cada comunidade tem uma palavra-chave. Marque a tag no post e ele sincroniza automaticamente:

| Comunidade | Tag | Quem marca | Quem lê |
|------------|-----|------------|---------|
| Anúncios Oficiais | `#staff` | Admin | Todos |
| Geral | `#geral` | Todos | Todos |
| Lounge VIP | `#vips` | VIP | VIP |

VIPs podem **criar** novas comunidades e definir se free ou só VIP leem os posts. Ao digitar `#`, o autocomplete sugere as tags disponíveis.

### VIP
Acesso a lounge exclusivo, criação de comunidades, molduras de avatar, banners animados, músicas no perfil e mais. Free usa o núcleo; VIP desbloqueia a camada premium.

### Social
Seguir, lista de seguidores/seguindo, bloquear, stories, bate-papo e perfis públicos. Controles claros, sem confusão.

### Conteúdo & jornada
Trilhas, mentorias, eventos, vídeos e materiais — o lado de aprendizado e operação da comunidade, ao lado da rede social.

### Staff & verificação
Comunidades oficiais do staff, painel admin e selo de perfil verificado para reduzir fakes e manter a base confiável.

---

## Experiência

```
Feed  ·  Trilhas  ·  Materiais  ·  Mentorias  ·  Eventos
Comunidades  ·  Vídeos  ·  Bate-papo  ·  Perfil  ·  Salvos
```

- **Light / Dark** com superfícies em camadas  
- Tipografia **Inter** (UI) + **Satoshi** (display)  
- Motion contido, alvos de toque e estados de foco consistentes  
- Design system tokenizado (espaçamento, radius, sombra, texto)

---

## Planos

| | Free | VIP |
|---|:---:|:---:|
| Feed & perfis | ✓ | ✓ |
| Comunidades abertas (`#geral`) | ✓ | ✓ |
| Criar comunidades | | ✓ |
| Marcar / ler Lounge VIP (`#vips`) | | ✓ |
| Molduras, GIF banner, músicas | | ✓ |
| Conteúdo premium (vídeos, materiais) | | ✓ |

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | Next.js 16 · React 19 · TypeScript |
| UI | Tailwind CSS 4 · Phosphor · Motion |
| Estado | Zustand (persist) |
| Backend | Supabase Auth · Profiles · Storage |
| Design | Tokens em `globals.css` · Inter + Satoshi |

---

## Rodar local

```bash
npm install
cp .env.local.example .env.local   # se existir
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Com Supabase configurado (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`), auth e mídia usam o projeto remoto. Sem a key, o app opera em modo local.

Migrations SQL: pasta `supabase/migrations/`.

---

## Repositório

```
https://github.com/netty-linux/nullysh-forum
```

---

<p align="center">
  <sub>Nullysh Forum · Comunidade, conteúdo e operação em um só produto.</sub>
</p>
