import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig, monadTestnet } from "./wagmi";
import { PRIVY_APP_ID } from "./contract/config";
import { ToastProvider } from "./components/Toasts";
import { MissingConfig } from "./components/MissingConfig";
import App from "./App";
import "./index.css";
import "./app.css";

const queryClient = new QueryClient();

function Root() {
  if (!PRIVY_APP_ID) {
    return (
      <MissingConfig
        what="VITE_PRIVY_APP_ID"
        detail="Create a free app at dashboard.privy.io, then set VITE_PRIVY_APP_ID in web/.env.local to enable sign-in."
      />
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["email", "wallet", "google"],
        appearance: {
          theme: "light",
          accentColor: "#1E5B3A",
          logo: undefined,
          walletChainType: "ethereum-only",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
