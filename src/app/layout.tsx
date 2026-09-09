import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import AppRuntime from "@/components/AppRuntime";

const siteUrl = "https://www-infinity4.github.io/C13b0/";
const phiPreview = `${siteUrl}infinity-phi-share.png?v=20260908-phi-share-1`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Infinity Phi Search — C13b0",
  applicationName: "Infinity Phi Search",
  description: "Infinity Phi Search — indexing, extraction, higher-context decisions and transfer into your world.",
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Infinity Phi Search",
    title: "Infinity Phi Search — C13b0",
    description: "All knowledge. All perspectives. One search. A deeper internet, a clearer tomorrow.",
    images: [{ url: phiPreview, width: 1536, height: 1024, alt: "Infinity Phi Search C13b0 — indexing, extraction, decision and transfer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinity Phi Search — C13b0",
    description: "All knowledge. All perspectives. One search. A deeper internet, a clearer tomorrow.",
    images: [{ url: phiPreview, alt: "Infinity Phi Search C13b0" }],
  },
};

export const viewport: Viewport = { themeColor: "#071f38", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen antialiased" style={{ background: "var(--background)" }}>
        <AppRuntime />
        <SiteChrome>{children}</SiteChrome>
        <Script src="https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.js?v=20260831-game-rewards1" strategy="afterInteractive" />
      </body>
    </html>
  );
}
