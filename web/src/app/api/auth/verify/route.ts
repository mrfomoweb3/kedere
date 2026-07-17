import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { readNonceCookie, startSession } from "../../../../server/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { message, signature } = body ?? {};
  if (!message || !signature) {
    return NextResponse.json({ error: "missing message/signature" }, { status: 400 });
  }
  const nonce = await readNonceCookie();
  if (!nonce) {
    return NextResponse.json({ error: "nonce expired" }, { status: 401 });
  }
  try {
    const siwe = new SiweMessage(message);
    // Bind the signature to this app's origin (from the request host) and to
    // Monad testnet — prevents cross-domain / cross-chain replay of a signature.
    const host = req.headers.get("host") ?? undefined;
    const { data } = await siwe.verify({ signature, nonce, domain: host });
    if (data.chainId !== 10143) {
      return NextResponse.json({ error: "wrong chain" }, { status: 401 });
    }
    await startSession(data.address);
    return NextResponse.json({ address: data.address.toLowerCase() });
  } catch {
    return NextResponse.json({ error: "verification failed" }, { status: 401 });
  }
}
