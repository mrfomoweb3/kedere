import type { EstateMeta, ExpenseView, LedgerEntry } from "../lib/types";
import { explorerTx } from "../contract/config";
import { countdown, fmtMon, relTime, truncAddr } from "../lib/format";
import { HanKedereStamp } from "./Stamp";

interface Props {
  entry: LedgerEntry;
  meta: EstateMeta;
  expense?: ExpenseView;
  nowSec: number;
  isChairman: boolean;
  isResident: boolean;
  onObject: (id: bigint) => void;
  onExecute: (id: bigint) => void;
  busy: string | null;
  fresh: boolean;
}

function Pin() {
  return <span className="pin" aria-hidden />;
}

function TxLink({ hash, ts }: { hash: string; ts?: number }) {
  const hasTx = !!hash && hash !== "0x" && hash.length > 3;
  return (
    <div className="notice-foot">
      {hasTx ? (
        <a
          href={explorerTx(hash)}
          target="_blank"
          rel="noreferrer"
          className="tx"
        >
          {truncAddr(hash)} ↗
        </a>
      ) : (
        <span className="muted">on Monad testnet</span>
      )}
      <span className="muted">{relTime(ts)}</span>
    </div>
  );
}

export function NoticeCard(p: Props) {
  const { entry } = p;
  const cls = `notice ${p.fresh ? "notice-fresh" : ""}`;

  if (entry.kind === "levy") {
    return (
      <article className={cls}>
        <Pin />
        <div className="notice-head">
          <span className="chip chip-paid">Paid</span>
          <span className="notice-amount num">+{fmtMon(entry.amount)} MON</span>
        </div>
        <p className="notice-line">
          <strong>{entry.name ?? entry.unitLabel}</strong> paid the levy
          <span className="muted"> · {entry.period}</span>
        </p>
        <p className="notice-sub muted">
          {entry.name ? `${entry.unitLabel} · ` : ""}
          <span className="num">{truncAddr(entry.resident)}</span>
        </p>
        <TxLink hash={entry.txHash} ts={entry.timestamp} />
      </article>
    );
  }

  if (entry.kind === "joined") {
    return (
      <article className={cls}>
        <Pin />
        <div className="notice-head">
          <span className="chip chip-joined">Joined</span>
        </div>
        <p className="notice-line">
          <strong>{entry.name ?? entry.unitLabel}</strong> joined the estate
          {entry.name ? (
            <span className="muted"> · {entry.unitLabel}</span>
          ) : null}
        </p>
        <TxLink hash={entry.txHash} ts={entry.timestamp} />
      </article>
    );
  }

  if (entry.kind === "objected") {
    return (
      <article className={cls}>
        <Pin />
        <div className="notice-head">
          <span className="chip chip-cancelled">Objected</span>
        </div>
        <p className="notice-line">
          A resident objected to expense #{entry.expenseId.toString()}
          <span className="muted">
            {" "}
            · {entry.totalObjections} objection
            {entry.totalObjections === 1 ? "" : "s"} so far
          </span>
        </p>
        <TxLink hash={entry.txHash} ts={entry.timestamp} />
      </article>
    );
  }

  if (entry.kind === "cancelled") {
    return (
      <article className={cls}>
        <Pin />
        <div className="notice-head">
          <span className="chip chip-cancelled">Cancelled</span>
        </div>
        <p className="notice-line">
          Expense #{entry.expenseId.toString()} was cancelled
          <span className="muted"> · {entry.reason}</span>
        </p>
        <TxLink hash={entry.txHash} ts={entry.timestamp} />
      </article>
    );
  }

  if (entry.kind === "executed") {
    return (
      <article className={`${cls} notice-executed`}>
        <Pin />
        <div className="notice-head">
          <span className="chip chip-executed">Executed</span>
          <span className="notice-amount num rust-out">
            −{fmtMon(entry.amount)} MON
          </span>
        </div>
        <p className="notice-line">
          <strong>{entry.memo}</strong>
        </p>
        <p className="notice-sub muted num">
          paid to {truncAddr(entry.recipient)}
        </p>
        <div className="notice-stamp-row">
          <HanKedereStamp txHash={entry.txHash} />
          <span className="muted">{relTime(entry.timestamp)}</span>
        </div>
      </article>
    );
  }

  // proposed — the rich, live card
  const exp = p.expense;
  const status = exp?.status ?? "PENDING";
  const cd = exp ? countdown(exp.executableAt, p.nowSec) : "";
  const canExecute = status === "PENDING" && cd === "";
  const residentCount = Number(p.meta.residentCount);
  const objections = exp?.objections ?? 0;
  const objPct = residentCount ? Math.min(100, (objections / residentCount) * 100) : 0;
  const majorityNeeded = Math.floor(residentCount / 2) + 1;

  return (
    <article className={`${cls} notice-expense`}>
      <Pin />
      <div className="notice-head">
        <span
          className={
            status === "EXECUTED"
              ? "chip chip-executed"
              : status === "CANCELLED"
                ? "chip chip-cancelled"
                : "chip chip-proposed"
          }
        >
          {status === "PENDING" ? "Proposed" : status.toLowerCase()}
        </span>
        <span className="notice-amount num">−{fmtMon(entry.amount)} MON</span>
      </div>
      <p className="notice-line">
        <strong>{entry.memo}</strong>
      </p>
      <p className="notice-sub muted num">to {truncAddr(entry.recipient)}</p>

      {status === "PENDING" && (
        <>
          <div className="objbar-wrap">
            <div className="objbar-labels">
              <span className="muted">
                {objections} / {residentCount} residents objected
              </span>
              <span className="muted">
                {majorityNeeded} needed to block
              </span>
            </div>
            <div className="objbar">
              <div className="objbar-fill" style={{ width: `${objPct}%` }} />
            </div>
          </div>

          <div className="notice-actions">
            {cd ? (
              <span className="countdown num" title="Time until the chairman can execute">
                ⏳ Executable in {cd}
              </span>
            ) : (
              <span className="countdown countdown-ready">Delay elapsed</span>
            )}
            <div className="row">
              {p.isResident && (
                <button
                  className="btn btn-rust btn-sm"
                  disabled={p.busy !== null}
                  onClick={() => p.onObject(entry.expenseId)}
                >
                  Object
                </button>
              )}
              {p.isChairman && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canExecute || p.busy !== null}
                  onClick={() => p.onExecute(entry.expenseId)}
                >
                  Execute
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {status === "EXECUTED" && (
        <div className="notice-stamp-row">
          <HanKedereStamp />
          <span className="muted">settled</span>
        </div>
      )}
      {status === "CANCELLED" && (
        <p className="notice-sub muted">Cancelled · {exp?.cancelReason}</p>
      )}
      <TxLink hash={entry.txHash} ts={entry.timestamp} />
    </article>
  );
}
