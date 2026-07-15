import abi from "./EstateFund.abi.json";

// ─── Monad testnet ────────────────────────────────────────────────────────────
export const MONAD_CHAIN_ID = 10143;
export const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
export const MONAD_EXPLORER = "https://testnet.monadexplorer.com";
export const MONAD_CURRENCY = { name: "Monad", symbol: "MON", decimals: 18 };

// ─── Deployed EstateFund ──────────────────────────────────────────────────────
// Filled in after `forge script Deploy` (see README §Deploy).
export const ESTATE_FUND_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x0000000000000000000000000000000000000000";

// Block the contract was deployed at — event scans start here so we never
// pull the whole chain. Set VITE_DEPLOY_BLOCK after deploy.
export const DEPLOY_BLOCK = BigInt(import.meta.env.VITE_DEPLOY_BLOCK ?? "0");

export const ESTATE_FUND_ABI = abi;

// WalletConnect Cloud project id (public — safe in frontend). Get one free at
// https://cloud.reown.com. Injected wallets (MetaMask, etc.) work without it;
// it's needed for WalletConnect / mobile-wallet QR connections.
export const WC_PROJECT_ID =
  (import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ?? "kedere_dev";

export const explorerTx = (hash: string) => `${MONAD_EXPLORER}/tx/${hash}`;
export const explorerAddr = (addr: string) => `${MONAD_EXPLORER}/address/${addr}`;
