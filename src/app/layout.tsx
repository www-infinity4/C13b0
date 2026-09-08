import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import AppRuntime from "@/components/AppRuntime";

const phiPreview = "https://raw.githubusercontent.com/www-infinity4/C13b0/main/file_00000000cae081f598f9518633245d1f.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://www-infinity4.github.io/C13b0/"),
  title: "Infinity Phi Search — C13b0",
  manifest: "manifest.webmanifest",
  applicationName: "Infinity Phi Search",
  appleWebApp: { capable: true, title: "Infinity Phi Search", statusBarStyle: "black-translucent" },
  description: "Infinity Phi Search — indexing, extraction, higher-context decisions and transfer into your world.",
  alternates: { canonical: "https://www-infinity4.github.io/C13b0/" },
  openGraph: {
    type: "website",
    url: "https://www-infinity4.github.io/C13b0/",
    title: "Infinity Phi Search — C13b0",
    description: "All knowledge. All perspectives. One search. A deeper internet, a clearer tomorrow.",
    images: [{ url: phiPreview, width: 1536, height: 1024, alt: "Infinity Phi Search C13b0" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinity Phi Search — C13b0",
    description: "All knowledge. All perspectives. One search. A deeper internet, a clearer tomorrow.",
    images: [phiPreview],
  },
};

export const viewport: Viewport = { themeColor: "#071f38", viewportFit: "cover" };

const phiChatBarCss = `
  .phi-search-box {
    background: linear-gradient(135deg, #e6322d, #c51f24) !important;
    border-color: #ff655d !important;
    box-shadow: 0 10px 32px rgba(198,31,36,.22) !important;
  }
  .phi-search-box:focus-within {
    border-color: #ffd85a !important;
    box-shadow: 0 10px 36px rgba(198,31,36,.3) !important;
  }
  .phi-search-box input {
    color: #ffdc57 !important;
    caret-color: #ffdc57 !important;
  }
  .phi-search-box input::placeholder {
    color: rgba(255,220,87,.72) !important;
  }
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head><style>{phiChatBarCss}</style></head>
      <body className="min-h-screen antialiased" style={{ background: "var(--background)" }}>
        <AppRuntime />
        <SiteChrome>{children}</SiteChrome>
        <Script src="https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.js?v=20260831-game-rewards1" strategy="afterInteractive" />
      </body>
    </html>
  );
}
