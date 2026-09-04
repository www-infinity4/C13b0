"use client";

import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const focusedApp = pathname === "/spark" || pathname === "/studio";

  return (
    <>
      {!focusedApp && <Navigation />}
      <main className={focusedApp ? "" : "pt-16"}>{children}</main>
      {!focusedApp && (
        <footer className="mt-20 border-t border-purple-900/30 py-8 text-center text-sm text-purple-300/60">
          <p>
            Infinity OS — Open Source P2P Network &nbsp;|&nbsp; Hydrogen Host
            Protocol &nbsp;|&nbsp; 2026
          </p>
          <p className="mt-1 text-xs">
            Built with rare-earth precision • Free forever • No subscriptions
          </p>
        </footer>
      )}
    </>
  );
}
