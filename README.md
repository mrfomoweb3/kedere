# Kedere — your estate's money, in plain sight

**Kedere** (Yoruba: *"in plain sight"*) is a transparent, onchain levy fund for Nigerian
residential estates. Every resident contribution is publicly attributed to a unit, and the
chairman cannot move a single unit of funds without an onchain proposal — carrying a
plain-language memo — that survives a public delay window residents can block.

> **Owó estate yín, hàn kedere** — *your estate's money, in plain sight.*
> The levy fight ends here. No trust required — just look.

---

## The problem, then the fix

Estates collect monthly levies for diesel, security, water and repairs. The money lands in an
exco member's personal account, "receipts" are photos in a WhatsApp group, and every AGM turns
into a *"where did our money go?"* fight because nobody can independently verify anything.

Kedere holds the fund in a smart contract on **Monad**. Contributions are attributed to units.
Spending must be proposed first, in plain language, and sits in a public delay window before a
single unit can move — and a resident majority can block it. The ledger can't be edited and
nothing leaves silently.

---

## Live links

| | |
|---|---|
| **Live app** | _deploy to Vercel/CF Pages and paste the URL here_ |
| **Contract (Monad testnet, verified)** | _paste address + `https://testnet.monadexplorer.com/address/<addr>` here_ |
| **Demo estate** | `/estate/1` · join code `sunrise-04` |
| **Demo video (≤ 3 min)** | _paste URL here_ |

> These four fields are filled in the moment the deploy + seed run completes (see **Deploy**).

---

## Try it in 60 seconds

1. Open the live app and click **Connect wallet** (it offers to add/switch to Monad Testnet).
2. Get testnet MON from <https://faucet.monad.xyz>.
3. Go to the demo estate `/estate/1`. Join with code `sunrise-04` and your unit label, or just
   read the public ledger without joining.
4. **Pay levy** — enter an amount and period, confirm. Watch your contribution *pin* into the
   ledger as a notice card, attributed to your unit, linking to the tx on the Monad explorer.
5. Watch the pending **"Gate repair — welder"** expense: a live countdown to when it can be
   executed, and an objection tally bar. That is the whole product — a ledger nobody can fake.

---

## Architecture (5 bullets)

- **One contract**, `EstateFund.sol` (Solidity 0.8.24, no external deps, hand-rolled reentrancy
  guard). Multiple estates live in one deployment.
- **Events are the ledger.** `LevyPaid`, `ExpenseProposed`, `ExpenseObjected`, `ExpenseExecuted`,
  `ExpenseCancelled`, `ResidentJoined` carry everything the UI renders — no indexer, no backend.
- **Event-driven frontend** (Vite + React + TS, wagmi + viem). All state is read from
  contract storage + `getLogs` from the deploy block, polled live. Zero fixtures, zero mock data.
- **Sign-in via [Privy](https://privy.io)** — residents log in with email, a social account, or
  an external wallet; email/social users get an embedded wallet auto-provisioned on Monad, so
  non-crypto-native residents can pay a levy without ever installing a wallet extension.
- **No backend, no database, no admin panel.** The frontend needs no secrets — public RPC and an
  injected wallet only.
- **Design:** "the estate notice board" — paper-cream, naira-green, every ledger entry is a
  pinned notice; executed expenses get the **HÁN KEDERE ✓** ("in plain sight") stamp linking to
  the settling tx.

## Security model

- **No unattributed outflows.** Funds can only leave through `executeExpense`, and only after the
  full delay. `receive()` / `fallback()` revert so direct transfers can never sit unattributed.
- **Delay window.** An expense is executable only at `proposedAt + proposalDelay`
  (min 60s, max 7 days). The chairman can never execute early, re-execute, or execute a cancelled
  or over-balance expense.
- **Resident veto.** Any resident may object once during the window; when objections pass a
  *strict* majority of the current resident count, the expense auto-cancels.
- **Access control.** Only residents can `payLevy` / `objectToExpense`; only the chairman can
  `proposeExpense` / `executeExpense` / `cancelExpense`.
- **Reentrancy.** `executeExpense` is `nonReentrant` with effects-before-interaction; a malicious
  recipient cannot drain the fund (covered by a test).
- **Honest limitation:** the chairman is a single signer. A production estate would put the
  chairman role behind a multisig (e.g. a Gnosis Safe) — the contract's access model drops in
  behind one unchanged. Called out plainly because it's the real next step.

---

## Test results

Full Foundry suite — **29 tests, all passing** (unit + fuzz + reentrancy):

```
forge test
...
Suite result: ok. 29 passed; 0 failed; 0 skipped
```

Covers creation/membership, levy accounting, proposal guards, the delay gate, execution,
objection majority math, a reentrancy attack, the `receive()` revert, and two fuzz tests
(levy accounting exactness; the delay gate across the full `[60s, 7d]` range).

---

## Local setup

### Contracts

```bash
cd contracts
forge install          # forge-std (already vendored)
forge test -vvv        # 29 passing
```

### Web

```bash
cd web
npm install --legacy-peer-deps   # Privy pins an exact viem; legacy-peer-deps keeps the tree clean
cp .env.example .env.local        # set VITE_PRIVY_APP_ID, VITE_CONTRACT_ADDRESS, VITE_DEPLOY_BLOCK
npm run dev
```

The app reads everything from the chain; with no `VITE_CONTRACT_ADDRESS` set it tells you so
rather than showing fake data.

---

## Deploy + verify (Monad testnet)

Chain ID `10143` · RPC `https://testnet-rpc.monad.xyz` · Explorer
`https://testnet.monadexplorer.com` · Faucet `https://faucet.monad.xyz`

```bash
cd contracts
cp ../.env.example ../.env      # fill DEPLOYER_PRIVATE_KEY (+ RESIDENT1/2 for seeding)
set -a; . ../.env; set +a

# 1. Deploy
forge script script/Deploy.s.sol --rpc-url $MONAD_RPC_URL --broadcast
#   → note the deployed address and its deploy block

# 2. Verify (per docs.monad.xyz/guides/verify-smart-contract)
forge verify-contract <ADDRESS> src/EstateFund.sol:EstateFund \
  --chain-id 10143 --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org

# 3. Seed the demo estate with REAL transactions (two passes around the delay window)
FUND_ADDRESS=<ADDRESS> forge script script/Seed.s.sol --rpc-url $MONAD_RPC_URL --broadcast --slow
#   wait ~120s, then:
FUND_ADDRESS=<ADDRESS> PASS=2 forge script script/Seed.s.sol --rpc-url $MONAD_RPC_URL --broadcast

# 4. Wire the frontend
#   web/.env.local:  VITE_CONTRACT_ADDRESS=<ADDRESS>   VITE_DEPLOY_BLOCK=<deploy block>
```

Then deploy `web/` to Vercel or Cloudflare Pages (build `npm run build`, output `dist/`,
SPA rewrite already in `web/vercel.json`). Paste the four **Live links** above.

---

## Repo layout

```
kedere/
├── contracts/            # Foundry
│   ├── src/EstateFund.sol
│   ├── test/EstateFund.t.sol      # 29 tests
│   └── script/{Deploy,Seed}.s.sol
├── web/                  # Vite + React + TS + wagmi/viem (event-driven, no backend)
├── README.md
└── SUBMISSION.md
```
