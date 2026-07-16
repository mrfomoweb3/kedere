import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "../index.css";
import "../app.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Kedere — your estate's money, in plain sight",
  description:
    "Kedere — a transparent onchain levy fund for residential estates. Every levy publicly tracked, no spending without a proposal residents can veto.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231E5B3A'/%3E%3Ctext x='16' y='23' font-size='20' font-family='Georgia,serif' font-weight='700' fill='%23FAF6EE' text-anchor='middle'%3EK%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
