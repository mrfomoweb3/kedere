import { NextResponse } from "next/server";
import { prisma } from "../../../server/prisma";
import { getSessionAddress } from "../../../server/auth";

// Save the signed-in wallet's display name. Requires a SIWE session; a wallet
// can only write its own profile.
export async function POST(req: Request) {
  const address = await getSessionAddress();
  if (!address) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const name = (body?.name ?? "").toString().trim().slice(0, 60);
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const profile = await prisma.profile.upsert({
    where: { address: address.toLowerCase() },
    create: { address: address.toLowerCase(), name },
    update: { name },
  });
  return NextResponse.json({ name: profile.name });
}
