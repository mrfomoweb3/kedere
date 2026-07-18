"use client";

import { Landing } from "./routes/Landing";
import { Welcome } from "./routes/Welcome";
import { Estate } from "./routes/Estate";
import { Docs } from "./routes/Docs";
import { usePath } from "./router";
import { ESTATE_FUND_ADDRESS } from "./contract/config";
import { MissingConfig } from "./components/MissingConfig";
import { SmoothScroll } from "./lib/smoothScroll";

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

  return (
    <SmoothScroll>
      <Screen path={path} />
    </SmoothScroll>
  );
}

function Screen({ path }: { path: string }) {
  const match = path.match(/^\/estate\/(\d+)\/?$/);
  if (match) return <Estate id={BigInt(match[1])} />;
  if (/^\/(welcome|app)\/?$/.test(path)) return <Welcome />;
  if (/^\/docs\/?$/.test(path)) return <Docs />;
  return <Landing />;
}
