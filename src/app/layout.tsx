import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import AppRuntime from "@/components/AppRuntime";

export const metadata: Metadata = {
  metadataBase: new URL("https://www-infinity4.github.io/C13b0/"),
  title: "C13b0 — Infinity Site Builder & Crown Index",
  manifest: "manifest.webmanifest",
  applicationName: "Infinity",
  appleWebApp: { capable: true, title: "Infinity", statusBarStyle: "black-translucent" },
  description:
    "Explore the repository-first Infinity builder: scan, shape, enrich, format, verify, and prepare sites for owner-reviewed publication through Crown Index.",
  alternates: { canonical: "https://www-infinity4.github.io/C13b0/" },
  openGraph: {
    type: "website",
    url: "https://www-infinity4.github.io/C13b0/",
    title: "C13b0 — Infinity Site Builder & Crown Index",
    description: "A repository bootstrap and verification toolkit covering previews, metadata, wallet integration, readiness signals, and owner-reviewed publication.",
    images: [{
      url: "https://www-infinity4.github.io/C13b0/infinity-preview-v2.jpg",
      width: 1200,
      height: 630,
      alt: "C13b0 repository pipeline from scan through owner-reviewed publication",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "C13b0 — Infinity Site Builder & Crown Index",
    description: "See the repository pipeline: scan, shape, enrich, format, verify, and prepare an owner-reviewed release.",
    images: ["https://www-infinity4.github.io/C13b0/infinity-preview-v2.jpg"],
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

export const viewport: Viewport = {
  themeColor: "#071f38",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen antialiased" style={{ background: "var(--background)" }}>
        <AppRuntime />
        <SiteChrome>{children}</SiteChrome>
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
