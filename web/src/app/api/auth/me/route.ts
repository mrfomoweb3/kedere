import { NextResponse } from "next/server";
import { getSessionAddress } from "../../../../server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const address = await getSessionAddress();
  return NextResponse.json({ address });
}
