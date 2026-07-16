"use client";

import { Landing } from "./routes/Landing";
import { Welcome } from "./routes/Welcome";
import { Estate } from "./routes/Estate";
import { usePath } from "./router";
import { ESTATE_FUND_ADDRESS } from "./contract/config";
import { MissingConfig } from "./components/MissingConfig";

export default function App() {
  const path = usePath();

  if (ESTATE_FUND_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return (
      <MissingConfig
        what="VITE_CONTRACT_ADDRESS"
        detail="Deploy EstateFund to Monad testnet (see README → Deploy), then set VITE_CONTRACT_ADDRESS in web/.env.local. The app reads all data from chain — it never shows placeholder numbers."
      />
    );
  }

  const match = path.match(/^\/estate\/(\d+)\/?$/);
  if (match) return <Estate id={BigInt(match[1])} />;
  if (/^\/(welcome|app)\/?$/.test(path)) return <Welcome />;
  return <Landing />;
}
