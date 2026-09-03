import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://www-infinity4.github.io/C13b0/"),
  title: "C13b0 — Infinity Site Builder & Crown Index",
  description:
    "Explore the repository-first Infinity builder: scan, shape, enrich, format, verify, and prepare sites for owner-reviewed publication through Crown Index.",
  alternates: { canonical: "https://www-infinity4.github.io/C13b0/" },
  openGraph: {
    type: "website",
    url: "https://www-infinity4.github.io/C13b0/",
    title: "C13b0 — Infinity Site Builder & Crown Index",
    description: "A repository bootstrap and verification toolkit covering previews, metadata, wallet integration, readiness signals, and owner-reviewed publication.",
    images: [{
      url: "https://www-infinity4.github.io/C13b0/c13b0-preview.jpg",
      width: 1200,
      height: 630,
      alt: "C13b0 repository pipeline from scan through owner-reviewed publication",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "C13b0 — Infinity Site Builder & Crown Index",
    description: "See the repository pipeline: scan, shape, enrich, format, verify, and prepare an owner-reviewed release.",
    images: ["https://www-infinity4.github.io/C13b0/c13b0-preview.jpg"],
  },
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
            Infinity OS — Open Source P2P Network &nbsp;|&nbsp; Hydrogen Host
            Protocol &nbsp;|&nbsp; 2026
          </p>
          <p className="mt-1 text-xs">
            Built with rare-earth precision • Free forever • No subscriptions
          </p>
        </footer>
        <Script src="https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.js?v=20260831-game-rewards1" strategy="afterInteractive" />
        <Script src="https://www-infinity4.github.io/Mint-For-Infinity/infinity-wallet-menu.js?v=20260814-menu2" strategy="afterInteractive" />
        <Script
          src="https://www-infinity4.github.io/Mint-For-Infinity/site-community.js?v=20260831-storage2"
          data-site-id="C13B0"
          data-site-title="C13b0 Infinity Site Builder"
          data-share-url="https://www-infinity4.github.io/C13b0/"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
