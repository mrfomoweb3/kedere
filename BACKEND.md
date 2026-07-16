# Kedere backend (Next.js + Supabase)

The contract on Monad is the source of truth for money. The backend is a **fast
read + profile + auth layer** on top:

- **Indexer** (`src/server/indexer.ts`) — reads the contract's events in ≤100-block
  chunks (Monad's RPC cap) and authoritative state from storage, into Postgres.
- **API** (`src/app/api/*`) — serves the full ledger fast, a wallet's estates, and
  resident profiles. Writes (levy, propose, object, execute, create, join) still go
  straight to the contract from the user's wallet.
- **Auth** — Sign-In With Ethereum (SIWE) → a JWT session cookie. A wallet can only
  write its own profile. No passwords.

## Endpoints

| Route | Purpose |
|---|---|
| `GET /api/estates/[id]` | Full estate: meta, ledger feed, expenses (indexed, fast) |
| `GET /api/wallets/[address]/estates` | Estates a wallet chairs or lives in (onboarding redirect) |
| `GET /api/profiles/[address]` | A wallet's display name |
| `POST /api/profiles` | Save your display name (SIWE session required) |
| `GET /api/auth/nonce` · `POST /api/auth/verify` · `GET /api/auth/me` · `POST /api/auth/logout` | SIWE session |
| `GET /api/sync` | Run the indexer once (cron / manual backfill) |

## One-time setup

### 1. Create a Supabase project
<https://supabase.com> → New project. Then **Project Settings → Database → Connection string**:
- **Transaction / pooled** (port `6543`) → `DATABASE_URL` (add `?pgbouncer=true`)
- **Session / direct** (port `5432`) → `DIRECT_URL`

Put both in `web/.env.local` (already scaffolded there):
```
DATABASE_URL="postgresql://postgres.xxxx:PW@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:PW@aws-0-REGION.pooler.supabase.com:5432/postgres"
```
`SESSION_SECRET` is already generated in `.env.local`.

### 2. Create the tables
```bash
cd web
npm run db:push      # prisma db push — creates tables from prisma/schema.prisma
```

### 3. Backfill the index from chain (one time)
```bash
npm run backfill     # scans from the deploy block to the tip, populates Postgres
```
After this the demo estate (`/estate/0`) is fully indexed. The app keeps the index
fresh automatically: every `/api/estates/*` and `/api/wallets/*` call runs a bounded
incremental `sync()`.

### 4. Run
```bash
npm run dev          # http://localhost:3000
```

## Deploy (Vercel + Supabase)
- Push to GitHub, import into Vercel (root dir `web`, framework **Next.js**).
- Env vars: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_CONTRACT_ADDRESS`,
  `NEXT_PUBLIC_DEPLOY_BLOCK`, and optionally `NEXT_PUBLIC_WC_PROJECT_ID`.
- Optional: a **Vercel Cron** hitting `/api/sync` every few minutes keeps the index warm
  even when no one is browsing (reads already self-sync, so this is just belt-and-braces).
- Run the backfill once against the production DB (locally, pointing `.env.local` at the
  same Supabase project) so history is present on first load.
