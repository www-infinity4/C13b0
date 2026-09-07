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
  description: "Infinity research-to-website builder and Crown Index.",
  alternates: { canonical: "https://www-infinity4.github.io/C13b0/" },
  openGraph: { type:"website",url:"https://www-infinity4.github.io/C13b0/",title:"C13b0 — Infinity Site Builder & Crown Index",description:"Research, compose and preserve unique Infinity websites.",images:[{url:"https://www-infinity4.github.io/C13b0/infinity-preview-v2.jpg",width:1200,height:630,alt:"C13b0 Infinity builder"}] },
  twitter:{card:"summary_large_image",title:"C13b0 — Infinity Site Builder & Crown Index",description:"Research, compose and preserve unique Infinity websites.",images:["https://www-infinity4.github.io/C13b0/infinity-preview-v2.jpg"]},
};
export const viewport:Viewport={themeColor:"#071f38",viewportFit:"cover"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" className="scroll-smooth"><body className="min-h-screen antialiased" style={{background:"var(--background)"}}><AppRuntime/><SiteChrome>{children}</SiteChrome><Script src="https://www-infinity4.github.io/Mint-For-Infinity/unified-wallet.js?v=20260831-game-rewards1" strategy="afterInteractive"/></body></html>}
