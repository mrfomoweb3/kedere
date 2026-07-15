import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Log, PublicClient } from "viem";
import { parseEventLogs } from "viem";
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

// Monad's public RPC caps eth_getLogs to a 100-block range, so we scan in
// ≤100-block chunks. We can't scan the whole chain every poll, so we bound the
// scan to two windows: the estate's genesis (early history, where setup/seed
// lives) and the tip (recent/live activity). Authoritative state — balance,
// resident count, and every expense's current status — comes from contract
// STORAGE reads, which have no range limit, so those are always exact.
const CHUNK = 100n;
const GENESIS_SPAN = 1500n; // ~15 chunks from the deploy block
const TIP_SPAN = 900n; // ~9 chunks back from the current tip

// Caches that survive across refetches — immutable data only.
const tsCache = new Map<string, number>();
const genesisLogsCache = new Map<string, Log[]>(); // key: contract@fromBlock

async function blockTimestamps(client: PublicClient, blocks: bigint[]) {
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

/** Scan [from, to] (inclusive) for all logs of the contract, in ≤100-block chunks. */
async function scanRange(
  client: PublicClient,
  from: bigint,
  to: bigint,
): Promise<Log[]> {
  if (to < from) return [];
  const chunks: Promise<Log[]>[] = [];
  for (let start = from; start <= to; start += CHUNK) {
    const end = start + CHUNK - 1n > to ? to : start + CHUNK - 1n;
    chunks.push(
      client.getLogs({
        address: ESTATE_FUND_ADDRESS,
        fromBlock: start,
        toBlock: end,
      }),
    );
  }
  const results = await Promise.all(chunks);
  return results.flat();
}

export interface EstateData {
  meta: EstateMeta;
  feed: LedgerEntry[];
  expenses: Map<string, ExpenseView>;
}

function dedupe(logs: Log[]): Log[] {
  const seen = new Set<string>();
  const out: Log[] = [];
  for (const l of logs) {
    const k = `${l.blockNumber}-${l.logIndex}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

async function fetchEstate(
  client: PublicClient,
  id: bigint,
): Promise<EstateData | null> {
  // ── header + expenses: authoritative, from storage ──────────────────────
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

  const count = (await client.readContract({
    address: ESTATE_FUND_ADDRESS,
    abi,
    functionName: "getExpenseCount",
    args: [id],
  })) as bigint;

  const expenseStructs = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) =>
      client.readContract({
        address: ESTATE_FUND_ADDRESS,
        abi,
        functionName: "getExpense",
        args: [id, BigInt(i)],
      }),
    ),
  );

  // ── event scan: two bounded windows (genesis + tip) ─────────────────────
  const latest = await client.getBlockNumber();
  const genesisFrom = DEPLOY_BLOCK;
  const genesisTo =
    DEPLOY_BLOCK + GENESIS_SPAN > latest ? latest : DEPLOY_BLOCK + GENESIS_SPAN;
  const tipFrom =
    latest - TIP_SPAN < DEPLOY_BLOCK ? DEPLOY_BLOCK : latest - TIP_SPAN;

  const gkey = `${ESTATE_FUND_ADDRESS}@${genesisFrom}-${genesisTo}`;
  let genesisLogs = genesisLogsCache.get(gkey);
  if (!genesisLogs) {
    genesisLogs = await scanRange(client, genesisFrom, genesisTo);
    genesisLogsCache.set(gkey, genesisLogs);
  }
  const tipLogs =
    tipFrom > genesisTo ? await scanRange(client, tipFrom, latest) : [];

  const parsed = parseEventLogs({
    abi,
    logs: dedupe([...genesisLogs, ...tipLogs]),
  }) as any[];

  // index the proposing/executing tx per expense for explorer links
  const proposedTx = new Map<string, { hash: Hex; block: bigint }>();
  const feed: LedgerEntry[] = [];
  const blockRefs: bigint[] = [];

  for (const log of parsed) {
    const a = log.args;
    if (a.estateId !== id) continue;
    const common = {
      txHash: log.transactionHash as Hex,
      blockNumber: log.blockNumber as bigint,
      logIndex: log.logIndex as number,
    };
    switch (log.eventName) {
      case "LevyPaid":
        blockRefs.push(common.blockNumber);
        feed.push({
          kind: "levy",
          resident: a.resident,
          amount: a.amount,
          period: a.period,
          unitLabel: a.unitLabel,
          ...common,
        });
        break;
      case "ResidentJoined":
        blockRefs.push(common.blockNumber);
        feed.push({
          kind: "joined",
          resident: a.resident,
          unitLabel: a.unitLabel,
          ...common,
        });
        break;
      case "ExpenseObjected":
        blockRefs.push(common.blockNumber);
        feed.push({
          kind: "objected",
          expenseId: a.expenseId,
          resident: a.resident,
          totalObjections: Number(a.totalObjections),
          ...common,
        });
        break;
      case "ExpenseProposed":
        proposedTx.set(a.expenseId.toString(), {
          hash: common.txHash,
          block: common.blockNumber,
        });
        break;
      default:
        break;
    }
  }

  const ts = await blockTimestamps(client, blockRefs);
  for (const e of feed)
    if (e.kind !== "proposed") e.timestamp = ts.get(e.blockNumber.toString());

  // ── expenses from storage (always complete + current status) ────────────
  const expenses = new Map<string, ExpenseView>();
  expenseStructs.forEach((s: any, i) => {
    const eid = BigInt(i);
    const status: ExpenseView["status"] = s.executed
      ? "EXECUTED"
      : s.cancelled
        ? "CANCELLED"
        : "PENDING";
    expenses.set(eid.toString(), {
      expenseId: eid,
      recipient: s.recipient,
      amount: s.amount,
      memo: s.memo,
      executableAt: BigInt(s.proposedAt) + meta.proposalDelay,
      objections: Number(s.objections),
      status,
      cancelReason: s.cancelled ? "cancelled" : undefined,
    });

    // one evolving feed card per expense, timestamped by its on-chain proposedAt
    const tx = proposedTx.get(eid.toString());
    feed.push({
      kind: "proposed",
      expenseId: eid,
      recipient: s.recipient,
      amount: s.amount,
      memo: s.memo,
      executableAt: BigInt(s.proposedAt) + meta.proposalDelay,
      txHash: (tx?.hash ?? ("0x" as Hex)),
      blockNumber: tx?.block ?? 0n,
      logIndex: -1,
      timestamp: Number(s.proposedAt),
    });
  });

  // reverse-chronological by timestamp, then logIndex
  feed.sort((a, b) => {
    const ta = a.timestamp ?? 0;
    const tb = b.timestamp ?? 0;
    if (ta !== tb) return tb - ta;
    if (a.blockNumber !== b.blockNumber)
      return a.blockNumber > b.blockNumber ? -1 : 1;
    return b.logIndex - a.logIndex;
  });

  return { meta, feed, expenses };
}

export function useEstate(id: bigint | null) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["estate", id?.toString()],
    enabled: id !== null && !!client,
    refetchInterval: 6000,
    queryFn: () => fetchEstate(client as PublicClient, id as bigint),
  });
}
