import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monadTestnet } from "./contract/chain";
import { MONAD_RPC_URL, WC_PROJECT_ID } from "./contract/config";

export { monadTestnet };

const transports = { [monadTestnet.id]: http(MONAD_RPC_URL) };

// Full RainbowKit config (injected + WalletConnect + coinbase, mobile QR) only
// when a real WalletConnect projectId is set — RainbowKit hard-throws on an
// empty one. Otherwise fall back to an injected-only config so browser wallets
// (MetaMask, Rabby, …) work with zero setup and nothing crashes.
export const wagmiConfig = WC_PROJECT_ID
  ? getDefaultConfig({
      appName: "Kedere",
      projectId: WC_PROJECT_ID,
      chains: [monadTestnet],
      transports,
      ssr: true,
    })
  : createConfig({
      chains: [monadTestnet],
      connectors: [injected()],
      transports,
      ssr: true,
    });

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
