import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useEstate } from "../lib/useEstate";
import { useWrite } from "../lib/useWrite";
import { WalletButton } from "../components/WalletButton";
import { AreaChart } from "../components/AreaChart";
import { Gauge } from "../components/Gauge";
import { Modal } from "../components/Modal";
import { HanKedereStamp } from "../components/Stamp";
import { useNavigate } from "../router";
import { fmtMon, truncAddr, relTime, countdown } from "../lib/format";
import { getProfile } from "../lib/profile";
import type { ExpenseView, LedgerEntry, LevyEntry } from "../lib/types";
import {
  ESTATE_FUND_ABI,
  ESTATE_FUND_ADDRESS,
  MONAD_CHAIN_ID,
  explorerAddr,
  explorerTx,
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

const mon = (wei: bigint) => Number(formatEther(wei));

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

  // modals + forms
  const [modal, setModal] = useState<null | "levy" | "propose">(null);
  const [amount, setAmount] = useState("0.05");
  const [period, setPeriod] = useState(currentPeriod());
  const [recipient, setRecipient] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [memo, setMemo] = useState("");

  const meta = data?.meta;
  const onChain = chainId === MONAD_CHAIN_ID;
  const isChairman =
    !!address && !!meta && address.toLowerCase() === meta.chairman.toLowerCase();
  const isResident = !!residentFlag || isChairman;

  // ── derived analytics (all from real indexed data) ──────────────────────
  const stats = useMemo(() => {
    if (!data) return null;
    const levies = data.feed.filter((e) => e.kind === "levy") as LevyEntry[];
    const totalCollected = levies.reduce((s, e) => s + e.amount, 0n);
    const exps = [...data.expenses.values()];
    const totalSpent = exps
      .filter((x) => x.status === "EXECUTED")
      .reduce((s, x) => s + x.amount, 0n);
    const pending = exps.filter((x) => x.status === "PENDING");

    const sorted = [...levies].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    let cum = 0;
    const chart = sorted.map((e) => {
      cum += mon(e.amount);
      return { t: e.timestamp ?? 0, v: cum };
    });

    const unitMap = new Map<string, bigint>();
    for (const e of levies)
      unitMap.set(e.unitLabel, (unitMap.get(e.unitLabel) ?? 0n) + e.amount);
    const byUnit = [...unitMap.entries()]
      .map(([unit, amt]) => ({
        unit,
        amt,
        pct: totalCollected > 0n ? Number((amt * 10000n) / totalCollected) / 100 : 0,
      }))
      .sort((a, b) => (a.amt > b.amt ? -1 : 1))
      .slice(0, 5);

    return {
      levyCount: levies.length,
      totalCollected,
      totalSpent,
      execCount: exps.filter((x) => x.status === "EXECUTED").length,
      pending,
      chart,
      byUnit,
    };
  }, [data]);

  if (isLoading) return <FullNote text="Loading the ledger…" spinner />;
  if (isError || !data || !meta || !stats)
    return (
      <FullNote
        text={`No estate #${id.toString()} found.`}
        cta={
          <button className="btn btn-primary" onClick={() => navigate("/welcome")}>
            Back to start
          </button>
        }
      />
    );

  async function payLevy(e: React.FormEvent) {
    e.preventDefault();
    await send({
      functionName: "payLevy",
      args: [id, period],
      value: parseEther(amount || "0"),
      pending: `Paying ${amount} MON levy…`,
      success: `Levy of ${amount} MON paid.`,
      onDone: () => setModal(null),
    });
  }
  async function propose(e: React.FormEvent) {
    e.preventDefault();
    await send({
      functionName: "proposeExpense",
      args: [id, recipient as `0x${string}`, parseEther(expAmount || "0"), memo],
      pending: "Posting the expense proposal…",
      success: "Expense proposed.",
      onDone: () => {
        setRecipient("");
        setExpAmount("");
        setMemo("");
        setModal(null);
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

  const scrollTo = (sel: string) =>
    document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" });

  // table = everything except still-pending proposals (those get action cards)
  const tableFeed = data.feed.filter(
    (e) =>
      !(e.kind === "proposed" &&
        data.expenses.get(e.expenseId.toString())?.status === "PENDING"),
  );

  const collectedNum = mon(stats.totalCollected);
  const balanceNum = mon(meta.balance);

  return (
    <div className="dash-shell">
      <aside className="sidebar">
        <button className="side-brand" onClick={() => navigate("/")} title="Kedere">
          K
        </button>
        <nav className="side-nav">
          <SideIcon label="Overview" active onClick={() => scrollTo(".dash-body")}>
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
          </SideIcon>
          <SideIcon label="Activity" onClick={() => scrollTo("#activity")}>
            <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
          </SideIcon>
          <SideIcon label="By unit" onClick={() => scrollTo("#byunit")}>
            <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" strokeLinecap="round" />
          </SideIcon>
          <a
            className="side-icon"
            href={explorerAddr(ESTATE_FUND_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            title="Contract on explorer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </nav>
        <SideIcon label="Home" onClick={() => navigate("/welcome")}>
          <path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
        </SideIcon>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <div>
            <h1 className="dash-title">{meta.name}</h1>
            <a className="dash-sub tx num" href={explorerAddr(ESTATE_FUND_ADDRESS)} target="_blank" rel="noreferrer">
              Estate #{id.toString()} · {truncAddr(ESTATE_FUND_ADDRESS)} · verified ↗
            </a>
          </div>
          <div className="dash-actions">
            {isConnected && onChain && isResident && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal("levy")}>
                + Pay levy
              </button>
            )}
            {isConnected && onChain && isChairman && (
              <button className="btn btn-ghost btn-sm" onClick={() => setModal("propose")}>
                Propose expense
              </button>
            )}
            <WalletButton />
          </div>
        </header>

        <div className="dash-body">
          <div className="overview-row">
            <div>
              <h2 className="overview-h">Overview</h2>
              <span className="muted">
                {isConnected && onChain && (isChairman || isResident) ? (
                  <>
                    You:{" "}
                    <strong>
                      {isChairman
                        ? "Chairman"
                        : `${getProfile(address)?.name ?? "Resident"}`}
                    </strong>
                  </>
                ) : (
                  "Public view · read-only"
                )}
              </span>
            </div>
            {isConnected && onChain && !isResident && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/welcome")}>
                Join this estate
              </button>
            )}
          </div>

          {/* stat cards */}
          <div className="stat-grid">
            <StatCard label="Fund balance" value={fmtMon(meta.balance)} unit="MON" sub="held in the contract" accent />
            <StatCard label="Total collected" value={fmtMon(stats.totalCollected)} unit="MON" sub={`${stats.levyCount} ${stats.levyCount === 1 ? "levy" : "levies"} paid`} />
            <StatCard label="Total spent" value={fmtMon(stats.totalSpent)} unit="MON" sub={`${stats.execCount} executed`} />
            <StatCard label="Residents" value={meta.residentCount.toString()} sub={`${stats.pending.length} pending ${stats.pending.length === 1 ? "proposal" : "proposals"}`} />
          </div>

          {/* chart + gauge */}
          <div className="chart-row">
            <section className="card chart-card">
              <div className="card-head">
                <div>
                  <h3>Levies collected</h3>
                  <span className="muted num">Total {fmtMon(stats.totalCollected)} MON</span>
                </div>
                <span className="legend"><span className="legend-dot" /> Cumulative</span>
              </div>
              <AreaChart data={stats.chart} />
            </section>
            <section className="card gauge-card">
              <div className="card-head"><h3>In the fund</h3></div>
              <Gauge
                value={balanceNum}
                max={collectedNum || 1}
                big={fmtMon(meta.balance)}
                label="MON held"
                caption={`of ${fmtMon(stats.totalCollected)} collected · ${fmtMon(stats.totalSpent)} spent`}
              />
            </section>
          </div>

          {/* active proposals */}
          {stats.pending.length > 0 && (
            <section className="proposals">
              <h3 className="section-h">Awaiting decision</h3>
              <div className="proposal-grid">
                {stats.pending.map((x) => (
                  <ProposalCard
                    key={x.expenseId.toString()}
                    exp={x}
                    residentCount={Number(meta.residentCount)}
                    nowSec={nowSec}
                    isChairman={isChairman}
                    isResident={isResident}
                    busy={busy}
                    onObject={object}
                    onExecute={execute}
                  />
                ))}
              </div>
            </section>
          )}

          {/* activity table + by unit */}
          <div className="table-row">
            <section className="card table-card" id="activity">
              <div className="card-head">
                <h3>Recent activity</h3>
                <span className="muted">{data.feed.length} total</span>
              </div>
              {tableFeed.length === 0 ? (
                <div className="table-empty muted">
                  No entries yet. The ledger starts with the first levy.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Detail</th>
                        <th className="ta-r">Amount</th>
                        <th>Status</th>
                        <th>When</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {tableFeed.map((e) => (
                        <ActivityRow
                          key={`${e.blockNumber}-${e.logIndex}-${e.kind}`}
                          entry={e}
                          status={
                            e.kind === "proposed"
                              ? data.expenses.get(e.expenseId.toString())?.status
                              : undefined
                          }
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card byunit-card" id="byunit">
              <div className="card-head"><h3>By unit</h3></div>
              {stats.byUnit.length === 0 ? (
                <p className="muted">No levies yet.</p>
              ) : (
                <ul className="byunit-list">
                  {stats.byUnit.map((u) => (
                    <li key={u.unit}>
                      <div className="byunit-top">
                        <span className="byunit-name">{u.unit}</span>
                        <span className="num muted">{fmtMon(u.amt)} MON</span>
                      </div>
                      <div className="byunit-bar">
                        <div className="byunit-fill" style={{ width: `${u.pct}%` }} />
                      </div>
                      <span className="byunit-pct num muted">{u.pct.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* modals */}
      <Modal open={modal === "levy"} onClose={() => setModal(null)} title="Pay levy">
        <form onSubmit={payLevy}>
          <div className="field">
            <label>Amount (MON)</label>
            <input type="number" step="0.001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label>Period</label>
            <input value={period} onChange={(e) => setPeriod(e.target.value)} required />
          </div>
          <button className="btn btn-primary block" disabled={busy !== null} type="submit">Pay levy</button>
        </form>
      </Modal>

      <Modal open={modal === "propose"} onClose={() => setModal(null)} title="Propose expense">
        <form onSubmit={propose}>
          <p className="muted rail-note">
            Funds only move after the delay window and if residents don't block it.
          </p>
          <div className="field">
            <label>Pay to (address)</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" required />
          </div>
          <div className="field">
            <label>Amount (MON)</label>
            <input type="number" step="0.001" min="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label>Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Diesel — 500L — July" required />
          </div>
          <button className="btn btn-primary block" disabled={busy !== null} type="submit">Propose expense</button>
        </form>
      </Modal>
    </div>
  );
}

// ── sub-components ──────────────────────────────────────────────────────────

function SideIcon({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`side-icon ${active ? "side-active" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {children}
      </svg>
    </button>
  );
}

function StatCard({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <div className="stat-value">
        <span className={`num ${accent ? "stat-accent" : ""}`}>{value}</span>
        {unit && <span className="stat-u">{unit}</span>}
      </div>
      <span className="stat-sub muted">{sub}</span>
    </div>
  );
}

function ProposalCard({
  exp,
  residentCount,
  nowSec,
  isChairman,
  isResident,
  busy,
  onObject,
  onExecute,
}: {
  exp: ExpenseView;
  residentCount: number;
  nowSec: number;
  isChairman: boolean;
  isResident: boolean;
  busy: string | null;
  onObject: (id: bigint) => void;
  onExecute: (id: bigint) => void;
}) {
  const cd = countdown(exp.executableAt, nowSec);
  const canExecute = cd === "";
  const majority = Math.floor(residentCount / 2) + 1;
  const pct = residentCount ? Math.min(100, (exp.objections / residentCount) * 100) : 0;
  return (
    <div className="card proposal">
      <div className="notice-head">
        <span className="chip chip-proposed">Proposed</span>
        <span className="notice-amount num">−{fmtMon(exp.amount)} MON</span>
      </div>
      <p className="notice-line"><strong>{exp.memo}</strong></p>
      <p className="notice-sub muted num">to {truncAddr(exp.recipient)}</p>
      <div className="objbar-wrap">
        <div className="objbar-labels">
          <span className="muted">{exp.objections} / {residentCount} objected</span>
          <span className="muted">{majority} to block</span>
        </div>
        <div className="objbar"><div className="objbar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="notice-actions">
        {cd ? (
          <span className="countdown num">⏳ {cd}</span>
        ) : (
          <span className="countdown countdown-ready">Delay elapsed</span>
        )}
        <div className="row">
          {isResident && (
            <button className="btn btn-rust btn-sm" disabled={busy !== null} onClick={() => onObject(exp.expenseId)}>
              Object
            </button>
          )}
          {isChairman && (
            <button className="btn btn-primary btn-sm" disabled={!canExecute || busy !== null} onClick={() => onExecute(exp.expenseId)}>
              Execute
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  entry,
  status,
}: {
  entry: LedgerEntry;
  status?: string;
}) {
  let type = "";
  let detail: React.ReactNode = null;
  let amount: React.ReactNode = <span className="muted">—</span>;
  let chip: React.ReactNode = null;

  if (entry.kind === "levy") {
    type = "Levy";
    detail = (
      <>
        <strong>{entry.name ?? entry.unitLabel}</strong>
        <span className="muted"> · {entry.period}</span>
      </>
    );
    amount = <span className="num pos">+{fmtMon(entry.amount)}</span>;
    chip = <span className="chip chip-paid">Paid</span>;
  } else if (entry.kind === "joined") {
    type = "Joined";
    detail = <strong>{entry.name ?? entry.unitLabel}</strong>;
    chip = <span className="chip chip-joined">Joined</span>;
  } else if (entry.kind === "objected") {
    type = "Objection";
    detail = <span>Expense #{entry.expenseId.toString()} · {entry.totalObjections} so far</span>;
    chip = <span className="chip chip-cancelled">Objected</span>;
  } else if (entry.kind === "proposed") {
    type = "Expense";
    detail = <strong>{entry.memo}</strong>;
    amount = <span className="num neg">−{fmtMon(entry.amount)}</span>;
    chip =
      status === "EXECUTED" ? (
        <span className="chip chip-executed">Executed</span>
      ) : status === "CANCELLED" ? (
        <span className="chip chip-cancelled">Cancelled</span>
      ) : (
        <span className="chip chip-proposed">Proposed</span>
      );
  }

  const hasTx = entry.txHash && entry.txHash !== "0x" && entry.txHash.length > 3;

  return (
    <tr>
      <td className="td-type">{type}</td>
      <td>
        {detail}
        {entry.kind === "proposed" && status === "EXECUTED" && (
          <span className="table-stamp"><HanKedereStamp /></span>
        )}
      </td>
      <td className="ta-r">{amount}</td>
      <td>{chip}</td>
      <td className="muted">{relTime(entry.timestamp)}</td>
      <td className="ta-r">
        {hasTx ? (
          <a className="tx" href={explorerTx(entry.txHash)} target="_blank" rel="noreferrer">↗</a>
        ) : null}
      </td>
    </tr>
  );
}

function FullNote({
  text,
  cta,
  spinner,
}: {
  text: string;
  cta?: React.ReactNode;
  spinner?: boolean;
}) {
  return (
    <div className="center-note">
      <div className="card center-note-card">
        {spinner && <div className="spinner" />}
        <p>{text}</p>
        {cta}
      </div>
    </div>
  );
}
