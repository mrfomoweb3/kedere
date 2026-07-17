import { NextResponse } from "next/server";
import { sync } from "../../../server/indexer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual / cron-triggered incremental index. Gated by CRON_SECRET so it can't
// be triggered anonymously (it drives RPC + DB writes). Set CRON_SECRET in the
// environment and pass `Authorization: Bearer <secret>` (Vercel Cron does this
// automatically when configured). If CRON_SECRET is unset, the endpoint is
// disabled rather than open.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
