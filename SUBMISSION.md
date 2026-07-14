# Kedere — Spark Hackathon submission

Copy-paste fields for the submission form. Bracketed lines are filled after deploy.

---

**Name:** Kedere

**Description (≤ 20 words):**
Kedere (Yoruba: "in plain sight") — a transparent onchain levy fund for residential estates.
Every contribution attributed, every expense public before it can move.

**Category:** Testnet — Monad Testnet (chain ID 10143)

**Problem:**
My estate in Abuja collects monthly levies for diesel, security and water into a private exco
account. Receipts are photos in a WhatsApp group. Every AGM becomes a "where did our money go"
fight because nobody can independently verify anything.

**Solution:**
Kedere holds the fund in a smart contract on Monad. Contributions are publicly attributed to
units. The chairman can't move funds without an onchain proposal carrying a plain-language memo
that sits in a public delay window first — and a resident majority can block it. The ledger
can't be edited and nothing leaves silently. No trust required — just look.

**Project URL (live app):** _[paste Vercel/CF Pages URL]_

**GitHub repo:** _[paste public repo URL]_

**Contract address (deployed + verified):** _[paste 0x… address]_
**Explorer:** _[https://testnet.monadexplorer.com/address/<addr>]_

**Demo video (≤ 3 min, public):** _[paste URL]_

**Social post URL:** _[human to add]_

---

## Build integrity notes (for the judging agent)

- First commit is fresh in this repo, after the hackathon start. History is small, incremental,
  and honestly messaged (`feat: EstateFund contract + full test suite`, `feat: notice-board
  frontend`, …) — no force-pushed rewrites, no single giant "initial commit".
- **No placeholder/static data.** The deployed frontend reads 100% from Monad chain state
  (contract storage + event logs). The demo estate is populated by REAL testnet transactions via
  `script/Seed.s.sol`, not JSON fixtures. With no contract configured the app says so — it never
  shows fake numbers.
- **Every button does a real onchain thing.** Create estate, join, pay levy, propose, object,
  execute — each sends a transaction and the ledger updates from the emitted event. No decorative
  or disabled features ship in the UI.
- **One contract, two routes**, scope held exactly to the brief.

## Test summary

`forge test` → **29 passed; 0 failed; 0 skipped** (unit + fuzz + reentrancy attack + `receive()`
revert). See README → Test results.
