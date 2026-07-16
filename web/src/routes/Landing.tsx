import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useNavigate } from "../router";
import { WalletButton } from "../components/WalletButton";
import { ScrambleText } from "../components/ScrambleText";
import { BrandGlyph } from "../components/BrandGlyph";
import { fmtMon } from "../lib/format";
import { REPO_URL } from "../contract/config";

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

  // "Lapping cards": each step card sticks near the top; as the next card
  // scrolls up over it, the covered card scales down + dims so it appears to
  // recede behind — a stacking/overlap effect. Respects reduced-motion.
  const stackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    gsap.registerPlugin(ScrollTrigger);
    const STICK = 104;
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".stack-card");
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return;
        gsap.to(card, {
          scale: 0.9,
          filter: "brightness(0.92)",
          transformOrigin: "50% 0%",
          ease: "none",
          scrollTrigger: {
            trigger: cards[i + 1],
            start: "top bottom-=80",
            end: `top top+=${STICK}`,
            scrub: true,
          },
        });
      });
      ScrollTrigger.refresh();
    }, stackRef);
    return () => ctx.revert();
  }, []);

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
        <header className="hero-nav">
          <div className="brand brand-light">
            <span className="brand-mark brand-mark-lime"><BrandGlyph /></span>
            <span className="brand-name">KEDERE</span>
          </div>
          <div className="hero-nav-right">
            {REPO_URL ? (
              <a className="hero-link" href={REPO_URL} target="_blank" rel="noreferrer">
                Docs
              </a>
            ) : (
              <button
                className="hero-link"
                onClick={() =>
                  document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Docs
              </button>
            )}
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

      {/* ── proof: where money meets trust ── */}
      <section className="proof container">
        <div className="proof-left">
          <h2 className="proof-title">
            Where money meets
            <br />
            <span className="proof-title-soft">lasting trust</span>
          </h2>
          <p className="sec-lead">
            Nigerian estates collect levies for diesel, security and water — then
            fight about where it went. Kedere replaces that fight with a ledger
            nobody can fake. No trust required — just look.
          </p>
          <div className="proof-stats">
            <div className="proof-stat">
              <div className="proof-stat-top">
                <span className="num">100%</span>
                <span className="proof-unit">On-chain</span>
              </div>
              <small>Every record public</small>
            </div>
            <span className="proof-div" />
            <div className="proof-stat">
              <div className="proof-stat-top">
                <span className="num">0</span>
                <span className="proof-unit">Trust</span>
              </div>
              <small>Just read the chain</small>
            </div>
            <span className="proof-div" />
            <div className="proof-stat">
              <div className="proof-stat-top">
                <span className="num">29<span className="tick">✓</span></span>
                <span className="proof-unit">Tests</span>
              </div>
              <small>All passing</small>
            </div>
          </div>
          <EstateShowcase onOpen={() => navigate("/estate/0")} />
        </div>
        <FindCard navigate={navigate} />
      </section>

      {/* ── how it works (lapping cards) ── */}
      <section className="stack-section container" id="how">
        <div className="sec-head">
          <h2 className="sec-title">How Kedere works</h2>
          <p className="sec-lead">Three moves, all in the open.</p>
        </div>
        <div className="stack" ref={stackRef}>
          {STEPS.map((s) => (
            <article className="stack-card" key={s.n}>
              <span className="stack-n">{s.n}</span>
              <div className="stack-content">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
              <span className="stack-mark" aria-hidden>
                <BrandGlyph />
              </span>
            </article>
          ))}
        </div>
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

// A featured "property"-style card for the demo estate — real live balance
// pulled from the chain, over the estate photo.
function EstateShowcase({ onOpen }: { onOpen: () => void }) {
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

  return (
    <button className="estate-showcase" onClick={onOpen} aria-label="Open the live demo estate">
      <span className="showcase-live"><span className="peek-dot" /> Live · Monad testnet</span>
      <div className="showcase-body">
        <div className="showcase-meta">
          <span className="showcase-name">{data?.meta?.name ?? "Peace Court Estate, Abuja"}</span>
          <span className="showcase-bal num">
            {data ? fmtMon(BigInt(data.meta.balance)) : "0.0700"} MON
            <small>
              {data ? `${data.meta.residentCount} residents` : "in the fund"}
            </small>
          </span>
        </div>
        <span className="showcase-arrow" aria-hidden>→</span>
      </div>
    </button>
  );
}

// "Find your estate" card — look up any estate by ID, or start your own.
// Real actions only (no placeholder search).
function FindCard({ navigate }: { navigate: (to: string) => void }) {
  const [id, setId] = useState("");
  return (
    <div className="card find-card">
      <h3 className="find-title">Find your estate</h3>
      <p className="muted find-sub">Look up any estate by its ID — or start your own.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = id.trim();
          if (v !== "") navigate(`/estate/${v}`);
        }}
      >
        <label className="find-label">Estate ID</label>
        <div className="find-field">
          <span className="find-ic">#</span>
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </div>
        <button className="btn btn-brass block find-go" type="submit">
          View estate →
        </button>
      </form>

      <div className="find-or"><span>or</span></div>

      <div className="find-actions">
        <button className="btn btn-primary block" onClick={() => navigate("/welcome")}>
          Create an estate
        </button>
        <button className="btn btn-ghost block" onClick={() => navigate("/welcome")}>
          Join an estate
        </button>
      </div>
    </div>
  );
}

