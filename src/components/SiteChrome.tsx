"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Search, Wallet, History, Wand2, BookOpen } from "lucide-react";
import Navigation from "@/components/Navigation";
import { appPath } from "@/lib/base-path";

const focusedLinks = [
  { href: "", label: "Infinity home", icon: Search },
  { href: "spark", label: "Search & research", icon: BookOpen },
  { href: "studio/build", label: "Website builder", icon: Wand2 },
];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const focusedApp = pathname === "/" || pathname === "/C13b0" || pathname === "/spark" || pathname === "/C13b0/spark" || pathname === "/studio" || pathname === "/C13b0/studio";
  const [open, setOpen] = useState(false);

  return (
    <>
      {!focusedApp && <Navigation />}
      {focusedApp && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] grid size-12 place-items-center rounded-full border border-white/20 bg-[#06172a]/90 text-white shadow-xl backdrop-blur-xl"
            aria-label="Open Infinity menu"
            aria-expanded={open}
          >
            <Menu size={24} />
          </button>
          {open && (
            <div className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
              <aside className="flex h-full w-[min(88vw,22rem)] flex-col bg-[#071b31] p-5 text-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <b className="font-serif text-2xl">Infinity</b>
                  <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-white/10" aria-label="Close Infinity menu"><X size={21}/></button>
                </div>
                <nav className="mt-5 grid gap-2" aria-label="Infinity menu">
                  {focusedLinks.map(({href,label,icon:Icon}) => (
                    <a key={label} href={appPath(href)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-4 font-bold text-white/90 hover:bg-white/10">
                      <Icon size={19}/>{label}
                    </a>
                  ))}
                  <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("infinity-open-wallet")); }} className="flex items-center gap-3 rounded-xl px-4 py-4 text-left font-bold text-white/90 hover:bg-white/10"><Wallet size={19}/>Wallet</button>
                  <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("infinity-open-history")); }} className="flex items-center gap-3 rounded-xl px-4 py-4 text-left font-bold text-white/90 hover:bg-white/10"><History size={19}/>History & tokens</button>
                </nav>
                <p className="mt-auto border-t border-white/10 pt-4 text-xs leading-5 text-white/45">Search → research → article → website builder → saved project state.</p>
              </aside>
            </div>
          )}
        </>
      )}
      <main className={focusedApp ? "" : "pt-16"}>{children}</main>
      {!focusedApp && (
        <footer className="mt-20 border-t border-purple-900/30 py-8 text-center text-sm text-purple-300/60">
          <p>Infinity OS — Open Source P2P Network &nbsp;|&nbsp; Hydrogen Host Protocol &nbsp;|&nbsp; 2026</p>
          <p className="mt-1 text-xs">Built with rare-earth precision • Free forever • No subscriptions</p>
        </footer>
      )}
    </>
  );
}
