import { usePrivy, useLogin } from "@privy-io/react-auth";
import { useNavigate } from "../router";

export function Landing() {
  const { authenticated, ready } = usePrivy();
  const navigate = useNavigate();
  const { login } = useLogin({
    onComplete: () => navigate("/app"),
  });

  function getStarted() {
    if (authenticated) navigate("/app");
    else login();
  }

  return (
    <div className="landing">
      <header className="topbar">
        <div className="container spread">
          <div className="brand">
            <span className="brand-mark">K</span>
            <span className="brand-name">KEDERE</span>
          </div>
          <button
            className="btn btn-ghost"
            disabled={!ready}
            onClick={getStarted}
          >
            {authenticated ? "Open app" : "Sign in"}
          </button>
        </div>
      </header>

      <section className="hero-solo container">
        <h1 className="hero-title">
          Owó estate yín,
          <br />
          <span className="hero-accent">hàn kedere.</span>
        </h1>
        <p className="hero-tagline">Your estate's money, in plain sight.</p>
        <p className="hero-hook">
          Kedere puts your estate's fund onchain, every levy publicly tracked
          and no spending without a proposal residents can veto.
        </p>
        <div className="hero-cta">
          <button className="btn btn-primary btn-lg" onClick={getStarted} disabled={!ready}>
            {authenticated ? "Open app →" : "Get started →"}
          </button>
          <button
            className="btn btn-ghost btn-lg"
            onClick={() => navigate("/estate/0")}
          >
            View a live estate
          </button>
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
            <h2 className="cta-band-title">Put your estate's money in plain sight.</h2>
            <p className="muted">Create a fund in under a minute — or join yours.</p>
          </div>
          <button className="btn btn-lime btn-lg" onClick={getStarted} disabled={!ready}>
            {authenticated ? "Open app →" : "Get started →"}
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
