import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./phi-research.css";
import "./phi-refinement.css";
import "./phi-page2-layout.css";
import "./phi-front-center.css";
import "./open-source-credits.css";
import SiteChrome from "@/components/SiteChrome";
import AppRuntime from "@/components/AppRuntime";
import OpenSourceBuildCredits from "@/components/OpenSourceBuildCredits";
import OpenSourceUsageRuntime from "@/components/OpenSourceUsageRuntime";
import { appBase } from "@/lib/base-path";

const siteUrl = "https://www-infinity4.github.io/C13b0/";
const phiPreview = `${siteUrl}infinity-phi-share.png?v=20260915-phi-share-2`;

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
    images: [phiPreview],
  },
};

export const viewport: Viewport = { themeColor: "#071f38", viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const base = appBase();
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen antialiased" style={{ background: "var(--background)" }}>
        <Script src={`${base}/infinity-phi-search-core-v9.js?v=20260915-search9-fallback1`} strategy="beforeInteractive" />
        <AppRuntime />
        <OpenSourceUsageRuntime />
        <SiteChrome>{children}</SiteChrome>
        <OpenSourceBuildCredits className="open-source-global-footer" showChatGPT={false} />
        <Script src="https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.js?v=20260831-game-rewards1" strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-wallet-status.js?v=20260916-walletmenu4`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-tool-registry.js?v=20260915-media1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-pronoun-refinement.js?v=20260916-pronoun1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-gpt.js?v=20260913-1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-overview-teacher.js?v=20260915-overview-live2`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-card-gpt.js?v=20260915-card-gpt2`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-card-tools.js?v=20260914-card-tools2`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-media-v2.js?v=20260915-live-source3`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-image-feed-v2.js?v=20260915-image-feed2`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-result-tools.js?v=20260916-image-web1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-purple-schematic-v1.js?v=20260916-schematic1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-autobuild-link.js?v=20260916-autobuild1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-copy-capture.js?v=20260914-copy-capture1`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-runtime-repair.js?v=20260914-runtime-repair2`} strategy="afterInteractive" />
        <Script src={`${base}/infinity-phi-exact-card-share.js?v=20260916-share-reward-preview1`} strategy="afterInteractive" />
      </body>
    </html>
  );
}
