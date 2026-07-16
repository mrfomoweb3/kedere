import { NextResponse } from "next/server";
import { sync } from "../../../../server/indexer";
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
  // keep the index fresh (bounded catch-up); ignore transient RPC errors
  try {
    await sync();
  } catch (e) {
    console.error("sync error", e);
  }
  const data = await getEstateData(estateId);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
