import "server-only";
import { createPublicClient, http, type PublicClient } from "viem";
import { monadTestnet } from "../contract/chain";
import { MONAD_RPC_URL } from "../contract/config";

export const serverClient: PublicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(MONAD_RPC_URL),
});
