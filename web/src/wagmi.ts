import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
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

export const wagmiConfig = getDefaultConfig({
  appName: "Kedere",
  projectId: WC_PROJECT_ID,
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(MONAD_RPC_URL),
  },
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
