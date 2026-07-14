import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { useAccount } from "wagmi";
import { useWrite } from "../lib/useWrite";
import { WalletButton } from "../components/WalletButton";
import { useNavigate } from "../router";
import { usePublicClient } from "wagmi";
import { ESTATE_FUND_ABI, ESTATE_FUND_ADDRESS } from "../contract/config";

export function Landing() {
  const { isConnected } = useAccount();
  const { send, busy } = useWrite();
  const navigate = useNavigate();
  const publicClient = usePublicClient();

  // create
  const [name, setName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [delayMin, setDelayMin] = useState("2");

  // join
  const [joinId, setJoinId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [unit, setUnit] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const delaySec = BigInt(Math.round(parseFloat(delayMin || "2") * 60));
    const before = (await publicClient!.readContract({
      address: ESTATE_FUND_ADDRESS,
      abi: ESTATE_FUND_ABI as any,
      functionName: "estateCount",
    })) as bigint;
    await send({
      functionName: "createEstate",
      args: [name, keccak256(toBytes(createCode)), delaySec],
      pending: "Creating your estate…",
      success: `Estate "${name}" created.`,
      onDone: () => navigate(`/estate/${before.toString()}`),
    });
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    await send({
      functionName: "joinEstate",
      args: [BigInt(joinId), joinCode, unit],
      pending: "Joining the estate…",
      success: "You've joined the estate.",
      onDone: () => navigate(`/estate/${joinId}`),
    });
  }

  return (
    <div className="landing">
      <header className="topbar">
        <div className="container spread">
          <div className="brand">
            <span className="brand-mark">K</span>
            <span className="brand-name">KEDERE</span>
          </div>
          <WalletButton />
        </div>
      </header>

      <section className="hero container">
        <div className="hero-copy">
          <span className="eyebrow">Onchain estate levy fund · Monad</span>
          <h1 className="hero-title">
            Owó estate yín,
            <br />
            <span className="hero-accent">hàn kedere.</span>
          </h1>
          <p className="hero-tagline">Your estate's money, in plain sight.</p>
          <p className="hero-hook">
            Every estate has the “where is our money?” fight. Kedere ends it —
            every contribution is publicly attributed, and the chairman can't
            move a single unit of funds without a public proposal that survives a
            delay window residents can block.
          </p>
          <p className="hero-claim">
            The levy fight ends here. <strong>No trust required — just look.</strong>
          </p>
          {!isConnected && (
            <div className="hero-connect">
              <WalletButton />
              <span className="muted">Connect to create or join an estate.</span>
            </div>
          )}
        </div>

        <div className="hero-cards">
          <form className="card action-card" onSubmit={handleCreate}>
            <h3 className="action-title">Create an estate</h3>
            <p className="muted action-desc">
              Start a fund for your community. You become chairman.
            </p>
            <div className="field">
              <label>Estate name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Peace Court Estate, Abuja"
                required
              />
            </div>
            <div className="field">
              <label>Join code</label>
              <input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="sunrise-04"
                required
              />
            </div>
            <div className="field">
              <label>Delay window (minutes)</label>
              <input
                type="number"
                min="1"
                max="10080"
                step="1"
                value={delayMin}
                onChange={(e) => setDelayMin(e.target.value)}
                required
              />
            </div>
            <button
              className="btn btn-primary block"
              disabled={!isConnected || busy !== null}
              type="submit"
            >
              Create estate
            </button>
          </form>

          <form className="card action-card action-card-alt" onSubmit={handleJoin}>
            <h3 className="action-title">Join an estate</h3>
            <p className="muted action-desc">
              Enter the estate ID and code your chairman shared.
            </p>
            <div className="field">
              <label>Estate ID</label>
              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="1"
                inputMode="numeric"
                required
              />
            </div>
            <div className="field">
              <label>Join code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="sunrise-04"
                required
              />
            </div>
            <div className="field">
              <label>Your unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Block C, Flat 7"
                required
              />
            </div>
            <button
              className="btn btn-lime block"
              disabled={!isConnected || busy !== null}
              type="submit"
            >
              Join estate
            </button>
          </form>
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

      <footer className="landing-foot container">
        <span className="muted">
          Kedere · Yoruba for “in plain sight” · built on Monad testnet
        </span>
      </footer>
    </div>
  );
}
