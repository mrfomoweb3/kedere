import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  MONAD_CHAIN_ID,
  MONAD_RPC_URL,
  MONAD_EXPLORER,
  MONAD_CURRENCY,
  WC_PROJECT_ID,
} from "./contract/config";

export const monadTestnet = defineChain({
  id: MONAD_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: MONAD_CURRENCY,
  rpcUrls: {
    default: { http: [MONAD_RPC_URL] },
    public: { http: [MONAD_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: MONAD_EXPLORER },
  },
  testnet: true,
});

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
      ssr: false,
    })
  : createConfig({
      chains: [monadTestnet],
      connectors: [injected()],
      transports,
      ssr: false,
    });

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
