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
  if (!Number.isInteger(estateId) || estateId < 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let data = await getEstateData(estateId);
  if (data) {
    // known estate → serve instantly, refresh index in the background
    syncInBackground();
    return NextResponse.json(data);
  }
  // not indexed yet (e.g. just created) → sync once, then read
  try {
    await syncOnce();
  } catch (e) {
    console.error("sync error", e);
  }
  data = await getEstateData(estateId);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
