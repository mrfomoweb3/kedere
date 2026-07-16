import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { MONAD_CHAIN_ID } from "../contract/config";

// Sign-In With Ethereum: prove wallet ownership, then the server sets a session
// cookie so the wallet can write its own profile (display name).
export function useAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const signIn = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    try {
      const nonceRes = await fetch("/api/auth/nonce", { credentials: "include" });
      const { nonce } = await nonceRes.json();
      const message = createSiweMessage({
        address,
        chainId: MONAD_CHAIN_ID,
        domain: window.location.host,
        nonce,
        uri: window.location.origin,
        version: "1",
        statement: "Sign in to Kedere to save your resident profile.",
      });
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, signature }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [address, signMessageAsync]);

  // Save the display name; signs in first if there's no valid session yet.
  const saveName = useCallback(
    async (name: string): Promise<boolean> => {
      const post = () =>
        fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name }),
        });
      let res = await post();
      if (res.status === 401) {
        const ok = await signIn();
        if (!ok) return false;
        res = await post();
      }
      return res.ok;
    },
    [signIn],
  );

  return { signIn, saveName };
}
