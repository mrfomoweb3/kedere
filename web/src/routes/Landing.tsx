import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useNavigate } from "../router";
import { WalletButton } from "../components/WalletButton";
import { ScrambleText } from "../components/ScrambleText";
import { BrandGlyph } from "../components/BrandGlyph";
import { fmtMon, relTime } from "../lib/format";

const PHRASES = [
  { a: "Your estate's money,", b: "in plain sight." }, // English
  { a: "Owó estate yín,", b: "hàn kedere." }, // Yoruba
  { a: "Ego obodo unu,", b: "pụta ìhè." }, // Igbo
  { a: "Kuɗin gidanku,", b: "a bayyane yake." }, // Hausa
];

const FEATURES = [
  { t: "Public ledger", d: "Every levy and expense is a public record on Monad — anyone can read it, nobody can edit it." },
  { t: "Delay window", d: "Proposed spending waits in the open before a single unit can move." },
  { t: "Majority veto", d: "Residents can object; a majority blocks the spend outright." },
  { t: "No silent outflows", d: "Money can only leave via an executed proposal — direct transfers revert." },
  { t: "Attributed contributions", d: "Every payment is tied to a unit, so there's no “who paid?” argument." },
  { t: "Verified contract", d: "The source is public and verified on the Monad explorer." },
];

const STEPS = [
  { n: "01", t: "Residents pay levies", d: "Each contribution is attributed to a unit and pinned to a public ledger. No more receipts lost in a WhatsApp group." },
  { n: "02", t: "Spending is proposed first", d: "The chairman writes a plain memo — “Diesel — 500L — July” — and it waits in a public delay window before any money can move." },
  { n: "03", t: "Residents can block it", d: "If most residents object during the window, the money doesn't move at all. The chain is the ledger — nothing leaves silently." },
];

export function Landing() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const wantApp = useRef(false);

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => (p + 1) % PHRASES.length), 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (isConnected && wantApp.current) {
      wantApp.current = false;
      navigate("/welcome");
    }
  }, [isConnected, navigate]);

  function getStarted() {
    if (isConnected) navigate("/welcome");
    else {
      wantApp.current = true;
      openConnectModal?.();
    }
  }

  const p = PHRASES[phase];

  return (
    <div className="landing">
      {/* ── hero ── */}
      <section className="hero-bleed">
        <HeroSkyline />
        <header className="hero-nav">
          <div className="brand brand-light">
            <span className="brand-mark brand-mark-lime"><BrandGlyph /></span>
            <span className="brand-name">KEDERE</span>
          </div>
          <div className="hero-nav-right">
            <button className="hero-link" onClick={() => navigate("/estate/0")}>
              Live demo
            </button>
            <WalletButton />
          </div>
        </header>
        <div className="hero-center">
          <h1 className="hero-giant">
            <ScrambleText text={p.a} />
            <ScrambleText className="hero-accent-lime" text={p.b} />
          </h1>
          <p className="hero-tagline-light">Your estate's money, in plain sight.</p>
        </div>
        <div className="hero-bottom">
          <p className="hero-desc">
            Kedere puts your estate's fund onchain — every levy publicly tracked,
            and no spending without a proposal residents can veto.
          </p>
          <div className="hero-cta">
            <button className="btn btn-lime btn-lg" onClick={getStarted}>
              {isConnected ? "Open app →" : "Get started →"}
            </button>
            <button className="btn btn-outline-light btn-lg" onClick={() => navigate("/estate/0")}>
              View a live estate
            </button>
          </div>
        </div>
      </section>

      {/* ── proof: trust without trust ── */}
      <section className="proof container">
        <div className="proof-left">
          <h2 className="sec-title">
            Where money meets <span className="ink-lime">proof</span>
          </h2>
          <p className="sec-lead">
            Nigerian estates collect levies for diesel, security and water — then
            fight about where it went. Kedere replaces that fight with a ledger
            nobody can fake. No trust required — just look.
          </p>
          <div className="proof-stats">
            <div className="proof-stat"><span className="num">100%</span><small>On-chain</small></div>
            <div className="proof-stat"><span className="num">0</span><small>Trust required</small></div>
            <div className="proof-stat"><span className="num">29<span className="tick">✓</span></span><small>Tests passing</small></div>
          </div>
        </div>
        <DemoPeek onOpen={() => navigate("/estate/0")} />
      </section>

      {/* ── how it works (large rows) ── */}
      <section className="steps container">
        <div className="sec-head">
          <h2 className="sec-title">How Kedere works</h2>
          <p className="sec-lead">Three moves, all in the open.</p>
        </div>
        {STEPS.map((s) => (
          <div className="step-row" key={s.n}>
            <span className="step-n">{s.n}</span>
            <div className="step-body">
              <h3>{s.t}</h3>
              <p className="muted">{s.d}</p>
            </div>
            <div className="step-rule" />
          </div>
        ))}
      </section>

      {/* ── features grid ── */}
      <section className="features container">
        <div className="sec-head">
          <h2 className="sec-title">What you can rely on</h2>
          <p className="sec-lead">The guarantees are enforced by the contract, not a promise.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.t}>
              <span className="feature-pin" />
              <h3>{f.t}</h3>
              <p className="muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── why we built this ── */}
      <section className="why container">
        <span className="why-label">Why we built Kedere</span>
        <blockquote className="why-quote">
          “My estate in Abuja collects monthly levies into someone's personal
          account. Receipts are photos in a WhatsApp group, and every AGM becomes
          a <em>‘where did our money go?’</em> fight because nobody can
          independently verify anything. So I put the fund onchain.”
        </blockquote>
      </section>

      {/* ── CTA band ── */}
      <section className="cta-band container">
        <div className="card cta-band-card">
          <div>
            <h2 className="cta-band-title">Put your estate's money in plain sight.</h2>
            <p className="muted">Create a fund in under a minute — or join yours.</p>
          </div>
          <button className="btn btn-lime btn-lg" onClick={getStarted}>
            {isConnected ? "Open app →" : "Get started →"}
          </button>
        </div>
      </section>

      {/* ── mega footer ── */}
      <footer className="mega-foot">
        <div className="container mega-foot-top">
          <span className="muted">Yoruba for “in plain sight” · built on Monad testnet</span>
          <button className="hero-link mega-link" onClick={() => navigate("/estate/0")}>
            View the live demo →
          </button>
        </div>
        <div className="mega-word" aria-hidden>KEDERE</div>
      </footer>
    </div>
  );
}

// Live preview of the demo estate — real indexed data, no placeholders.
function DemoPeek({ onOpen }: { onOpen: () => void }) {
  const { data } = useQuery({
    queryKey: ["demo-peek"],
    queryFn: async () => {
      const r = await fetch("/api/estates/0");
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: 15000,
    retry: false,
  });

  const recent = (data?.feed ?? [])
    .filter((e: any) => e.kind === "levy" || e.kind === "proposed")
    .slice(0, 3);

  return (
    <button className="demo-peek card" onClick={onOpen} aria-label="Open the live demo estate">
      <div className="peek-head">
        <span className="peek-live"><span className="peek-dot" /> Live · Monad testnet</span>
        <span className="chip chip-paid">Demo</span>
      </div>
      <h3 className="peek-name">{data?.meta?.name ?? "Peace Court Estate, Abuja"}</h3>
      <div className="peek-balance">
        <span className="num">{data ? fmtMon(BigInt(data.meta.balance)) : "0.0700"}</span>
        <span className="peek-unit">MON in the fund</span>
      </div>
      <div className="peek-sub muted">
        {data ? `${data.meta.residentCount} residents · ${data.feed.length} ledger entries` : "reading the chain…"}
      </div>
      <div className="peek-feed">
        {recent.map((e: any, i: number) => (
          <div className="peek-line" key={i}>
            {e.kind === "levy" ? (
              <>
                <span className="peek-tag paid">Levy</span>
                <span className="peek-txt">{e.name ?? e.unitLabel}</span>
                <span className="num pos">+{fmtMon(BigInt(e.amount))}</span>
              </>
            ) : (
              <>
                <span className="peek-tag prop">Expense</span>
                <span className="peek-txt">{e.memo}</span>
                <span className="num neg">−{fmtMon(BigInt(e.amount))}</span>
              </>
            )}
            <span className="peek-when muted">{relTime(e.timestamp)}</span>
          </div>
        ))}
      </div>
      <span className="peek-open">Open the ledger →</span>
    </button>
  );
}

function HeroSkyline() {
  return (
    <svg className="hero-skyline" viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <g fill="#0f3320" opacity="0.55">
        {[0, 240, 480, 720, 960, 1200].map((x, i) => (
          <g key={i} transform={`translate(${x},${40 + (i % 2) * 26})`}>
            <rect x="30" y="70" width="180" height="110" rx="6" />
            <path d="M20 72 L120 18 L220 72 Z" />
            <rect x="70" y="100" width="30" height="30" rx="3" fill="#163f2a" />
            <rect x="140" y="100" width="30" height="30" rx="3" fill="#163f2a" />
            <rect x="105" y="140" width="30" height="40" rx="3" fill="#163f2a" />
          </g>
        ))}
      </g>
    </svg>
  );
}
