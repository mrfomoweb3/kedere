import { usePrivy } from "@privy-io/react-auth";
import { useAccount, useSwitchChain } from "wagmi";
import { MONAD_CHAIN_ID } from "../contract/config";
import { truncAddr } from "../lib/format";

export function WalletButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  if (!ready) {
    return (
      <button className="btn btn-ghost" disabled>
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button className="btn btn-primary" onClick={login}>
        Sign in
      </button>
    );
  }

  // Signed in but wallet not on Monad — offer to switch.
  if (chainId !== undefined && chainId !== MONAD_CHAIN_ID) {
    return (
      <button
        className="btn btn-rust"
        onClick={() => switchChain({ chainId: MONAD_CHAIN_ID })}
      >
        Switch to Monad Testnet
      </button>
    );
  }

  const label =
    address ??
    user?.email?.address ??
    user?.google?.email ??
    "Signed in";

  return (
    <button className="btn btn-ghost" title="Sign out" onClick={logout}>
      <span className="wallet-dot" />
      <span className="num">
        {label.startsWith("0x") ? truncAddr(label) : label}
      </span>
    </button>
  );
}
