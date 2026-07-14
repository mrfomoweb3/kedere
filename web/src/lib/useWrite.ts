import { useCallback, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { ESTATE_FUND_ABI, ESTATE_FUND_ADDRESS } from "../contract/config";
import { useToasts } from "../components/Toasts";

const REASON_COPY: Record<string, string> = {
  "not chairman": "Only the chairman can do that.",
  "not a resident": "You need to join this estate first.",
  "already a resident": "You're already a resident of this estate.",
  "already objected": "You've already objected to this expense.",
  "bad code": "That join code is not correct.",
  "zero value": "Enter an amount greater than zero.",
  "bad amount": "That amount is more than the fund holds.",
  "empty memo": "Add a short note describing the expense.",
  "still in delay": "The delay window hasn't finished yet.",
  "window closed": "The objection window has closed.",
  "not pending": "This expense is already settled or cancelled.",
  "use payLevy": "Send money through Pay levy, not a direct transfer.",
};

export function plainReason(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;
    const raw =
      revert?.reason ??
      (revert?.data?.errorName as string | undefined) ??
      err.shortMessage;
    if (raw && REASON_COPY[raw]) return REASON_COPY[raw];
    if (raw?.toLowerCase().includes("user rejected"))
      return "You cancelled the transaction.";
    if (raw) return raw;
  }
  const msg = (err as Error)?.message ?? "Transaction failed.";
  if (msg.toLowerCase().includes("user rejected"))
    return "You cancelled the transaction.";
  return REASON_COPY[msg] ?? "Something went wrong. Please try again.";
}

interface SendArgs {
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
  pending: string;
  success: string;
  onDone?: () => void;
}

export function useWrite() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const qc = useQueryClient();
  const toasts = useToasts();
  const [busy, setBusy] = useState<string | null>(null);

  const send = useCallback(
    async (a: SendArgs) => {
      setBusy(a.functionName);
      const toastId = toasts.push({ kind: "pending", text: a.pending });
      try {
        const hash = await writeContractAsync({
          address: ESTATE_FUND_ADDRESS,
          abi: ESTATE_FUND_ABI as any,
          functionName: a.functionName,
          args: a.args as any,
          value: a.value,
        });
        toasts.update(toastId, { text: a.pending, txHash: hash });
        await publicClient!.waitForTransactionReceipt({ hash });
        toasts.update(toastId, {
          kind: "success",
          text: a.success,
          txHash: hash,
        });
        await qc.invalidateQueries({ queryKey: ["estate"] });
        a.onDone?.();
        return hash;
      } catch (err) {
        toasts.update(toastId, { kind: "error", text: plainReason(err) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [writeContractAsync, publicClient, qc, toasts],
  );

  return { send, busy };
}
