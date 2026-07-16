import { NextResponse } from "next/server";
import { randomNonce, setNonceCookie } from "../../../../server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const nonce = randomNonce();
  await setNonceCookie(nonce);
  return NextResponse.json({ nonce });
}
