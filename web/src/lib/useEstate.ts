import { useQuery } from "@tanstack/react-query";
import type {
  EstateData,
  EstateMeta,
  ExpenseView,
  Hex,
  LedgerEntry,
} from "./types";

// Reads come from our indexed API (backed by Supabase), which serves the full
// ledger fast and works around Monad's 100-block getLogs cap. Writes still go
// straight to the contract via the wallet.

function toMeta(id: bigint, m: any): EstateMeta {
  return {
    id,
    name: m.name,
    chairman: m.chairman as Hex,
    balance: BigInt(m.balance),
    residentCount: BigInt(m.residentCount),
    proposalDelay: BigInt(m.proposalDelay),
    exists: true,
  };
}

function toEntry(e: any): LedgerEntry {
  const base = {
    txHash: e.txHash as Hex,
    blockNumber: BigInt(e.blockNumber ?? 0),
    logIndex: e.logIndex ?? 0,
    timestamp: e.timestamp,
  };
  switch (e.kind) {
    case "levy":
      return {
        kind: "levy",
        resident: e.resident,
        name: e.name,
        amount: BigInt(e.amount),
        period: e.period,
        unitLabel: e.unitLabel,
        ...base,
      };
    case "joined":
      return {
        kind: "joined",
        resident: e.resident,
        name: e.name,
        unitLabel: e.unitLabel,
        ...base,
      };
    case "objected":
      return {
        kind: "objected",
        expenseId: BigInt(e.expenseId),
        resident: e.resident,
        totalObjections: e.totalObjections,
        ...base,
      };
    case "proposed":
    default:
      return {
        kind: "proposed",
        expenseId: BigInt(e.expenseId),
        recipient: e.recipient,
        amount: BigInt(e.amount),
        memo: e.memo,
        executableAt: BigInt(e.executableAt),
        ...base,
      };
  }
}

function toExpense(x: any): ExpenseView {
  return {
    expenseId: BigInt(x.expenseId),
    recipient: x.recipient,
    amount: BigInt(x.amount),
    memo: x.memo,
    executableAt: BigInt(x.executableAt),
    objections: x.objections,
    status: x.status,
    cancelReason: x.cancelReason,
    txHash: x.txHash,
  };
}

async function fetchEstate(id: bigint): Promise<EstateData | null> {
  const res = await fetch(`/api/estates/${id.toString()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load estate");
  const j = await res.json();
  return {
    meta: toMeta(id, j.meta),
    feed: j.feed.map(toEntry),
    expenses: new Map<string, ExpenseView>(
      j.expenses.map((x: any) => [String(x.expenseId), toExpense(x)]),
    ),
    residents: (j.residents ?? []).map((r: any) => ({
      address: r.address,
      unitLabel: r.unitLabel,
      name: r.name,
      isChairman: r.isChairman,
      totalPaid: BigInt(r.totalPaid),
      levyCount: r.levyCount,
      lastPaidAt: r.lastPaidAt,
      paidThisMonth: r.paidThisMonth,
    })),
  };
}

export function useEstate(id: bigint | null) {
  return useQuery({
    queryKey: ["estate", id?.toString()],
    enabled: id !== null,
    refetchInterval: 6000,
    queryFn: () => fetchEstate(id as bigint),
  });
}
