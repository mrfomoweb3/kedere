import { defineChain } from "viem";
import {
  MONAD_CHAIN_ID,
  MONAD_RPC_URL,
  MONAD_EXPLORER,
  MONAD_CURRENCY,
} from "./config";

// Shared chain definition — safe to import from both client (wagmi) and server
// (indexer). Deliberately free of any client-only (RainbowKit) imports.
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
