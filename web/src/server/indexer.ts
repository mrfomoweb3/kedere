import "server-only";
import { getAbiItem, parseEventLogs, type Log } from "viem";
import { serverClient } from "./chain";
import { prisma } from "./prisma";
import {
  ESTATE_FUND_ABI,
  ESTATE_FUND_ADDRESS,
  DEPLOY_BLOCK,
} from "../contract/config";

const abi = ESTATE_FUND_ABI as any;
const CONTRACT = ESTATE_FUND_ADDRESS.toLowerCase();
const CHUNK = 100n; // Monad public RPC caps eth_getLogs to 100 blocks
const MAX_SPAN = 3000n; // blocks scanned per sync() call (bounded for serverless)

const tsCache = new Map<number, number>();

async function blockTs(block: bigint): Promise<number> {
  const n = Number(block);
  if (tsCache.has(n)) return tsCache.get(n)!;
  const b = await serverClient.getBlock({ blockNumber: block });
  tsCache.set(n, Number(b.timestamp));
  return Number(b.timestamp);
}

async function scanChunked(from: bigint, to: bigint): Promise<Log[]> {
  const out: Log[] = [];
  for (let start = from; start <= to; start += CHUNK) {
    const end = start + CHUNK - 1n > to ? to : start + CHUNK - 1n;
    const logs = await serverClient.getLogs({
      address: ESTATE_FUND_ADDRESS,
      fromBlock: start,
      toBlock: end,
    });
    out.push(...logs);
  }
  return out;
}

/** Read authoritative estate + expense state from contract storage and upsert. */
async function refreshEstate(id: number) {
  const est = (await serverClient.readContract({
    address: ESTATE_FUND_ADDRESS,
    abi,
    functionName: "estates",
    args: [BigInt(id)],
  })) as [string, string, bigint, bigint, bigint, boolean];
  if (!est[5]) return; // !exists

  await prisma.estate.upsert({
    where: { id },
    create: {
      id,
      name: est[0],
      chairman: est[1].toLowerCase(),
      balance: est[2].toString(),
      residentCount: Number(est[3]),
      proposalDelay: Number(est[4]),
      createdBlock: Number(DEPLOY_BLOCK),
    },
    update: {
      name: est[0],
      chairman: est[1].toLowerCase(),
      balance: est[2].toString(),
      residentCount: Number(est[3]),
      proposalDelay: Number(est[4]),
    },
  });

  const count = (await serverClient.readContract({
    address: ESTATE_FUND_ADDRESS,
    abi,
    functionName: "getExpenseCount",
    args: [BigInt(id)],
  })) as bigint;

  for (let i = 0; i < Number(count); i++) {
    const e = (await serverClient.readContract({
      address: ESTATE_FUND_ADDRESS,
      abi,
      functionName: "getExpense",
      args: [BigInt(id), BigInt(i)],
    })) as any;
    await prisma.expense.upsert({
      where: { estateId_expenseId: { estateId: id, expenseId: i } },
      create: {
        estateId: id,
        expenseId: i,
        recipient: e.recipient.toLowerCase(),
        amount: e.amount.toString(),
        memo: e.memo,
        proposedAt: Number(e.proposedAt),
        objections: Number(e.objections),
        executed: e.executed,
        cancelled: e.cancelled,
      },
      update: {
        objections: Number(e.objections),
        executed: e.executed,
        cancelled: e.cancelled,
      },
    });
  }
}

/**
 * Incrementally index new blocks into the DB. Idempotent — safe to call
 * repeatedly / concurrently (unique constraints dedupe). Returns how far it got.
 */
export async function sync(): Promise<{ from: number; to: number; latest: number }> {
  const latest = await serverClient.getBlockNumber();
  const state = await prisma.indexState.findUnique({ where: { contract: CONTRACT } });
  const startFrom = state ? BigInt(state.lastBlock) + 1n : DEPLOY_BLOCK;

  if (startFrom > latest) {
    return { from: Number(startFrom), to: Number(latest), latest: Number(latest) };
  }
  const to = startFrom + MAX_SPAN - 1n > latest ? latest : startFrom + MAX_SPAN - 1n;

  const logs = await scanChunked(startFrom, to);
  const parsed = parseEventLogs({ abi, logs }) as any[];

  const touchedEstates = new Set<number>();
  const ev = getAbiItem({ abi, name: "ExpenseProposed" }); // (ensures abi valid)
  void ev;

  for (const log of parsed) {
    const a = log.args;
    const estateId = Number(a.estateId);
    const common = {
      estateId,
      txHash: log.transactionHash as string,
      blockNumber: Number(log.blockNumber),
      logIndex: Number(log.logIndex),
    };

    if (log.eventName === "EstateCreated") {
      touchedEstates.add(estateId);
      continue;
    }
    if (log.eventName === "ExpenseProposed") {
      touchedEstates.add(estateId);
      // record the proposing tx for the explorer link
      await prisma.expense
        .updateMany({
          where: { estateId, expenseId: Number(a.expenseId) },
          data: { proposedTx: common.txHash },
        })
        .catch(() => {});
      continue;
    }
    if (log.eventName === "ExpenseExecuted" || log.eventName === "ExpenseCancelled") {
      touchedEstates.add(estateId);
      continue; // status is refreshed from storage
    }

    // feed events: levy | joined | objected
    let kind: string | null = null;
    let data: any = {};
    if (log.eventName === "LevyPaid") {
      kind = "levy";
      data = {
        resident: a.resident,
        amount: a.amount.toString(),
        period: a.period,
        unitLabel: a.unitLabel,
      };
      touchedEstates.add(estateId);
    } else if (log.eventName === "ResidentJoined") {
      kind = "joined";
      data = { resident: a.resident, unitLabel: a.unitLabel };
      touchedEstates.add(estateId);
      await prisma.resident.upsert({
        where: { estateId_address: { estateId, address: a.resident.toLowerCase() } },
        create: {
          estateId,
          address: a.resident.toLowerCase(),
          unitLabel: a.unitLabel,
          joinedBlock: common.blockNumber,
        },
        update: { unitLabel: a.unitLabel },
      });
    } else if (log.eventName === "ExpenseObjected") {
      kind = "objected";
      data = {
        expenseId: Number(a.expenseId),
        resident: a.resident,
        totalObjections: Number(a.totalObjections),
      };
      touchedEstates.add(estateId);
    }

    if (kind) {
      const timestamp = await blockTs(log.blockNumber);
      await prisma.ledgerEvent.upsert({
        where: { txHash_logIndex: { txHash: common.txHash, logIndex: common.logIndex } },
        create: { ...common, kind, timestamp, data },
        update: {},
      });
    }
  }

  for (const id of touchedEstates) await refreshEstate(id);

  await prisma.indexState.upsert({
    where: { contract: CONTRACT },
    create: { contract: CONTRACT, lastBlock: Number(to) },
    update: { lastBlock: Number(to) },
  });

  return { from: Number(startFrom), to: Number(to), latest: Number(latest) };
}
