import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { sync } from "../../../../../server/indexer";
import { getWalletEstates } from "../../../../../server/estateData";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }
  try {
    await sync();
  } catch (e) {
    console.error("sync error", e);
  }
  const estates = await getWalletEstates(address);
  return NextResponse.json({ estates });
}
