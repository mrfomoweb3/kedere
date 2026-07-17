import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useEstate } from "../lib/useEstate";
import { useWrite } from "../lib/useWrite";
import { useAuth } from "../lib/useAuth";
import { WalletButton } from "../components/WalletButton";
import { AreaChart } from "../components/AreaChart";
import { Gauge } from "../components/Gauge";
import { Modal } from "../components/Modal";
import { HanKedereStamp } from "../components/Stamp";
import { BrandGlyph } from "../components/BrandGlyph";
import { useNavigate } from "../router";
import { fmtMon, truncAddr, relTime, countdown } from "../lib/format";
import { getProfile, saveProfile } from "../lib/profile";
import { useToasts } from "../components/Toasts";
import type { ExpenseView, LedgerEntry, LevyEntry, ResidentRow } from "../lib/types";
import {
  ESTATE_FUND_ABI,
  ESTATE_FUND_ADDRESS,
  MONAD_CHAIN_ID,
  explorerAddr,
  explorerTx,
} from "../contract/config";

type Tab = "overview" | "levies" | "expenses" | "residents" | "profile";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /> },
  { key: "levies", label: "Levies", icon: <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" /> },
  { key: "expenses", label: "Expenses", icon: <path d="M6 3h9l3 3v15H6zM14 3v4h4M9 13h6M9 17h6" strokeLinecap="round" strokeLinejoin="round" /> },
  { key: "residents", label: "Residents", icon: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-2-5.2M21 20a6 6 0 0 0-4-5.7" strokeLinecap="round" strokeLinejoin="round" /> },
  { key: "profile", label: "Profile", icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" strokeLinecap="round" strokeLinejoin="round" /> },
];

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
const currentPeriod = () =>
  new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
const mon = (wei: bigint) => Number(formatEther(wei));

export function Estate({ id }: { id: bigint }) {
  const nowSec = useNow();
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { data, isLoading, isError } = useEstate(id);
  const { send, busy } = useWrite();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: residentFlag } = useReadContract({
    address: ESTATE_FUND_ADDRESS,
    abi: ESTATE_FUND_ABI as any,
    functionName: "isResident",
    args: [id, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address, refetchInterval: 4000 },
  });

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

  const stats = useMemo(() => {
    if (!data) return null;
    const levies = data.feed.filter((e) => e.kind === "levy") as LevyEntry[];
    const totalCollected = levies.reduce((s, e) => s + e.amount, 0n);
    const exps = [...data.expenses.values()];
    const totalSpent = exps.filter((x) => x.status === "EXECUTED").reduce((s, x) => s + x.amount, 0n);
    const pending = exps.filter((x) => x.status === "PENDING");
    const sorted = [...levies].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    let cum = 0;
    const chart = sorted.map((e) => { cum += mon(e.amount); return { t: e.timestamp ?? 0, v: cum }; });
    return { levies, totalCollected, totalSpent, execCount: exps.filter((x) => x.status === "EXECUTED").length, pending, chart };
  }, [data]);

  if (isLoading) return <FullNote text="Loading the ledger…" spinner />;
  if (isError || !data || !meta || !stats)
    return (
      <FullNote text={`No estate #${id.toString()} found.`}
        cta={<button className="btn btn-primary" onClick={() => navigate("/welcome")}>Back to start</button>} />
    );

  async function payLevy(e: React.FormEvent) {
    e.preventDefault();
    await send({ functionName: "payLevy", args: [id, period], value: parseEther(amount || "0"),
      pending: `Paying ${amount} MON levy…`, success: `Levy of ${amount} MON paid.`, onDone: () => setModal(null) });
  }
  async function propose(e: React.FormEvent) {
    e.preventDefault();
    await send({ functionName: "proposeExpense", args: [id, recipient as `0x${string}`, parseEther(expAmount || "0"), memo],
      pending: "Posting the expense proposal…", success: "Expense proposed.",
      onDone: () => { setRecipient(""); setExpAmount(""); setMemo(""); setModal(null); } });
  }
  const object = (eid: bigint) => send({ functionName: "objectToExpense", args: [id, eid], pending: "Recording your objection…", success: "Your objection is on the ledger." });
  const execute = (eid: bigint) => send({ functionName: "executeExpense", args: [id, eid], pending: "Executing the expense…", success: "Expense executed and paid out." });

  const canAct = isConnected && onChain;
  const myRow = data.residents.find((r) => r.address.toLowerCase() === address?.toLowerCase());

  return (
    <div className="dash-shell">
      <aside className="sidebar sidebar-wide">
        <button className="side-brand" onClick={() => navigate("/")} title="Kedere"><BrandGlyph /></button>
        <nav className="side-nav">
          {TABS.map((t) => (
            <button key={t.key} className={`side-item ${tab === t.key ? "side-item-active" : ""}`} onClick={() => setTab(t.key)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{t.icon}</svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <a className="side-item" href={explorerAddr(ESTATE_FUND_ADDRESS)} target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Explorer</span>
          </a>
          <button className="side-item" onClick={() => navigate("/welcome")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>Home</span>
          </button>
        </div>
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
            {canAct && isResident && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal("levy")}>+ Pay levy</button>
            )}
            {canAct && isChairman && (
              <button className="btn btn-ghost btn-sm" onClick={() => setModal("propose")}>Propose expense</button>
            )}
            <WalletButton />
          </div>
        </header>

        <div className="dash-body">
          {tab === "overview" && (
            <OverviewTab meta={meta} stats={stats} data={data} nowSec={nowSec} isChairman={isChairman} isResident={isResident} busy={busy} onObject={object} onExecute={execute} />
          )}
          {tab === "levies" && (
            <LeviesTab levies={stats.levies} totalCollected={stats.totalCollected} canPay={canAct && isResident} onPay={() => setModal("levy")} />
          )}
          {tab === "expenses" && (
            <ExpensesTab data={data} meta={meta} nowSec={nowSec} isChairman={isChairman} isResident={isResident} busy={busy} onObject={object} onExecute={execute} canPropose={canAct && isChairman} onPropose={() => setModal("propose")} />
          )}
          {tab === "residents" && (
            <ResidentsTab residents={data.residents} residentCount={Number(meta.residentCount)} />
          )}
          {tab === "profile" && (
            <ProfileTab meta={meta} myRow={myRow} address={address} isChairman={isChairman} isResident={isResident} connected={canAct} onConnect={() => setTab("profile")} />
          )}
        </div>
      </div>

      <Modal open={modal === "levy"} onClose={() => setModal(null)} title="Pay levy">
        <form onSubmit={payLevy}>
          <div className="field"><label>Amount (MON)</label><input type="number" step="0.001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
          <div className="field"><label>Period</label><input value={period} onChange={(e) => setPeriod(e.target.value)} required /></div>
          <button className="btn btn-primary block" disabled={busy !== null} type="submit">Pay levy</button>
        </form>
      </Modal>
      <Modal open={modal === "propose"} onClose={() => setModal(null)} title="Propose expense">
        <form onSubmit={propose}>
          <p className="muted rail-note">Funds only move after the delay window and if residents don't block it.</p>
          <div className="field"><label>Pay to (address)</label><input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" required /></div>
          <div className="field"><label>Amount (MON)</label><input type="number" step="0.001" min="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required /></div>
          <div className="field"><label>Memo</label><input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Diesel — 500L — July" required /></div>
          <button className="btn btn-primary block" disabled={busy !== null} type="submit">Propose expense</button>
        </form>
      </Modal>
    </div>
  );
}

// ── Overview tab ────────────────────────────────────────────────────────────
function OverviewTab({ meta, stats, data, nowSec, isChairman, isResident, busy, onObject, onExecute }: any) {
  const collectedNum = mon(stats.totalCollected);
  const balanceNum = mon(meta.balance);
  const paidCount = data.residents.filter((r: ResidentRow) => r.paidThisMonth).length;
  return (
    <>
      <div className="tab-head"><h2 className="overview-h">Overview</h2><span className="muted">Live snapshot of the fund</span></div>
      <div className="stat-grid">
        <StatCard label="Fund balance" value={fmtMon(meta.balance)} unit="MON" sub="held in the contract" accent />
        <StatCard label="Total collected" value={fmtMon(stats.totalCollected)} unit="MON" sub={`${stats.levies.length} levies paid`} />
        <StatCard label="Total spent" value={fmtMon(stats.totalSpent)} unit="MON" sub={`${stats.execCount} executed`} />
        <StatCard label="Paid this month" value={`${paidCount}/${meta.residentCount}`} sub={`${stats.pending.length} pending proposals`} />
      </div>
      <div className="chart-row">
        <section className="card chart-card">
          <div className="card-head"><div><h3>Levies collected</h3><span className="muted num">Total {fmtMon(stats.totalCollected)} MON</span></div><span className="legend"><span className="legend-dot" /> Cumulative</span></div>
          <AreaChart data={stats.chart} />
        </section>
        <section className="card gauge-card">
          <div className="card-head"><h3>In the fund</h3></div>
          <Gauge value={balanceNum} max={collectedNum || 1} big={fmtMon(meta.balance)} label="MON held" caption={`of ${fmtMon(stats.totalCollected)} collected · ${fmtMon(stats.totalSpent)} spent`} />
        </section>
      </div>
      {stats.pending.length > 0 && (
        <section className="proposals">
          <h3 className="section-h">Awaiting decision</h3>
          <div className="proposal-grid">
            {stats.pending.map((x: ExpenseView) => (
              <ProposalCard key={x.expenseId.toString()} exp={x} residentCount={Number(meta.residentCount)} nowSec={nowSec} isChairman={isChairman} isResident={isResident} busy={busy} onObject={onObject} onExecute={onExecute} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── Levies tab ──────────────────────────────────────────────────────────────
function LeviesTab({ levies, totalCollected, canPay, onPay }: { levies: LevyEntry[]; totalCollected: bigint; canPay: boolean; onPay: () => void }) {
  return (
    <>
      <div className="tab-head">
        <div><h2 className="overview-h">Levies</h2><span className="muted">{levies.length} payments · {fmtMon(totalCollected)} MON collected</span></div>
        {canPay && <button className="btn btn-primary btn-sm" onClick={onPay}>+ Pay levy</button>}
      </div>
      <section className="card table-card">
        {levies.length === 0 ? (
          <div className="table-empty muted">No levies yet. The ledger starts with the first payment.</div>
        ) : (
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Unit</th><th>Resident</th><th className="ta-r">Amount</th><th>Period</th><th>When</th><th /></tr></thead>
              <tbody>
                {levies.map((e) => {
                  const hasTx = e.txHash && e.txHash !== "0x";
                  return (
                    <tr key={`${e.blockNumber}-${e.logIndex}`}>
                      <td className="td-type">{e.unitLabel}</td>
                      <td>{e.name ?? <span className="num muted">{truncAddr(e.resident)}</span>}</td>
                      <td className="ta-r"><span className="num pos">+{fmtMon(e.amount)}</span></td>
                      <td className="muted">{e.period}</td>
                      <td className="muted">{relTime(e.timestamp)}</td>
                      <td className="ta-r">{hasTx ? <a className="tx" href={explorerTx(e.txHash)} target="_blank" rel="noreferrer">↗</a> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ── Expenses tab ────────────────────────────────────────────────────────────
function ExpensesTab({ data, meta, nowSec, isChairman, isResident, busy, onObject, onExecute, canPropose, onPropose }: any) {
  const exps = [...data.expenses.values()] as ExpenseView[];
  const pending = exps.filter((x) => x.status === "PENDING");
  const settled = exps.filter((x) => x.status !== "PENDING").sort((a, b) => Number(b.expenseId - a.expenseId));
  return (
    <>
      <div className="tab-head">
        <div><h2 className="overview-h">Expenses</h2><span className="muted">{pending.length} pending · {exps.length} total</span></div>
        {canPropose && <button className="btn btn-primary btn-sm" onClick={onPropose}>+ Propose expense</button>}
      </div>
      {pending.length > 0 && (
        <section className="proposals">
          <h3 className="section-h">Awaiting decision</h3>
          <div className="proposal-grid">
            {pending.map((x) => (
              <ProposalCard key={x.expenseId.toString()} exp={x} residentCount={Number(meta.residentCount)} nowSec={nowSec} isChairman={isChairman} isResident={isResident} busy={busy} onObject={onObject} onExecute={onExecute} />
            ))}
          </div>
        </section>
      )}
      <h3 className="section-h">History</h3>
      <section className="card table-card">
        {settled.length === 0 ? (
          <div className="table-empty muted">No settled expenses yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="ledger-table">
              <thead><tr><th>Memo</th><th className="ta-r">Amount</th><th>Recipient</th><th>Status</th><th /></tr></thead>
              <tbody>
                {settled.map((x) => (
                  <tr key={x.expenseId.toString()}>
                    <td className="td-type">{x.memo}{x.status === "EXECUTED" && <span className="table-stamp"><HanKedereStamp /></span>}</td>
                    <td className="ta-r"><span className="num neg">−{fmtMon(x.amount)}</span></td>
                    <td className="num muted">{truncAddr(x.recipient)}</td>
                    <td><span className={x.status === "EXECUTED" ? "chip chip-executed" : "chip chip-cancelled"}>{x.status.toLowerCase()}</span></td>
                    <td className="ta-r">{x.txHash ? <a className="tx" href={explorerTx(x.txHash)} target="_blank" rel="noreferrer">↗</a> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ── Residents tab (who's paid / who's owing) ────────────────────────────────
function ResidentsTab({ residents, residentCount }: { residents: ResidentRow[]; residentCount: number }) {
  const paid = residents.filter((r) => r.paidThisMonth).length;
  const owing = residents.filter((r) => !r.paidThisMonth);
  return (
    <>
      <div className="tab-head"><div><h2 className="overview-h">Residents</h2><span className="muted">{residentCount} members · {paid} paid this month · {owing.length} owing</span></div></div>
      <div className="stat-grid stat-grid-3">
        <StatCard label="Members" value={residentCount.toString()} sub="registered on chain" />
        <StatCard label="Paid this month" value={paid.toString()} sub="up to date" accent />
        <StatCard label="Owing" value={owing.length.toString()} sub="no payment this month" />
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="ledger-table">
            <thead><tr><th>Unit</th><th>Name</th><th className="ta-r">Total paid</th><th className="ta-r">Levies</th><th>Last paid</th><th>This month</th><th /></tr></thead>
            <tbody>
              {residents.map((r) => (
                <tr key={r.address}>
                  <td className="td-type">{r.unitLabel}{r.isChairman && <span className="chip chip-paid role-tag">Chairman</span>}</td>
                  <td>{r.name ?? <span className="muted">—</span>}</td>
                  <td className="ta-r num">{fmtMon(r.totalPaid)}</td>
                  <td className="ta-r num muted">{r.levyCount}</td>
                  <td className="muted">{r.lastPaidAt ? relTime(r.lastPaidAt) : "never"}</td>
                  <td>{r.paidThisMonth ? <span className="chip chip-paid">Paid</span> : <span className="chip chip-cancelled">Owing</span>}</td>
                  <td className="ta-r"><a className="tx" href={explorerAddr(r.address)} target="_blank" rel="noreferrer">↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ── Profile tab ─────────────────────────────────────────────────────────────
function ProfileTab({ meta, myRow, address, isChairman, isResident, connected }: any) {
  const { saveName } = useAuth();
  const toasts = useToasts();
  const [name, setName] = useState(() => (address ? getProfile(address)?.name ?? myRow?.name ?? "" : ""));
  const [saving, setSaving] = useState(false);

  if (!connected) {
    return (
      <>
        <div className="tab-head"><h2 className="overview-h">Profile</h2></div>
        <div className="card gate-card"><h3 className="rail-title">Connect to view your profile</h3><WalletButton /></div>
      </>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address) return;
    setSaving(true);
    saveProfile(address, {
      role: isChairman ? "chairman" : "resident",
      estateId: meta.id.toString(),
      name: name.trim(),
      unit: myRow?.unitLabel,
    });
    const ok = await saveName(name.trim());
    setSaving(false);
    toasts.push({ kind: ok ? "success" : "error", text: ok ? "Profile saved." : "Saved locally (sign-in declined)." });
  }

  return (
    <>
      <div className="tab-head"><h2 className="overview-h">Your profile</h2><span className="muted">{isChairman ? "Chairman" : isResident ? "Resident" : "Visitor"}{myRow ? ` · ${myRow.unitLabel}` : ""}</span></div>
      <div className="stat-grid stat-grid-3">
        <StatCard label="Your contribution" value={fmtMon(myRow?.totalPaid ?? 0n)} unit="MON" sub={`${myRow?.levyCount ?? 0} levies paid`} accent />
        <StatCard label="Fund balance" value={fmtMon(meta.balance)} unit="MON" sub="held in the contract" />
        <StatCard label="This month" value={myRow?.paidThisMonth ? "Paid" : "Owing"} sub={myRow?.lastPaidAt ? `last ${relTime(myRow.lastPaidAt)}` : "no payment yet"} />
      </div>
      <section className="card profile-card">
        <h3 className="rail-title">Edit profile</h3>
        <p className="muted rail-note">Your display name shows on the ledger and resident roster. Saved on chain sign-in so it follows you across devices.</p>
        <form onSubmit={save}>
          <div className="field"><label>Display name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tunde Bello" maxLength={60} required /></div>
          <div className="field"><label>Unit (from the chain)</label><input value={myRow?.unitLabel ?? "—"} disabled /></div>
          <div className="field"><label>Wallet</label><input className="num" value={address ?? ""} disabled /></div>
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save profile"}</button>
        </form>
      </section>
    </>
  );
}

// ── shared sub-components ────────────────────────────────────────────────────
function StatCard({ label, value, unit, sub, accent }: { label: string; value: string; unit?: string; sub: string; accent?: boolean }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <div className="stat-value"><span className={`num ${accent ? "stat-accent" : ""}`}>{value}</span>{unit && <span className="stat-u">{unit}</span>}</div>
      <span className="stat-sub muted">{sub}</span>
    </div>
  );
}

function ProposalCard({ exp, residentCount, nowSec, isChairman, isResident, busy, onObject, onExecute }: {
  exp: ExpenseView; residentCount: number; nowSec: number; isChairman: boolean; isResident: boolean; busy: string | null; onObject: (id: bigint) => void; onExecute: (id: bigint) => void;
}) {
  const cd = countdown(exp.executableAt, nowSec);
  const canExecute = cd === "";
  const majority = Math.floor(residentCount / 2) + 1;
  const pct = residentCount ? Math.min(100, (exp.objections / residentCount) * 100) : 0;
  return (
    <div className="card proposal">
      <div className="notice-head"><span className="chip chip-proposed">Proposed</span><span className="notice-amount num">−{fmtMon(exp.amount)} MON</span></div>
      <p className="notice-line"><strong>{exp.memo}</strong></p>
      <p className="notice-sub muted num">to {truncAddr(exp.recipient)}</p>
      <div className="objbar-wrap">
        <div className="objbar-labels"><span className="muted">{exp.objections} / {residentCount} objected</span><span className="muted">{majority} to block</span></div>
        <div className="objbar"><div className="objbar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="notice-actions">
        {cd ? <span className="countdown num">⏳ {cd}</span> : <span className="countdown countdown-ready">Delay elapsed</span>}
        <div className="row">
          {isResident && <button className="btn btn-rust btn-sm" disabled={busy !== null} onClick={() => onObject(exp.expenseId)}>Object</button>}
          {isChairman && <button className="btn btn-primary btn-sm" disabled={!canExecute || busy !== null} onClick={() => onExecute(exp.expenseId)}>Execute</button>}
        </div>
      </div>
    </div>
  );
}

function FullNote({ text, cta, spinner }: { text: string; cta?: React.ReactNode; spinner?: boolean }) {
  return (
    <div className="center-note"><div className="card center-note-card">{spinner && <div className="spinner" />}<p>{text}</p>{cta}</div></div>
  );
}
