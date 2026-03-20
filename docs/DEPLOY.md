# Deploy (GitHub + Vercel)

## 1) GitHub

Na raiz do projeto:

```bash
git init
git add -A
git commit -m "chore: initial commit"
```

Crie um repositório no GitHub (ex: `zapzapdelivery2`) e depois conecte o remoto:

```bash
git branch -M main
git remote add origin https://github.com/<SEU_USUARIO>/<SEU_REPO>.git
git push -u origin main
```

## 2) Vercel

1. Acesse Vercel → **Add New** → **Project**
2. Importe o repositório do GitHub
3. Framework: **Next.js** (auto-detect)
4. Configure as variáveis de ambiente (Project → Settings → Environment Variables):
   - Não versionar arquivos `.env*` no GitHub

### Variáveis obrigatórias

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Variáveis recomendadas (dependendo do uso)

- `NEXT_PUBLIC_APP_URL` (ex: `https://<seu-dominio>.vercel.app`)
- `NEXT_PUBLIC_PRODUCTION_BASE_URL` (mesmo valor do app URL, se usado)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
- `N8N_WEBHOOK_NOTIFICACLIENTE_STATUS_URL`

5. Clique em **Deploy**

## 3) Pós-deploy

- Verificar status: `/api/debug-status` e `/api/version`
- Validar login, PDV e cardápio público
