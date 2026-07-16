import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { prisma } from "../../../../server/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }
  const profile = await prisma.profile.findUnique({
    where: { address: address.toLowerCase() },
  });
  return NextResponse.json({ name: profile?.name ?? null });
}
