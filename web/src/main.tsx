import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig, monadTestnet } from "./wagmi";
import { ToastProvider } from "./components/Toasts";
import App from "./App";
import "./index.css";
import "./app.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={monadTestnet}
          theme={lightTheme({
            accentColor: "#1E5B3A",
            accentColorForeground: "#FAF6EE",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          <ToastProvider>
            <App />
          </ToastProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
