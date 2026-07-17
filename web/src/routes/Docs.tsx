import { useNavigate } from "../router";
import { BrandGlyph } from "../components/BrandGlyph";
import { ESTATE_FUND_ADDRESS, explorerAddr } from "../contract/config";

const TOC = [
  ["what", "What is Kedere"],
  ["how", "How it works"],
  ["lifecycle", "The expense lifecycle"],
  ["architecture", "Architecture"],
  ["security", "Security model"],
  ["dashboard", "The dashboard"],
  ["try", "Try it in 60s"],
  ["reference", "Reference"],
] as const;

export function Docs() {
  const navigate = useNavigate();
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="docs">
      <header className="topbar">
        <div className="container spread">
          <button className="brand brand-btn" onClick={() => navigate("/")}>
            <span className="brand-mark"><BrandGlyph /></span>
            <span className="brand-name">KEDERE</span>
            <span className="docs-badge">Docs</span>
          </button>
          <div className="row">
            <button className="hero-link docs-navlink" onClick={() => navigate("/estate/0")}>Live demo</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/welcome")}>Open app</button>
          </div>
        </div>
      </header>

      <div className="container docs-hero">
        <h1 className="docs-h1">Kedere documentation</h1>
        <p className="docs-lead">
          Kedere (Yoruba: <em>“in plain sight”</em>) is a transparent, onchain levy fund for
          residential estates. This guide explains what it does, how the money and rules live on
          Monad, and how the app is built — with diagrams and screenshots.
        </p>
      </div>

      <div className="container docs-body">
        <nav className="docs-toc">
          <span className="docs-toc-label">On this page</span>
          {TOC.map(([id, label]) => (
            <button key={id} className="docs-toc-item" onClick={() => go(id)}>{label}</button>
          ))}
          <a className="docs-toc-item" href={explorerAddr(ESTATE_FUND_ADDRESS)} target="_blank" rel="noreferrer">Contract ↗</a>
        </nav>

        <main className="docs-content">
          {/* What */}
          <section id="what" className="docs-sec">
            <h2>What is Kedere</h2>
            <p>
              Nigerian estates collect monthly levies for diesel, security, water and repairs. The
              money usually lands in an exco member's personal account, receipts are photos in a
              WhatsApp group, and every AGM becomes a <em>“where did our money go?”</em> fight.
            </p>
            <p>
              Kedere puts the fund itself onchain. Every resident contribution is publicly
              attributed to a unit, and the chairman cannot move a single unit of funds without an
              onchain proposal carrying a plain-language memo that must survive a public delay
              window — during which a resident majority can block it. Residents don't have to trust
              the exco. They just look at the ledger.
            </p>
            <div className="docs-shot">
              <img src="/docs/hero.jpg" alt="Kedere landing page" loading="lazy" />
              <span className="docs-cap">The landing page — “your estate's money, in plain sight”.</span>
            </div>
          </section>

          {/* How */}
          <section id="how" className="docs-sec">
            <h2>How it works</h2>
            <p>
              The system separates <strong>writes</strong> from <strong>reads</strong>. Every action
              that changes money or state is a transaction your wallet signs and sends straight to
              the smart contract — the contract holds the funds and is the single source of truth.
              Reads come back through an indexer + API that mirror the chain for speed.
            </p>
            <Flow
              nodes={["Resident", "Wallet", "Contract (Monad)", "Indexer", "Postgres", "API", "Dashboard"]}
              caption="Writes flow left→right onto the chain; reads are served back from the indexed API. The backend can never move funds."
            />
            <div className="docs-callout">
              <strong>Trust boundary:</strong> money only lives in the contract. If the backend went
              down, the app falls back to reading membership directly from the chain — the ledger is
              never faked.
            </div>
          </section>

          {/* Lifecycle */}
          <section id="lifecycle" className="docs-sec">
            <h2>The expense lifecycle</h2>
            <p>Three moves, all in the open:</p>
            <ol className="docs-list">
              <li><strong>Residents pay levies</strong> — each contribution is attributed to a unit and pinned to the public ledger.</li>
              <li><strong>The chairman proposes spending</strong> — with a plain memo like “Diesel — 500L — July”. This does <em>not</em> move money; it starts a public delay window.</li>
              <li><strong>Residents can block it</strong> — anyone can object during the window; a strict majority auto-cancels it. Only after the delay, and only if not blocked, can the chairman execute.</li>
            </ol>
            <Lifecycle />
          </section>

          {/* Architecture */}
          <section id="architecture" className="docs-sec">
            <h2>Architecture</h2>
            <div className="docs-grid2">
              <div className="docs-arch-card"><h4>Smart contract</h4><p><code>EstateFund.sol</code> (Solidity 0.8.24) holds the money and enforces every rule. One deployment, many estates. Hand-rolled reentrancy guard, no external deps.</p></div>
              <div className="docs-arch-card"><h4>Indexer</h4><p>A server job reads contract events in ≤100-block chunks (Monad's RPC cap) plus authoritative storage, into Postgres — so the app never chunk-scans in the browser.</p></div>
              <div className="docs-arch-card"><h4>API (Next.js)</h4><p>Serves the full ledger, a wallet's estates, and profiles. SIWE sign-in lets a wallet edit only its own profile.</p></div>
              <div className="docs-arch-card"><h4>Frontend</h4><p>React + wagmi/RainbowKit. Reads from the API; writes go straight to the contract via the connected wallet.</p></div>
            </div>
          </section>

          {/* Security */}
          <section id="security" className="docs-sec">
            <h2>Security model</h2>
            <ul className="docs-checks">
              <li><strong>No unattributed outflows.</strong> Funds can only leave via <code>executeExpense</code> after the full delay; <code>receive()</code>/<code>fallback()</code> revert.</li>
              <li><strong>Delay window.</strong> Executable only at <code>proposedAt + proposalDelay</code> (60s–7d); the chairman can never execute early, re-execute, or overspend.</li>
              <li><strong>Resident veto.</strong> Objections passing a strict majority auto-cancel a proposal.</li>
              <li><strong>Reentrancy-safe.</strong> <code>nonReentrant</code> + effects-before-interaction; a malicious recipient can't drain the fund.</li>
              <li><strong>Hardened app.</strong> Security headers (CSP/HSTS/anti-clickjacking), SIWE bound to domain + chain, gated indexer endpoint, parameterized DB queries.</li>
            </ul>
            <div className="docs-callout docs-callout-warn">
              <strong>Honest limitation:</strong> the chairman is a single signer. A production estate
              should put the chairman role behind a multisig (e.g. Gnosis Safe) — the contract's
              access model drops in behind one unchanged.
            </div>
          </section>

          {/* Dashboard */}
          <section id="dashboard" className="docs-sec">
            <h2>The dashboard</h2>
            <p>Each estate has a dashboard with tabbed sections in a labeled sidebar:</p>
            <ul className="docs-list">
              <li><strong>Overview</strong> — fund balance, total collected/spent, a levies chart, and pending proposals.</li>
              <li><strong>Levies</strong> — the full payment history, and a Pay-levy action.</li>
              <li><strong>Expenses</strong> — pending proposals (object/execute) and settled history.</li>
              <li><strong>Residents</strong> — a roster of who's paid and who's owing this month, filterable, with per-resident payment drill-down.</li>
              <li><strong>Profile</strong> — edit your display name (saved via wallet sign-in) and see your contribution.</li>
            </ul>
            <div className="docs-shot"><img src="/docs/overview.jpg" alt="Dashboard overview" loading="lazy" /><span className="docs-cap">Overview — balance, collected/spent, levies chart, and the “in the fund” gauge.</span></div>
            <div className="docs-shot"><img src="/docs/residents.jpg" alt="Residents roster" loading="lazy" /><span className="docs-cap">Residents — who paid, who's owing, total contributed, and a link to each on the explorer.</span></div>
          </section>

          {/* Try it */}
          <section id="try" className="docs-sec">
            <h2>Try it in 60 seconds</h2>
            <ol className="docs-list">
              <li>Open the app and <strong>connect a wallet</strong> (it offers to add/switch to Monad Testnet).</li>
              <li>Get testnet MON from <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">faucet.monad.xyz</a>.</li>
              <li>Open the demo estate <code>/estate/0</code>, join with code <code>sunrise-04</code>, or just read the public ledger.</li>
              <li><strong>Pay a levy</strong> — watch it pin to the ledger, attributed to your unit, linking to the tx on the Monad explorer.</li>
            </ol>
            <div className="docs-cta"><button className="btn btn-primary btn-lg" onClick={() => navigate("/estate/0")}>Open the live demo →</button></div>
          </section>

          {/* Reference */}
          <section id="reference" className="docs-sec">
            <h2>Reference</h2>
            <h4>Contract functions</h4>
            <div className="table-wrap">
              <table className="docs-table">
                <thead><tr><th>Function</th><th>Who</th><th>Effect</th></tr></thead>
                <tbody>
                  <tr><td><code>createEstate</code></td><td>anyone</td><td>Creates an estate; caller = chairman</td></tr>
                  <tr><td><code>joinEstate</code></td><td>anyone w/ code</td><td>Registers a resident + unit</td></tr>
                  <tr><td><code>payLevy</code></td><td>residents</td><td>Pays into the fund, attributed to your unit</td></tr>
                  <tr><td><code>proposeExpense</code></td><td>chairman</td><td>Proposes spending; starts the delay window</td></tr>
                  <tr><td><code>objectToExpense</code></td><td>residents</td><td>Objects during the window; majority auto-cancels</td></tr>
                  <tr><td><code>executeExpense</code></td><td>chairman</td><td>Pays out after the delay if not blocked</td></tr>
                </tbody>
              </table>
            </div>
            <h4>API endpoints</h4>
            <div className="table-wrap">
              <table className="docs-table">
                <thead><tr><th>Route</th><th>Returns</th></tr></thead>
                <tbody>
                  <tr><td><code>GET /api/estates/[id]</code></td><td>Full estate: meta, ledger, expenses, residents</td></tr>
                  <tr><td><code>GET /api/wallets/[addr]/estates</code></td><td>Estates a wallet chairs or lives in</td></tr>
                  <tr><td><code>GET/POST /api/profiles</code></td><td>Read / save a display name (SIWE-gated write)</td></tr>
                  <tr><td><code>/api/auth/*</code></td><td>SIWE nonce · verify · me · logout</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <footer className="docs-foot">
            <span className="muted">Kedere · Yoruba for “in plain sight” · built on Monad testnet</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ── diagram: horizontal flow ────────────────────────────────────────────────
function Flow({ nodes, caption }: { nodes: string[]; caption: string }) {
  return (
    <figure className="flow-fig">
      <div className="flow">
        {nodes.map((n, i) => (
          <div className="flow-item" key={n}>
            <div className="flow-node">{n}</div>
            {i < nodes.length - 1 && <span className="flow-arrow">→</span>}
          </div>
        ))}
      </div>
      <figcaption className="docs-cap">{caption}</figcaption>
    </figure>
  );
}

// ── diagram: expense lifecycle ──────────────────────────────────────────────
function Lifecycle() {
  return (
    <figure className="flow-fig">
      <div className="life">
        <div className="life-node life-green">Levies paid<small>fund grows</small></div>
        <span className="flow-arrow">→</span>
        <div className="life-node life-brass">Proposed<small>+ memo, delay starts</small></div>
        <span className="flow-arrow">→</span>
        <div className="life-branch">
          <div className="life-node life-rust">Majority objects<small>→ Cancelled</small></div>
          <div className="life-or">or</div>
          <div className="life-node life-green">Delay elapses<small>→ Execute → Settled ✓</small></div>
        </div>
      </div>
      <figcaption className="docs-cap">A proposal can only end two ways: blocked by a resident majority, or executed after the public delay.</figcaption>
    </figure>
  );
}
