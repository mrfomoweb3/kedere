import { useEffect, useMemo, useRef, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useEstate } from "../lib/useEstate";
import { useWrite } from "../lib/useWrite";
import { WalletButton } from "../components/WalletButton";
import { NoticeCard } from "../components/NoticeCard";
import { useNavigate } from "../router";
import { fmtMon, truncAddr } from "../lib/format";
import { getProfile } from "../lib/profile";
import {
  ESTATE_FUND_ABI,
  ESTATE_FUND_ADDRESS,
  MONAD_CHAIN_ID,
  explorerAddr,
} from "../contract/config";

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function currentPeriod() {
  return new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function Estate({ id }: { id: bigint }) {
  const nowSec = useNow();
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { data, isLoading, isError } = useEstate(id);
  const { send, busy } = useWrite();

  const { data: residentFlag } = useReadContract({
    address: ESTATE_FUND_ADDRESS,
    abi: ESTATE_FUND_ABI as any,
    functionName: "isResident",
    args: [id, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  // pay levy form
  const [amount, setAmount] = useState("0.05");
  const [period, setPeriod] = useState(currentPeriod());
  // propose form
  const [recipient, setRecipient] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [memo, setMemo] = useState("");

  // fresh-entry animation tracking
  const seen = useRef<Set<string> | null>(null);
  const freshKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const keys = data.feed.map((e) => `${e.blockNumber}-${e.logIndex}`);
    if (seen.current === null) {
      seen.current = new Set(keys); // first load: nothing animates
    } else {
      const nf = new Set<string>();
      for (const k of keys) if (!seen.current.has(k)) nf.add(k);
      freshKeys.current = nf;
      seen.current = new Set(keys);
    }
  }, [data]);

  const meta = data?.meta;
  const onChain = chainId === MONAD_CHAIN_ID;
  const isChairman = useMemo(
    () =>
      !!address &&
      !!meta &&
      address.toLowerCase() === meta.chairman.toLowerCase(),
    [address, meta],
  );
  const isResident = !!residentFlag || isChairman;

  if (isLoading) {
    return <CenterNote text="Reading the ledger from Monad…" />;
  }
  if (isError || !data || !meta) {
    return (
      <CenterNote
        text={`No estate #${id.toString()} found on chain.`}
        cta={
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Back to start
          </button>
        }
      />
    );
  }

  async function payLevy(e: React.FormEvent) {
    e.preventDefault();
    await send({
      functionName: "payLevy",
      args: [id, period],
      value: parseEther(amount || "0"),
      pending: `Paying ${amount} MON levy…`,
      success: `Levy of ${amount} MON paid.`,
    });
  }

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    await send({
      functionName: "proposeExpense",
      args: [id, recipient as `0x${string}`, parseEther(expAmount || "0"), memo],
      pending: "Posting the expense proposal…",
      success: "Expense proposed. The delay window has started.",
      onDone: () => {
        setRecipient("");
        setExpAmount("");
        setMemo("");
      },
    });
  }

  const object = (eid: bigint) =>
    send({
      functionName: "objectToExpense",
      args: [id, eid],
      pending: "Recording your objection…",
      success: "Your objection is on the ledger.",
    });

  const execute = (eid: bigint) =>
    send({
      functionName: "executeExpense",
      args: [id, eid],
      pending: "Executing the expense…",
      success: "Expense executed and paid out.",
    });

  return (
    <div className="dash">
      <header className="topbar">
        <div className="container spread">
          <button className="brand brand-btn" onClick={() => navigate("/")}>
            <span className="brand-mark">K</span>
            <span className="brand-name">KEDERE</span>
          </button>
          <WalletButton />
        </div>
      </header>

      <div className="container">
        {/* estate header */}
        <section className="estate-head card">
          <div className="estate-head-main">
            <span className="eyebrow">Estate #{id.toString()}</span>
            <h1 className="estate-name">{meta.name}</h1>
            <a
              className="tx num"
              href={explorerAddr(ESTATE_FUND_ADDRESS)}
              target="_blank"
              rel="noreferrer"
            >
              {truncAddr(ESTATE_FUND_ADDRESS)} · verified onchain ↗
            </a>
            {isConnected && onChain && (isChairman || isResident) && (
              <span className="you-chip">
                <span className="wallet-dot" />
                {isChairman
                  ? "You: Chairman"
                  : `You: ${getProfile(address)?.name ?? "Resident"}${
                      getProfile(address)?.unit
                        ? ` · ${getProfile(address)?.unit}`
                        : ""
                    }`}
              </span>
            )}
          </div>
          <div className="estate-stats">
            <div className="stat">
              <span className="stat-label">Fund balance</span>
              <span className="stat-balance num">{fmtMon(meta.balance)}</span>
              <span className="stat-unit">MON</span>
            </div>
            <div className="stat-mini">
              <div>
                <span className="stat-num num">
                  {meta.residentCount.toString()}
                </span>
                <span className="muted"> residents</span>
              </div>
              <div>
                <span className="stat-num num">
                  {Math.round(Number(meta.proposalDelay) / 60)}
                </span>
                <span className="muted"> min delay</span>
              </div>
            </div>
          </div>
        </section>

        <div className="dash-grid">
          {/* action rail */}
          <aside className="rail">
            {!isConnected && (
              <div className="card rail-card">
                <h3 className="rail-title">Connect to take part</h3>
                <p className="muted">
                  Connect your wallet to pay a levy or object to spending.
                </p>
                <WalletButton />
              </div>
            )}

            {isConnected && !onChain && (
              <div className="card rail-card">
                <h3 className="rail-title">Wrong network</h3>
                <WalletButton />
              </div>
            )}

            {isConnected && onChain && !isResident && (
              <div className="card rail-card">
                <h3 className="rail-title">You're viewing publicly</h3>
                <p className="muted">
                  Anyone can read this ledger. To pay a levy, join the estate
                  with its code.
                </p>
                <button
                  className="btn btn-ghost block"
                  onClick={() => navigate("/app")}
                >
                  Join this estate
                </button>
              </div>
            )}

            {isConnected && onChain && isResident && (
              <form className="card rail-card" onSubmit={payLevy}>
                <h3 className="rail-title">Pay levy</h3>
                <div className="field">
                  <label>Amount (MON)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>Period</label>
                  <input
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary block"
                  disabled={busy !== null}
                  type="submit"
                >
                  Pay levy
                </button>
              </form>
            )}

            {isConnected && onChain && isChairman && (
              <form className="card rail-card" onSubmit={propose}>
                <h3 className="rail-title">Propose expense</h3>
                <p className="muted rail-note">
                  As chairman. Funds only move after the delay window and if
                  residents don't block it.
                </p>
                <div className="field">
                  <label>Pay to (address)</label>
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="0x…"
                    required
                  />
                </div>
                <div className="field">
                  <label>Amount (MON)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label>Memo</label>
                  <input
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="Diesel — 500L — July"
                    required
                  />
                </div>
                <button
                  className="btn btn-primary block"
                  disabled={busy !== null}
                  type="submit"
                >
                  Propose expense
                </button>
              </form>
            )}
          </aside>

          {/* ledger */}
          <main className="ledger">
            <div className="ledger-head">
              <h2>The ledger</h2>
              <span className="muted">
                {data.feed.length} entr{data.feed.length === 1 ? "y" : "ies"} · live
              </span>
            </div>

            {data.feed.length === 0 ? (
              <div className="card empty">
                <p className="empty-title">No entries yet.</p>
                <p className="muted">
                  The ledger starts with the first levy. If you're a resident,
                  pay yours and watch it pin here.
                </p>
              </div>
            ) : (
              <div className="feed">
                {data.feed.map((entry) => {
                  const key = `${entry.blockNumber}-${entry.logIndex}`;
                  const expense =
                    entry.kind === "proposed"
                      ? data.expenses.get(entry.expenseId.toString())
                      : undefined;
                  return (
                    <NoticeCard
                      key={key}
                      entry={entry}
                      expense={expense}
                      meta={meta}
                      nowSec={nowSec}
                      isChairman={isChairman}
                      isResident={isResident}
                      onObject={object}
                      onExecute={execute}
                      busy={busy}
                      fresh={freshKeys.current.has(key)}
                    />
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function CenterNote({
  text,
  cta,
}: {
  text: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="center-note">
      <div className="card center-note-card">
        <p>{text}</p>
        {cta}
      </div>
    </div>
  );
}
