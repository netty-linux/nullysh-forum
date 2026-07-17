# Migração de domínio — Forum → nullysh.com

Ver checklist completo em **nullysh-pay** `docs/DOMAIN_MIGRATION.md`.

## Alvo

- Forum: `https://nullysh.com` / `https://www.nullysh.com`
- Pay: `https://pay.nullysh.com`

## Secrets Forum a atualizar

```
NULLYSH_PAY_URL=https://pay.nullysh.com
NEXT_PUBLIC_NULLYSH_PAY_URL=https://pay.nullysh.com
NULLYSH_PAY_SSO_SECRET=<mesmo valor do Pay>
```

## Supabase Auth

- Site URL: `https://nullysh.com`
- Redirect URLs: `https://nullysh.com/**`, `https://www.nullysh.com/**`

## R2 CORS (vídeos)

Reaplicar `scripts/r2-cors.json` no bucket `nullysh-videos` com origens `nullysh.com` / `www`.
