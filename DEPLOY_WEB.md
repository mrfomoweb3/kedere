# Deploying the Kedere web app (Vercel)

The contract is already live on Monad testnet (see README → Live links). The frontend is a
static Vite build — no server. Two ways to ship it.

## Option A — Vercel dashboard (easiest)

1. Push this repo to GitHub (if not already): `git remote add origin <url> && git push -u origin main`.
2. Go to <https://vercel.com/new> → **Import** the repo.
3. Set **Root Directory** to `web`.
4. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output `dist`.
   - If the install step errors on peer deps, set **Install Command** to
     `npm install --legacy-peer-deps` (Privy pins an exact viem).
5. Add **Environment Variables** (Project → Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `VITE_PRIVY_APP_ID` | your Privy app id |
   | `VITE_CONTRACT_ADDRESS` | deployed EstateFund address (from the deploy run) |
   | `VITE_DEPLOY_BLOCK` | deploy block number (from the deploy run) |
6. **Deploy.** Copy the production URL.
7. In the **Privy dashboard** → your app → **Allowed origins**, add the Vercel URL
   (e.g. `https://kedere.vercel.app`) so sign-in works from production.
8. Paste the URL into README → Live links and SUBMISSION → Project URL.

## Option B — Vercel CLI

```bash
cd web
npm i -g vercel
vercel --prod
# when prompted: root = current dir (web); add the 3 env vars above in the dashboard after.
```

## Sanity check after deploy (do what the judges do — click everything twice)

- Visit `/` — wordmark, tagline, create/join cards render.
- **Sign in** (email or wallet) → wallet connects, network shows Monad.
- Visit `/estate/0` — the seeded ledger loads from chain (levies, the settled Diesel expense
  with the HÁN KEDERE stamp, the pending Gate-repair expense with a live countdown + objection).
- **Pay a levy** with a funded wallet → new notice pins into the feed, tx links to the explorer.
- Refresh — state persists (it's read from chain, not memory).
