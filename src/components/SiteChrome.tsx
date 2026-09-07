"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Search, Wallet, History, Wand2, BookOpen, ChevronLeft } from "lucide-react";
import Navigation from "@/components/Navigation";
import { appPath } from "@/lib/base-path";
import { connectOrCreateWallet, formatWalletId, loadLocalWallet, type WalletRecord } from "@/lib/wallet";
import { secureLoad } from "@/lib/secure-storage";

const focusedLinks = [
  { href: "", label: "Infinity home", icon: Search },
  { href: "spark", label: "Search & research", icon: BookOpen },
  { href: "studio/build", label: "Website builder", icon: Wand2 },
];
type TokenStub = { id:string; stage:string; title:string; query?:string; createdAt:string };

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/\/+$/, "") || "/";
  const focusedApp = pathname === "/" || pathname === "/C13b0" || pathname.includes("/spark") || pathname.includes("/studio");
  const [open, setOpen] = useState(false);
  const [panel,setPanel]=useState<"menu"|"wallet"|"history">("menu");
  const [wallet,setWallet]=useState<WalletRecord|null>(()=>typeof window === "undefined" ? null : loadLocalWallet());
  const tokens=useMemo(()=>typeof window === "undefined" ? [] : secureLoad<TokenStub[]>("c13b0_infinity_token_ledger_v3",[]),[open,panel]);
  function show(next:"menu"|"wallet"|"history"){setPanel(next);setOpen(true)}
  function connect(){setWallet(connectOrCreateWallet())}

  return (
    <>
      {!focusedApp && <Navigation />}
      {focusedApp && (
        <>
          <button type="button" onClick={() => show("menu")} className="fixed left-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] grid size-14 place-items-center rounded-full border border-white/25 bg-[#071a34]/95 text-white shadow-[0_8px_25px_rgba(0,0,0,.38),inset_0_0_18px_rgba(52,111,215,.22)] backdrop-blur-xl" aria-label="Open Infinity menu" aria-expanded={open}>
            <Menu size={27} />
          </button>
          {open && (
            <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
              <aside className="flex h-full w-[min(90vw,23rem)] flex-col bg-[linear-gradient(180deg,#071a34,#0a2b4b)] p-5 text-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">{panel!=="menu"&&<button onClick={()=>setPanel("menu")} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="Back to menu"><ChevronLeft size={20}/></button>}<div><b className="font-serif text-2xl">Infinity</b><p className="text-[11px] uppercase tracking-[.18em] text-blue-200/55">Phi workspace</p></div></div>
                  <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-white/10" aria-label="Close Infinity menu"><X size={21}/></button>
                </div>
                {panel==="menu"&&<nav className="mt-5 grid gap-2" aria-label="Infinity menu">
                  {focusedLinks.map(({href,label,icon:Icon}) => <a key={label} href={appPath(href)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-4 font-bold text-white/90 hover:bg-white/10"><Icon size={19}/>{label}</a>)}
                  <button onClick={()=>setPanel("wallet")} className="flex items-center gap-3 rounded-xl px-4 py-4 text-left font-bold text-white/90 hover:bg-white/10"><Wallet size={19}/>Unified wallet</button>
                  <button onClick={()=>setPanel("history")} className="flex items-center gap-3 rounded-xl px-4 py-4 text-left font-bold text-white/90 hover:bg-white/10"><History size={19}/>History & tokens</button>
                </nav>}
                {panel==="wallet"&&<section className="mt-6">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-blue-200/60">Unified Infinity wallet</p>
                  {wallet?<div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-5"><b className="text-lg">{wallet.displayName}</b><p className="mt-2 font-mono text-xs text-white/55">{formatWalletId(wallet.walletId)}</p><p className="mt-5 text-3xl font-black">{tokens.length}</p><p className="text-sm text-white/55">saved token{tokens.length===1?"":"s"}</p></div>:<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm leading-6 text-white/65">Create or reconnect the wallet used by Infinity research and site-building actions.</p><button onClick={connect} className="mt-4 w-full rounded-xl bg-[#f0bd55] px-4 py-3 font-black text-[#071a34]">Connect unified wallet</button></div>}
                  {wallet&&<button onClick={connect} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 font-bold">Refresh wallet connection</button>}
                </section>}
                {panel==="history"&&<section className="mt-6 min-h-0 flex-1 overflow-y-auto"><p className="mb-4 text-xs font-black uppercase tracking-[.18em] text-blue-200/60">Research & build history</p>{tokens.length?<div className="grid gap-2">{tokens.slice(0,40).map(t=><a key={t.id} href={appPath("spark")} className="rounded-xl border border-white/10 bg-white/5 p-4"><small className="font-bold uppercase text-[#f0bd55]">{t.stage}</small><b className="mt-1 block text-sm">{t.title}</b>{t.createdAt&&<small className="mt-1 block text-white/45">{new Date(t.createdAt).toLocaleString()}</small>}</a>)}</div>:<p className="rounded-xl bg-white/5 p-4 text-sm text-white/55">Searches and generated sites will appear here.</p>}</section>}
                <p className="mt-auto border-t border-white/10 pt-4 text-xs leading-5 text-white/45">Search → research → article → website builder → saved project state.</p>
              </aside>
            </div>
          )}
        </>
      )}
      <main className={focusedApp ? "" : "pt-16"}>{children}</main>
      {!focusedApp && <footer className="mt-20 border-t border-purple-900/30 py-8 text-center text-sm text-purple-300/60"><p>Infinity OS — Open Source P2P Network &nbsp;|&nbsp; Hydrogen Host Protocol &nbsp;|&nbsp; 2026</p><p className="mt-1 text-xs">Built with rare-earth precision • Free forever • No subscriptions</p></footer>}
    </>
  );
}
