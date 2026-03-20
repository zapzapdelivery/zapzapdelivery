# ZapZap Delivery (SaaS)

Sistema SaaS de delivery com painel administrativo (PDV), cardápio público e integrações (Supabase/Storage, Mercado Pago, notificações push).

## Requisitos

- Node.js 20+
- Conta Supabase (URL, anon key e service role key)

## Rodar localmente

1. Copie as variáveis de ambiente:

   - Crie `.env.local` com as variáveis descritas em `docs/DEPLOY.md` (não versionar arquivos `.env*`)

2. Instale dependências e rode:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy (GitHub + Vercel)

Veja [DEPLOY.md](file:///c:/zapzapdelivery2/docs/DEPLOY.md).
