import "server-only";
import { prisma } from "./prisma";

// JSON-serializable shapes returned by the API (bigints → strings).
export interface ApiEstate {
  meta: {
    id: number;
    name: string;
    chairman: string;
    balance: string;
    residentCount: number;
    proposalDelay: number;
  };
  feed: any[];
  expenses: {
    expenseId: number;
    recipient: string;
    amount: string;
    memo: string;
    executableAt: number;
    objections: number;
    status: "PENDING" | "EXECUTED" | "CANCELLED";
    cancelReason?: string;
    txHash?: string;
  }[];
}

export async function getEstateData(id: number): Promise<ApiEstate | null> {
  const estate = await prisma.estate.findUnique({
    where: { id },
    include: { events: true, expenses: true },
  });
  if (!estate) return null;

  // resident display names (off-chain), keyed by address
  const addrs = new Set<string>();
  for (const e of estate.events) {
    const r = (e.data as any)?.resident;
    if (r) addrs.add(String(r).toLowerCase());
  }
  const profiles = await prisma.profile.findMany({
    where: { address: { in: [...addrs] } },
  });
  const nameOf = new Map(profiles.map((p) => [p.address, p.name]));

  const feed: any[] = [];

  for (const e of estate.events) {
    const d = e.data as any;
    const base = {
      txHash: e.txHash,
      blockNumber: e.blockNumber,
      logIndex: e.logIndex,
      timestamp: e.timestamp,
    };
    if (e.kind === "levy") {
      feed.push({
        kind: "levy",
        resident: d.resident,
        name: nameOf.get(String(d.resident).toLowerCase()),
        amount: d.amount,
        period: d.period,
        unitLabel: d.unitLabel,
        ...base,
      });
    } else if (e.kind === "joined") {
      feed.push({
        kind: "joined",
        resident: d.resident,
        name: nameOf.get(String(d.resident).toLowerCase()),
        unitLabel: d.unitLabel,
        ...base,
      });
    } else if (e.kind === "objected") {
      feed.push({
        kind: "objected",
        expenseId: d.expenseId,
        resident: d.resident,
        totalObjections: d.totalObjections,
        ...base,
      });
    }
  }

  const expenses = estate.expenses
    .sort((a, b) => a.expenseId - b.expenseId)
    .map((x) => {
      const executableAt = x.proposedAt + estate.proposalDelay;
      const status = x.executed
        ? "EXECUTED"
        : x.cancelled
          ? "CANCELLED"
          : "PENDING";
      // one evolving feed card per expense
      feed.push({
        kind: "proposed",
        expenseId: x.expenseId,
        recipient: x.recipient,
        amount: x.amount,
        memo: x.memo,
        executableAt,
        txHash: x.proposedTx ?? "",
        blockNumber: 0,
        logIndex: -1,
        timestamp: x.proposedAt,
      });
      return {
        expenseId: x.expenseId,
        recipient: x.recipient,
        amount: x.amount,
        memo: x.memo,
        executableAt,
        objections: x.objections,
        status: status as "PENDING" | "EXECUTED" | "CANCELLED",
        cancelReason: x.cancelled ? "cancelled" : undefined,
        txHash: x.proposedTx ?? undefined,
      };
    });

  feed.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
    if (a.blockNumber !== b.blockNumber) return b.blockNumber - a.blockNumber;
    return b.logIndex - a.logIndex;
  });

  return {
    meta: {
      id: estate.id,
      name: estate.name,
      chairman: estate.chairman,
      balance: estate.balance,
      residentCount: estate.residentCount,
      proposalDelay: estate.proposalDelay,
    },
    feed,
    expenses,
  };
}

export async function getWalletEstates(address: string) {
  const addr = address.toLowerCase();
  const [chaired, resided] = await Promise.all([
    prisma.estate.findMany({ where: { chairman: addr } }),
    prisma.resident.findMany({
      where: { address: addr },
      include: { estate: true },
    }),
  ]);

  const map = new Map<number, { id: number; name: string; role: string; unit?: string }>();
  for (const e of chaired)
    map.set(e.id, { id: e.id, name: e.name, role: "chairman" });
  for (const r of resided) {
    if (!map.has(r.estateId))
      map.set(r.estateId, {
        id: r.estateId,
        name: r.estate.name,
        role: "resident",
        unit: r.unitLabel,
      });
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}
