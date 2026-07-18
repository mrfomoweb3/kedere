# Deploying the Kedere web app (Railway)

The app is a **Next.js server** (App Router + API routes + Prisma/Postgres), not a static
build — it needs a Node runtime and a database. Railway hosts both. The contract is already
live on Monad testnet (see README → Live links).

**Live:** https://web-production-33666.up.railway.app

## Prerequisites

- Railway CLI: `npm i -g @railway/cli` then `railway login`.
- A Postgres database. We reuse the existing **Supabase** instance (already seeded with the
  demo estate `/estate/0`); its `DATABASE_URL` / `DIRECT_URL` are in `web/.env.local`.

## Deploy (CLI, from the `web/` directory)

```bash
cd web

# 1. Create + link a project
railway init --name kedere-web

# 2. Create the service and set env vars (values from web/.env.local; CRON_SECRET fresh)
railway add --service web \
  --variables "NEXT_PUBLIC_CONTRACT_ADDRESS=0x2923aF91E57F12D3f4076334F19cDcE4697Ef144" \
  --variables "NEXT_PUBLIC_DEPLOY_BLOCK=44917567" \
  --variables "DATABASE_URL=<supabase pooled url>" \
  --variables "DIRECT_URL=<supabase direct url>" \
  --variables "SESSION_SECRET=<openssl rand -hex 32>" \
  --variables "CRON_SECRET=<openssl rand -hex 32>"

# 3. Deploy (streams build logs, then exits)
railway up -c

# 4. Give it a public URL
railway domain
```

Railway auto-detects Next.js: build runs `npm run build` (`prisma generate && next build`),
start runs `next start` (which binds Railway's `$PORT`). No Dockerfile needed.

### Environment variables

| Name | When | Notes |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | build | deployed EstateFund address (baked into client bundle) |
| `NEXT_PUBLIC_DEPLOY_BLOCK` | build | deploy block number |
| `NEXT_PUBLIC_WC_PROJECT_ID` | build | *(optional)* WalletConnect id for mobile-wallet QR; omit for injected-only |
| `DATABASE_URL` | runtime | Postgres pooled connection (app reads) |
| `DIRECT_URL` | runtime | Postgres direct connection (Prisma) |
| `SESSION_SECRET` | runtime | SIWE session signing — `openssl rand -hex 32` |
| `CRON_SECRET` | runtime | gates `/api/sync` (the indexer endpoint) — `openssl rand -hex 32` |

`NEXT_PUBLIC_*` are compiled into the browser bundle, so they must be set **before** the build.
Changing one requires a redeploy (`railway up`).

### Fresh Railway Postgres instead of Supabase

If you'd rather provision a new DB: `railway add --database postgres`, point `DATABASE_URL`
/ `DIRECT_URL` at it, then create the schema and repopulate:

```bash
railway run npx prisma db push        # create tables
# then re-run the indexer/backfill to mirror on-chain state into the fresh DB
```

## Redeploying

From `web/`: `railway up -c`. Env-var changes: `railway variables --set "KEY=value"` (triggers
a redeploy unless `--skip-deploys`).

## Sanity check after deploy (do what the judges do — click everything twice)

- `GET /api/estates/0` returns the seeded ledger JSON → DB connection is good.
- Visit `/` — wordmark, tagline, create/join cards render; smooth scroll + reveal animations.
- **Connect wallet** (RainbowKit) → connects, network shows Monad (offers to switch if not).
- Visit `/estate/0` — the seeded ledger loads from chain (levies, the settled Diesel expense
  with the HÁN KEDERE stamp, the pending Gate-repair expense with a live countdown + objection).
- **Pay a levy** with a funded wallet → new notice pins into the feed, tx links to the explorer.
- Refresh — state persists (it's read from chain/DB, not memory).

## Notes / gotchas hit during setup

- `npm ci` requires `package.json` and `package-lock.json` in perfect sync. If Railway's build
  fails with *"Missing: X from lock file"*, run `npm install` locally to re-sync the lockfile,
  then redeploy.
- `@wagmi/connectors` pulls in `@coinbase/cdp-sdk` → optional `@x402/*` packages that aren't
  installed on a clean `npm ci`. `next.config.mjs` ignores them via `webpack.IgnorePlugin`
  (we only use the `injected()` connector, so that code path never runs).
