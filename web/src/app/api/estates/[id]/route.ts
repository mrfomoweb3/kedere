import { NextResponse } from "next/server";
import { syncOnce, syncInBackground } from "../../../../server/indexer";
import { getEstateData } from "../../../../server/estateData";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const estateId = Number(id);
  // must be a non-negative int within Postgres int4 range
  if (!Number.isInteger(estateId) || estateId < 0 || estateId > 2_147_483_647) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  try {
    let data = await getEstateData(estateId);
    if (data) {
      // known estate → serve instantly, refresh index in the background
      syncInBackground();
      return NextResponse.json(data);
    }
    // not indexed yet (e.g. just created) → sync once, then read
    await syncOnce().catch((e) => console.error("sync error", e));
    data = await getEstateData(estateId);
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
