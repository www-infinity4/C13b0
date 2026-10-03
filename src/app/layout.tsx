import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./phi-research.css";
import "./phi-refinement.css";
import "./phi-page2-layout.css";
import "./phi-front-center.css";
import "./open-source-credits.css";
import SiteChrome from "@/components/SiteChrome";
import AppRuntime from "@/components/AppRuntime";
import OpenSourceBuildCredits from "@/components/OpenSourceBuildCredits";
import { appPath } from "@/lib/base-path";
const siteUrl="https://www-infinity4.github.io/C13b0/",phiPreview=`${siteUrl}infinity-phi-share.png?v=20260915-phi-share-2`;
export const metadata:Metadata={metadataBase:new URL(siteUrl),title:"Infinity Phi Search — C13b0",applicationName:"Infinity Phi Search",description:"Infinity Phi Search — indexing, extraction, higher-context decisions and transfer into your world.",alternates:{canonical:siteUrl},openGraph:{type:"website",url:siteUrl,siteName:"Infinity Phi Search",title:"Infinity Phi Search — C13b0",description:"All knowledge. All perspectives. One search. A deeper internet, a clearer tomorrow.",images:[{url:phiPreview,width:1536,height:1024,alt:"Infinity Phi Search C13b0 — indexing, extraction, decision and transfer"}]},twitter:{card:"summary_large_image",title:"Infinity Phi Search — C13b0",description:"All knowledge. All perspectives. One search. A deeper internet, a clearer tomorrow.",images:[phiPreview]}};
export const viewport:Viewport={themeColor:"#071f38",viewportFit:"cover"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" className="scroll-smooth"><head><script defer src="https://unified-wallet.marvaseater.workers.dev/unified-wallet.js"/><style dangerouslySetInnerHTML={{__html:`#testSaleButton,#test-sale-button,[data-action="test-sale"],[data-wallet-action="test-sale"],#shopButton,#shop-button,[data-action="shop"],[data-wallet-action="shop"],#receiptButton,#receipt-button,[data-action="receipt"],[data-wallet-action="receipt"]{display:none!important}`}}/><script defer src={appPath("cloud-wallet-client.js?v=20261003-authoritative1")}/><script defer src={appPath("infinity-web-startup.js?v=20261003-direct1")}/></head><body className="min-h-screen antialiased" style={{background:"var(--background)"}}><script defer src={appPath("unified-token-count.js?v=20261003-assets2")}/><script defer src={appPath("infinity-starcoin-contract.js?v=20261003-assets2")}/><script defer src={appPath("infinity-star-repair.js?v=20261002-starrepair2")}/><AppRuntime/><SiteChrome>{children}</SiteChrome><OpenSourceBuildCredits className="open-source-global-footer" showChatGPT={false}/></body></html>}
