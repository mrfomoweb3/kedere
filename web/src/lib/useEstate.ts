import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { getAbiItem } from "viem";
import {
  ESTATE_FUND_ABI,
  ESTATE_FUND_ADDRESS,
  DEPLOY_BLOCK,
} from "../contract/config";
import type {
  EstateMeta,
  ExpenseView,
  Hex,
  LedgerEntry,
} from "./types";

const abi = ESTATE_FUND_ABI as any;

// Cache block timestamps across refetches — blocks are immutable.
const tsCache = new Map<string, number>();

async function blockTimestamps(
  client: PublicClient,
  blocks: bigint[],
): Promise<Map<string, number>> {
  const uniq = [...new Set(blocks.map((b) => b.toString()))];
  const missing = uniq.filter((b) => !tsCache.has(b));
  await Promise.all(
    missing.map(async (b) => {
      const blk = await client.getBlock({ blockNumber: BigInt(b) });
      tsCache.set(b, Number(blk.timestamp));
    }),
  );
  return tsCache;
}

function ev(name: string) {
  return getAbiItem({ abi, name }) as any;
}

export interface EstateData {
  meta: EstateMeta;
  feed: LedgerEntry[];
  expenses: Map<string, ExpenseView>;
}

async function fetchEstate(
  client: PublicClient,
  id: bigint,
): Promise<EstateData | null> {
  // Authoritative header state from storage.
  const raw = (await client.readContract({
    address: ESTATE_FUND_ADDRESS,
    abi,
    functionName: "estates",
    args: [id],
  })) as [string, Hex, bigint, bigint, bigint, boolean];

  const meta: EstateMeta = {
    id,
    name: raw[0],
    chairman: raw[1],
    balance: raw[2],
    residentCount: raw[3],
    proposalDelay: raw[4],
    exists: raw[5],
  };
  if (!meta.exists) return null;

  const base = {
    address: ESTATE_FUND_ADDRESS,
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest" as const,
    args: { estateId: id },
  };

  const [levy, proposed, objected, executed, cancelled, joined] =
    (await Promise.all([
      client.getLogs({ ...base, event: ev("LevyPaid") }),
      client.getLogs({ ...base, event: ev("ExpenseProposed") }),
      client.getLogs({ ...base, event: ev("ExpenseObjected") }),
      client.getLogs({ ...base, event: ev("ExpenseExecuted") }),
      client.getLogs({ ...base, event: ev("ExpenseCancelled") }),
      client.getLogs({ ...base, event: ev("ResidentJoined") }),
    ])) as any[][];

  const feed: LedgerEntry[] = [];
  const allBlocks: bigint[] = [];

  const push = (log: any, entry: Omit<LedgerEntry, "kind"> & { kind: any }) => {
    allBlocks.push(log.blockNumber);
    feed.push({
      ...(entry as any),
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.logIndex,
    });
  };

  for (const l of levy)
    push(l, {
      kind: "levy",
      resident: l.args.resident,
      amount: l.args.amount,
      period: l.args.period,
      unitLabel: l.args.unitLabel,
    } as any);
  for (const l of proposed)
    push(l, {
      kind: "proposed",
      expenseId: l.args.expenseId,
      recipient: l.args.recipient,
      amount: l.args.amount,
      memo: l.args.memo,
      executableAt: l.args.executableAt,
    } as any);
  for (const l of objected)
    push(l, {
      kind: "objected",
      expenseId: l.args.expenseId,
      resident: l.args.resident,
      totalObjections: Number(l.args.totalObjections),
    } as any);
  for (const l of executed)
    push(l, {
      kind: "executed",
      expenseId: l.args.expenseId,
      recipient: l.args.recipient,
      amount: l.args.amount,
      memo: l.args.memo,
    } as any);
  for (const l of cancelled)
    push(l, {
      kind: "cancelled",
      expenseId: l.args.expenseId,
      reason: l.args.reason,
    } as any);
  for (const l of joined)
    push(l, {
      kind: "joined",
      resident: l.args.resident,
      unitLabel: l.args.unitLabel,
    } as any);

  // Attach timestamps.
  const ts = await blockTimestamps(client, allBlocks);
  for (const e of feed) e.timestamp = ts.get(e.blockNumber.toString());

  // Reverse-chronological: block desc, then logIndex desc.
  feed.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber)
      return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });

  // Derive per-expense view.
  const expenses = new Map<string, ExpenseView>();
  for (const l of proposed) {
    const eid = l.args.expenseId as bigint;
    expenses.set(eid.toString(), {
      expenseId: eid,
      recipient: l.args.recipient,
      amount: l.args.amount,
      memo: l.args.memo,
      executableAt: l.args.executableAt,
      objections: 0,
      status: "PENDING",
    });
  }
  for (const l of objected) {
    const v = expenses.get((l.args.expenseId as bigint).toString());
    if (v) v.objections = Number(l.args.totalObjections);
  }
  for (const l of executed) {
    const v = expenses.get((l.args.expenseId as bigint).toString());
    if (v) v.status = "EXECUTED";
  }
  for (const l of cancelled) {
    const v = expenses.get((l.args.expenseId as bigint).toString());
    if (v) {
      v.status = "CANCELLED";
      v.cancelReason = l.args.reason;
    }
  }

  return { meta, feed, expenses };
}

export function useEstate(id: bigint | null) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["estate", id?.toString()],
    enabled: id !== null && !!client,
    refetchInterval: 4000,
    queryFn: () => fetchEstate(client as PublicClient, id as bigint),
  });
}
