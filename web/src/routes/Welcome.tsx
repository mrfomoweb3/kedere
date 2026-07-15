import { useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useWrite } from "../lib/useWrite";
import { WalletButton } from "../components/WalletButton";
import { useNavigate } from "../router";
import { getProfile, saveProfile, clearProfile } from "../lib/profile";
import { ESTATE_FUND_ABI, ESTATE_FUND_ADDRESS } from "../contract/config";

type Step = "checking" | "connect" | "choose" | "chairman" | "resident";
const abi = ESTATE_FUND_ABI as any;

export function Welcome() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { send, busy } = useWrite();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("checking");

  // ── returning-wallet detection ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isConnected || !address) {
        setStep("connect");
        return;
      }
      setStep("checking");
      const p = getProfile(address);
      if (p && publicClient) {
        try {
          let ok = false;
          if (p.role === "chairman") {
            const est = (await publicClient.readContract({
              address: ESTATE_FUND_ADDRESS,
              abi,
              functionName: "estates",
              args: [BigInt(p.estateId)],
            })) as any[];
            ok = (est[1] as string).toLowerCase() === address.toLowerCase();
          } else {
            ok = (await publicClient.readContract({
              address: ESTATE_FUND_ADDRESS,
              abi,
              functionName: "isResident",
              args: [BigInt(p.estateId), address],
            })) as boolean;
          }
          if (!cancelled && ok) {
            navigate(`/estate/${p.estateId}`);
            return;
          }
        } catch {
          /* fall through to role choice */
        }
        if (!cancelled) clearProfile(address);
      }
      if (!cancelled) setStep("choose");
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, publicClient, navigate]);

  return (
    <div className="welcome">
      <header className="topbar">
        <div className="container spread">
          <button className="brand brand-btn" onClick={() => navigate("/")}>
            <span className="brand-mark">K</span>
            <span className="brand-name">KEDERE</span>
          </button>
          <WalletButton />
        </div>
      </header>

      <div className="container welcome-inner">
        {step === "checking" && (
          <div className="card center-note-card">
            <div className="spinner" />
            <p className="muted">Checking your account…</p>
          </div>
        )}

        {step === "connect" && (
          <div className="card gate-card">
            <h2 className="action-title">Connect to get started</h2>
            <p className="muted">
              Connect your wallet — it's your login. We'll take you to your
              dashboard, or set you up if you're new.
            </p>
            <WalletButton />
            <button className="btn btn-ghost" onClick={() => navigate("/")}>
              ← Back to home
            </button>
          </div>
        )}

        {step === "choose" && <ChooseRole onPick={setStep} />}
        {step === "chairman" && (
          <ChairmanSetup
            address={address!}
            send={send}
            busy={busy}
            publicClient={publicClient}
            navigate={navigate}
            back={() => setStep("choose")}
          />
        )}
        {step === "resident" && (
          <ResidentSetup
            address={address!}
            send={send}
            busy={busy}
            publicClient={publicClient}
            navigate={navigate}
            back={() => setStep("choose")}
          />
        )}
      </div>
    </div>
  );
}

// ── role choice ───────────────────────────────────────────────────────────
function ChooseRole({ onPick }: { onPick: (s: Step) => void }) {
  return (
    <div className="choose">
      <div className="choose-head">
        <h1 className="apphome-title">Who are you in your estate?</h1>
        <p className="muted">Pick your role to get set up. You can hold both.</p>
      </div>
      <div className="role-cards">
        <button className="card role-card" onClick={() => onPick("chairman")}>
          <span className="role-badge role-badge-green">
            <ChairIcon />
          </span>
          <h3>I'm the Chairman</h3>
          <p className="muted">
            Create and run your estate's fund. Propose spending with a public
            memo and execute it after the delay window.
          </p>
          <span className="role-go">Set up my estate →</span>
        </button>

        <button className="card role-card" onClick={() => onPick("resident")}>
          <span className="role-badge role-badge-lime">
            <HomeIcon />
          </span>
          <h3>I'm a Resident</h3>
          <p className="muted">
            Join your estate with its code, pay your levy, and object to any
            spending you disagree with.
          </p>
          <span className="role-go">Join my estate →</span>
        </button>
      </div>
    </div>
  );
}

// ── chairman setup ────────────────────────────────────────────────────────
function ChairmanSetup({ address, send, busy, publicClient, navigate, back }: any) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [delayMin, setDelayMin] = useState("2");
  const [existingId, setExistingId] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const delaySec = BigInt(Math.round(parseFloat(delayMin || "2") * 60));
    const before = (await publicClient.readContract({
      address: ESTATE_FUND_ADDRESS,
      abi,
      functionName: "estateCount",
    })) as bigint;
    await send({
      functionName: "createEstate",
      args: [name, keccak256(toBytes(code)), delaySec],
      pending: "Creating your estate…",
      success: `Estate "${name}" created.`,
      onDone: () => {
        saveProfile(address, {
          role: "chairman",
          estateId: before.toString(),
        });
        navigate(`/estate/${before.toString()}`);
      },
    });
  }

  async function resume(e: React.FormEvent) {
    e.preventDefault();
    const est = (await publicClient.readContract({
      address: ESTATE_FUND_ADDRESS,
      abi,
      functionName: "estates",
      args: [BigInt(existingId)],
    })) as any[];
    if ((est[1] as string).toLowerCase() === address.toLowerCase()) {
      saveProfile(address, { role: "chairman", estateId: existingId });
      navigate(`/estate/${existingId}`);
    } else {
      alert("That estate isn't chaired by this wallet.");
    }
  }

  return (
    <div className="setup">
      <button className="setup-back" onClick={back}>
        ← Change role
      </button>
      <div className="setup-grid">
        <form className="card action-card" onSubmit={create}>
          <h3 className="action-title">Create your estate</h3>
          <p className="muted action-desc">
            You become chairman. Share the estate ID + code with residents.
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
            <label>Join code (residents use this)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="sunrise-04"
              required
            />
          </div>
          <div className="field">
            <label>Spending delay window (minutes)</label>
            <input
              type="number"
              min="1"
              max="10080"
              value={delayMin}
              onChange={(e) => setDelayMin(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary block" disabled={busy !== null} type="submit">
            Create estate
          </button>
        </form>

        <form className="card resume-card" onSubmit={resume}>
          <h3 className="action-title">Already have one?</h3>
          <p className="muted action-desc">
            Enter your estate's ID to open its dashboard.
          </p>
          <div className="field">
            <label>Estate ID</label>
            <input
              value={existingId}
              onChange={(e) => setExistingId(e.target.value)}
              placeholder="0"
              inputMode="numeric"
              required
            />
          </div>
          <button className="btn btn-ghost block" type="submit">
            Open my estate
          </button>
        </form>
      </div>
    </div>
  );
}

// ── resident setup ────────────────────────────────────────────────────────
function ResidentSetup({ address, send, busy, publicClient, navigate, back }: any) {
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    // already a resident? just go in.
    const already = (await publicClient.readContract({
      address: ESTATE_FUND_ADDRESS,
      abi,
      functionName: "isResident",
      args: [BigInt(id), address],
    })) as boolean;
    if (already) {
      saveProfile(address, { role: "resident", estateId: id, name, unit });
      navigate(`/estate/${id}`);
      return;
    }
    await send({
      functionName: "joinEstate",
      args: [BigInt(id), code, unit],
      pending: "Joining your estate…",
      success: "You've joined the estate.",
      onDone: () => {
        saveProfile(address, { role: "resident", estateId: id, name, unit });
        navigate(`/estate/${id}`);
      },
    });
  }

  return (
    <div className="setup">
      <button className="setup-back" onClick={back}>
        ← Change role
      </button>
      <form className="card action-card setup-single" onSubmit={join}>
        <h3 className="action-title">Join your estate</h3>
        <p className="muted action-desc">
          Your chairman shared an estate ID and a join code.
        </p>
        <div className="setup-two">
          <div className="field">
            <label>Estate ID</label>
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="0"
              inputMode="numeric"
              required
            />
          </div>
          <div className="field">
            <label>Join code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="sunrise-04"
              required
            />
          </div>
        </div>
        <div className="setup-two">
          <div className="field">
            <label>Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tunde Bello"
              required
            />
          </div>
          <div className="field">
            <label>Your flat / floor</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Block C, Flat 7"
              required
            />
          </div>
        </div>
        <button className="btn btn-lime block" disabled={busy !== null} type="submit">
          Join estate
        </button>
      </form>
    </div>
  );
}

function ChairIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10a2 2 0 1 1 4 0v3h8v-3a2 2 0 1 1 4 0v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M8 13V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11 12 4l8 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
