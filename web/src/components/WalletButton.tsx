import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { MONAD_CHAIN_ID } from "../contract/config";
import { truncAddr } from "../lib/format";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button
        className="btn btn-primary"
        disabled={isPending}
        onClick={() => connect({ connector: injected() })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== MONAD_CHAIN_ID) {
    return (
      <button
        className="btn btn-rust"
        onClick={() => switchChain({ chainId: MONAD_CHAIN_ID })}
      >
        Switch to Monad Testnet
      </button>
    );
  }

  return (
    <button
      className="btn btn-ghost"
      title="Disconnect"
      onClick={() => disconnect()}
    >
      <span className="wallet-dot" />
      <span className="num">{truncAddr(address!)}</span>
    </button>
  );
}
