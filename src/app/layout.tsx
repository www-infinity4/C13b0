import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Infinity OS — Hydrogen Host & P2P Signal Network",
  description:
    "Decentralized communication platform using emoji-based device identifiers, hydrogen signal propagation, and rare-earth magnet technology. Free, open-source P2P network.",
  keywords: [
    "hydrogen signal",
    "P2P communication",
    "emoji identifier",
    "rare earth magnets",
    "decentralized network",
    "infinity OS",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen antialiased" style={{ background: "var(--background)" }}>
        <Navigation />
        <main className="pt-16">{children}</main>
        <footer className="mt-20 border-t border-purple-900/30 py-8 text-center text-sm text-purple-300/60">
          <p>
            ∞ Infinity OS — Open Source P2P Network &nbsp;|&nbsp; Hydrogen Host
            Protocol &nbsp;|&nbsp; 2026
          </p>
          <p className="mt-1 text-xs">
            Built with rare-earth precision • Free forever • No subscriptions
          </p>
        </footer>
        <script src="https://www-infinity4.github.io/Mint-For-Infinity/infinity-wallet-menu.js" defer></script>
      </body>
    </html>
  );
}
