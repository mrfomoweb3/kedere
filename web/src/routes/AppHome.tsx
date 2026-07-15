import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { useWrite } from "../lib/useWrite";
import { WalletButton } from "../components/WalletButton";
import { useNavigate } from "../router";
import { ESTATE_FUND_ABI, ESTATE_FUND_ADDRESS } from "../contract/config";

export function AppHome() {
  const { ready, authenticated } = usePrivy();
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
    <div className="apphome">
      <header className="topbar">
        <div className="container spread">
          <button className="brand brand-btn" onClick={() => navigate("/")}>
            <span className="brand-mark">K</span>
            <span className="brand-name">KEDERE</span>
          </button>
          <WalletButton />
        </div>
      </header>

      <div className="container apphome-inner">
        {!ready ? (
          <div className="card center-note-card">
            <p className="muted">Loading…</p>
          </div>
        ) : !authenticated ? (
          <div className="card gate-card">
            <h2 className="action-title">Sign in to continue</h2>
            <p className="muted">
              Create an account or connect a wallet to start or join an estate.
            </p>
            <WalletButton />
            <button className="btn btn-ghost" onClick={() => navigate("/")}>
              ← Back to home
            </button>
          </div>
        ) : (
          <>
            <div className="apphome-head">
              <h1 className="apphome-title">Your estates</h1>
              <p className="muted">
                Start a new fund for your community, or join one your chairman
                shared a code for.
              </p>
            </div>

            <div className="apphome-cards">
              <form className="card action-card" onSubmit={handleCreate}>
                <h3 className="action-title">Create an estate</h3>
                <p className="muted action-desc">
                  You become chairman. Share the ID + code with residents.
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

              <form
                className="card action-card action-card-alt"
                onSubmit={handleJoin}
              >
                <h3 className="action-title">Join an estate</h3>
                <p className="muted action-desc">
                  Enter the estate ID and code your chairman shared.
                </p>
                <div className="field">
                  <label>Estate ID</label>
                  <input
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    placeholder="0"
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

            <p className="apphome-demo muted">
              Just looking? Open the public demo estate:{" "}
              <a
                href="/estate/0"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/estate/0");
                }}
              >
                Peace Court Estate →
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
