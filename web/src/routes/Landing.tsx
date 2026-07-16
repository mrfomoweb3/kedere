import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useNavigate } from "../router";
import { WalletButton } from "../components/WalletButton";
import { ScrambleText } from "../components/ScrambleText";

// "Your estate's money, in plain sight." across Nigeria's three major
// languages + English. Translations are approximate — easy to tweak.
const PHRASES = [
  { a: "Your estate's money,", b: "in plain sight." }, // English
  { a: "Owó estate yín,", b: "hàn kedere." }, // Yoruba
  { a: "Ego obodo unu,", b: "pụta ìhè." }, // Igbo
  { a: "Kuɗin gidanku,", b: "a bayyane yake." }, // Hausa
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
      <section className="hero-bleed">
        <HeroSkyline />

        <header className="hero-nav">
          <div className="brand brand-light">
            <span className="brand-mark brand-mark-lime">K</span>
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
            <button
              className="btn btn-outline-light btn-lg"
              onClick={() => navigate("/estate/0")}
            >
              View a live estate
            </button>
          </div>
        </div>
      </section>

      <section className="how container">
        <div className="how-item">
          <span className="how-num">01</span>
          <h3>Residents pay levies</h3>
          <p className="muted">
            Every contribution is attributed to a unit and pinned to a public
            ledger. No more receipts lost in a WhatsApp group.
          </p>
        </div>
        <div className="how-item">
          <span className="how-num">02</span>
          <h3>Spending is proposed first</h3>
          <p className="muted">
            The chairman writes a plain memo — “Diesel — 500L — July” — and it
            waits in a public delay window before any money can move.
          </p>
        </div>
        <div className="how-item">
          <span className="how-num">03</span>
          <h3>Residents can block it</h3>
          <p className="muted">
            If most residents object during the window, the money doesn't move
            at all. The chain is the ledger — nothing leaves silently.
          </p>
        </div>
      </section>

      <section className="cta-band container">
        <div className="card cta-band-card">
          <div>
            <h2 className="cta-band-title">
              Put your estate's money in plain sight.
            </h2>
            <p className="muted">Create a fund in under a minute — or join yours.</p>
          </div>
          <button className="btn btn-lime btn-lg" onClick={getStarted}>
            {isConnected ? "Open app →" : "Get started →"}
          </button>
        </div>
      </section>

      <footer className="landing-foot container">
        <span className="muted">
          Kedere · Yoruba for “in plain sight” · built on Monad testnet
        </span>
      </footer>
    </div>
  );
}

// A quiet row of estate rooftops along the base of the hero.
function HeroSkyline() {
  return (
    <svg
      className="hero-skyline"
      viewBox="0 0 1440 220"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
    >
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
