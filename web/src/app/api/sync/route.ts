import { NextResponse } from "next/server";
import { sync } from "../../../server/indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual / cron-triggered incremental index. Call repeatedly to backfill.
export async function GET() {
  try {
    const result = await sync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "sync failed" },
      { status: 500 },
    );
  }
}
