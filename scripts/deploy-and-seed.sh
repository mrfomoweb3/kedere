#!/usr/bin/env bash
# Kedere — one-shot deploy + verify + (optional) seed + wire the frontend.
# Prereqs: /Users/macbook/Kedere/.env has DEPLOYER_PRIVATE_KEY funded with Monad
# testnet MON (faucet.monad.xyz). RESIDENT1/2 keys are optional (only for seeding).
#
# Usage:  ./scripts/deploy-and-seed.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── load env ────────────────────────────────────────────────────────────────
[ -f .env ] || { echo "✗ No .env at repo root. Copy .env.example → .env and fill DEPLOYER_PRIVATE_KEY."; exit 1; }
set -a; . ./.env; set +a
: "${MONAD_RPC_URL:=https://testnet-rpc.monad.xyz}"
[ -n "${DEPLOYER_PRIVATE_KEY:-}" ] || { echo "✗ DEPLOYER_PRIVATE_KEY is blank in .env"; exit 1; }

DEPLOYER_ADDR="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
echo "▶ Deployer: $DEPLOYER_ADDR"
BAL="$(cast balance "$DEPLOYER_ADDR" --rpc-url "$MONAD_RPC_URL")"
echo "▶ Balance:  $BAL wei"
[ "$BAL" != "0" ] || { echo "✗ Deployer has 0 MON. Fund it at https://faucet.monad.xyz"; exit 1; }

cd contracts

# ── 1. deploy ────────────────────────────────────────────────────────────────
echo "▶ Deploying EstateFund…"
forge script script/Deploy.s.sol --rpc-url "$MONAD_RPC_URL" --broadcast | tee /tmp/kedere-deploy.log
ADDR="$(grep -oE 'EstateFund deployed at: 0x[0-9a-fA-F]{40}' /tmp/kedere-deploy.log | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)"
[ -n "$ADDR" ] || { echo "✗ Could not parse deployed address"; exit 1; }
echo "✓ Deployed: $ADDR"

# deploy block for the frontend event scan
BLOCK="$(cast receipt "$(grep -oE 'Hash: 0x[0-9a-fA-F]{64}' /tmp/kedere-deploy.log | grep -oE '0x[0-9a-fA-F]{64}' | tail -1)" --rpc-url "$MONAD_RPC_URL" blockNumber 2>/dev/null || echo 0)"
echo "▶ Deploy block: ${BLOCK:-0}"

# ── 2. verify (sourcify) ─────────────────────────────────────────────────────
echo "▶ Verifying on Monad explorer (sourcify)…"
forge verify-contract "$ADDR" src/EstateFund.sol:EstateFund \
  --chain-id 10143 --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org || echo "⚠ verify step failed — retry manually (README → Deploy)."

# ── 3. seed (optional) ───────────────────────────────────────────────────────
if [ -n "${RESIDENT1_PRIVATE_KEY:-}" ] && [ -n "${RESIDENT2_PRIVATE_KEY:-}" ]; then
  echo "▶ Seeding demo estate (pass 1)…"
  FUND_ADDRESS="$ADDR" forge script script/Seed.s.sol --rpc-url "$MONAD_RPC_URL" --broadcast --slow
  echo "▶ Waiting 125s for the delay window…"
  sleep 125
  echo "▶ Seeding demo estate (pass 2 — execute expense #0)…"
  FUND_ADDRESS="$ADDR" PASS=2 forge script script/Seed.s.sol --rpc-url "$MONAD_RPC_URL" --broadcast
  echo "✓ Demo estate seeded."
else
  echo "ℹ Skipping seed (RESIDENT1/2 keys not set). Estate list starts empty."
fi

# ── 4. wire the frontend ─────────────────────────────────────────────────────
cd "$ROOT/web"
ENVF=".env.local"
touch "$ENVF"
# preserve VITE_PRIVY_APP_ID, replace/append the two contract vars
grep -v -E '^VITE_(CONTRACT_ADDRESS|DEPLOY_BLOCK)=' "$ENVF" > "$ENVF.tmp" || true
mv "$ENVF.tmp" "$ENVF"
{
  echo "VITE_CONTRACT_ADDRESS=$ADDR"
  echo "VITE_DEPLOY_BLOCK=${BLOCK:-0}"
} >> "$ENVF"
echo "✓ Wrote $ROOT/web/$ENVF"

echo ""
echo "════════════════════════════════════════════════"
echo "  Contract:  $ADDR"
echo "  Explorer:  https://testnet.monadexplorer.com/address/$ADDR"
echo "  Deploy blk: ${BLOCK:-0}"
echo "════════════════════════════════════════════════"
echo "Next: cd web && npm run build   → deploy dist/ to Vercel"
