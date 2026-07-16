import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { syncInBackground } from "../../../../../server/indexer";
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
  // Serve from the DB immediately; refresh the index in the background so the
  // onboarding check never blocks on an RPC round-trip.
  const estates = await getWalletEstates(address);
  syncInBackground();
  return NextResponse.json({ estates });
}
