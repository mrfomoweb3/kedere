"use client";

import dynamic from "next/dynamic";

// The whole interactive app is client-only (wallet + live chain reads), so we
// disable SSR for it and let the client router resolve the path. Next handles
// deep links / refreshes by matching this catch-all route on the server, then
// the client app reads window.location to render the right screen.
const App = dynamic(() => import("../../App"), { ssr: false });

export default function Page() {
  return <App />;
}
