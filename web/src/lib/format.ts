import { formatEther } from "viem";

/** MON amount with 4 decimal places, tabular-friendly. */
export function fmtMon(wei: bigint): string {
  const s = formatEther(wei);
  const [int, frac = ""] = s.split(".");
  return `${int}.${(frac + "0000").slice(0, 4)}`;
}

export function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** "2 min ago", "just now", "3 h ago". */
export function relTime(unixSeconds?: number): string {
  if (!unixSeconds) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

/** Countdown to an executableAt timestamp, or "" when elapsed. */
export function countdown(executableAt: bigint, nowSec: number): string {
  const left = Number(executableAt) - nowSec;
  if (left <= 0) return "";
  const m = Math.floor(left / 60);
  const s = left % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
