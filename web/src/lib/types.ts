export type Hex = `0x${string}`;

export interface EstateMeta {
  id: bigint;
  name: string;
  chairman: Hex;
  balance: bigint;
  residentCount: bigint;
  proposalDelay: bigint;
  exists: boolean;
}

interface Base {
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  timestamp?: number; // unix seconds, filled after block lookup
}

export interface LevyEntry extends Base {
  kind: "levy";
  resident: Hex;
  name?: string;
  amount: bigint;
  period: string;
  unitLabel: string;
}
export interface ProposedEntry extends Base {
  kind: "proposed";
  expenseId: bigint;
  recipient: Hex;
  amount: bigint;
  memo: string;
  executableAt: bigint;
}
export interface ObjectedEntry extends Base {
  kind: "objected";
  expenseId: bigint;
  resident: Hex;
  totalObjections: number;
}
export interface ExecutedEntry extends Base {
  kind: "executed";
  expenseId: bigint;
  recipient: Hex;
  amount: bigint;
  memo: string;
}
export interface CancelledEntry extends Base {
  kind: "cancelled";
  expenseId: bigint;
  reason: string;
}
export interface JoinedEntry extends Base {
  kind: "joined";
  resident: Hex;
  name?: string;
  unitLabel: string;
}

export type LedgerEntry =
  | LevyEntry
  | ProposedEntry
  | ObjectedEntry
  | ExecutedEntry
  | CancelledEntry
  | JoinedEntry;

export type ExpenseStatus = "PENDING" | "EXECUTED" | "CANCELLED";

export interface ExpenseView {
  expenseId: bigint;
  recipient: Hex;
  amount: bigint;
  memo: string;
  executableAt: bigint;
  objections: number;
  status: ExpenseStatus;
  cancelReason?: string;
  txHash?: string;
}

export interface ResidentRow {
  address: Hex;
  unitLabel: string;
  name: string | null;
  isChairman: boolean;
  totalPaid: bigint;
  levyCount: number;
  lastPaidAt: number | null;
  paidThisMonth: boolean;
}

export interface EstateData {
  meta: EstateMeta;
  feed: LedgerEntry[];
  expenses: Map<string, ExpenseView>;
  residents: ResidentRow[];
}
