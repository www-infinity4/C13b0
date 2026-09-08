"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Search,
  Wallet,
  History,
  Wand2,
  BookOpen,
  ChevronLeft,
  Share2,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { appPath } from "@/lib/base-path";
import {
  connectOrCreateWallet,
  formatWalletId,
  loadLocalWallet,
  type WalletRecord,
} from "@/lib/wallet";
import { secureLoad } from "@/lib/secure-storage";
const LEDGER = "c13b0_infinity_token_ledger_v3",
  PAGES = "c13b0_infinity_puck_pages_v1";
const links = [
  { href: "", label: "Infinity home", icon: Search },
  { href: "spark", label: "Search & research", icon: BookOpen },
  { href: "studio/build", label: "Website builder", icon: Wand2 },
];
type Token = {
  id: string;
  stage?: string;
  title?: string;
  query?: string;
  createdAt?: string;
  researchId?: string;
};
type Page = {
  id: string;
  title: string;
  updatedAt: string;
  researchId?: string;
  kind?: string;
};
export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname().replace(/\/+$/, "") || "/",
    focused =
      pathname === "/" ||
      pathname === "/C13b0" ||
      pathname.includes("/spark") ||
      pathname.includes("/phi") ||
      pathname.includes("/studio"),
    builder =
      pathname.includes("/studio/build") || pathname.includes("/phi/build"),
    [open, setOpen] = useState(false),
    [panel, setPanel] = useState<"menu" | "wallet" | "history">("menu"),
    [wallet, setWallet] = useState<WalletRecord | null>(null),
    [tokens, setTokens] = useState<Token[]>([]),
    [pages, setPages] = useState<Record<string, Page>>({});
  function refresh() {
    setWallet(loadLocalWallet());
    setTokens(secureLoad<Token[]>(LEDGER, []));
    setPages(secureLoad<Record<string, Page>>(PAGES, {}));
  }
  useEffect(() => {
    refresh();
    const f = () => refresh();
    window.addEventListener("storage", f);
    window.addEventListener("focus", f);
    window.addEventListener("infinity-history-updated", f);
    const timer = window.setInterval(f, 2000);
    return () => {
      window.removeEventListener("storage", f);
      window.removeEventListener("focus", f);
      window.removeEventListener("infinity-history-updated", f);
      window.clearInterval(timer);
    };
  }, []);
  function show(p: "menu" | "wallet" | "history") {
    refresh();
    setPanel(p);
    setOpen(true);
  }
  function connect() {
    const connected = connectOrCreateWallet();
    setWallet(connected);
    setPanel("wallet");
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({ title: document.title, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  }
  const built = Object.values(pages).sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  );
  const tokenHref = (token: Token) =>
    token.researchId || token.id.startsWith("phi-")
      ? `${appPath("phi/build")}?id=${encodeURIComponent(token.researchId || token.id)}`
      : `${appPath("studio/build")}?id=${encodeURIComponent(token.id)}&mode=preview`;
  const pageHref = (page: Page) =>
    page.kind === "phi-publication" && page.researchId
      ? `${appPath("phi/build")}?id=${encodeURIComponent(page.researchId)}`
      : `${appPath("studio/build")}?id=${encodeURIComponent(page.id)}&mode=preview`;
  return (
    <>
      {!focused && <Navigation />}
      {focused && (
        <>
          <button
            type="button"
            onClick={() => show("menu")}
            className={`fixed z-[70] grid place-items-center rounded-full border border-white/20 bg-[#071a34]/95 text-white shadow-lg transition-all ${builder ? "right-3 top-[max(5.25rem,calc(env(safe-area-inset-top)+4.25rem))] size-11" : "left-4 top-[max(1rem,env(safe-area-inset-top))] size-14"}`}
            aria-label="Open Infinity menu"
          >
            <Menu size={builder ? 22 : 27} />
          </button>
          {open && (
            <div
              className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
              onMouseDown={() => setOpen(false)}
            >
              <aside
                className="flex h-full w-[min(90vw,23rem)] flex-col bg-[linear-gradient(180deg,#071a34,#0a2b4b)] p-5 text-white"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    {panel !== "menu" && (
                      <button
                        onClick={() => setPanel("menu")}
                        className="grid size-9 place-items-center rounded-full bg-white/10"
                      >
                        <ChevronLeft />
                      </button>
                    )}
                    <div>
                      <b className="font-serif text-2xl">Infinity</b>
                      <p className="text-[11px] uppercase tracking-[.18em] text-blue-200/55">
                        Phi workspace
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="grid size-10 place-items-center rounded-full bg-white/10"
                  >
                    <X />
                  </button>
                </div>
                {panel === "menu" && (
                  <nav className="mt-5 grid gap-2">
                    {links.map(({ href, label, icon: Icon }) => (
                      <a
                        key={label}
                        href={appPath(href)}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-4 py-4 font-bold hover:bg-white/10"
                      >
                        <Icon size={19} />
                        {label}
                      </a>
                    ))}
                    <button
                      onClick={() => void share()}
                      className="flex items-center gap-3 rounded-xl px-4 py-4 font-bold hover:bg-white/10"
                    >
                      <Share2 size={19} />
                      Share this page
                    </button>
                    <button
                      onClick={() => show("wallet")}
                      className="flex items-center gap-3 rounded-xl px-4 py-4 font-bold hover:bg-white/10"
                    >
                      <Wallet size={19} />
                      Unified wallet
                    </button>
                    <button
                      onClick={() => show("history")}
                      className="flex items-center gap-3 rounded-xl px-4 py-4 font-bold hover:bg-white/10"
                    >
                      <History size={19} />
                      History & websites
                    </button>
                  </nav>
                )}
                {panel === "wallet" && (
                  <section className="mt-6">
                    <p className="text-xs font-black uppercase tracking-[.18em] text-blue-200/60">
                      Unified Infinity wallet
                    </p>
                    {wallet ? (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-5">
                        <b>{wallet.displayName}</b>
                        <p className="mt-2 font-mono text-xs text-white/55">
                          {formatWalletId(wallet.walletId)}
                        </p>
                        <p className="mt-5 text-3xl font-black">
                          {tokens.length}
                        </p>
                        <p className="text-sm text-white/55">saved tokens</p>
                      </div>
                    ) : (
                      <button
                        onClick={connect}
                        className="mt-4 w-full rounded-xl bg-[#f0bd55] px-4 py-3 font-black text-[#071a34]"
                      >
                        Connect unified wallet
                      </button>
                    )}
                  </section>
                )}
                {panel === "history" && (
                  <section className="mt-6 min-h-0 flex-1 overflow-y-auto">
                    <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-blue-200/60">
                      Generated websites
                    </p>
                    {built.length ? (
                      <div className="grid gap-2">
                        {built.map((p) => (
                          <a
                            key={p.id}
                            href={pageHref(p)}
                            onClick={() => setOpen(false)}
                            className="rounded-xl border border-white/10 bg-white/5 p-4"
                          >
                            <small className="font-bold uppercase text-[#f0bd55]">
                              Website
                            </small>
                            <b className="mt-1 block text-sm">{p.title}</b>
                            <small className="text-white/45">
                              {p.updatedAt
                                ? new Date(p.updatedAt).toLocaleString()
                                : "Saved"}
                            </small>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-white/5 p-4 text-sm text-white/55">
                        Generated websites will appear here after they are
                        saved.
                      </p>
                    )}
                    <p className="mb-3 mt-6 text-xs font-black uppercase tracking-[.18em] text-blue-200/60">
                      Research history
                    </p>
                    {tokens.length ? (
                      <div className="grid gap-2">
                        {tokens.slice(0, 100).map((t) => (
                          <a
                            key={t.id}
                            href={tokenHref(t)}
                            onClick={() => setOpen(false)}
                            className="rounded-xl border border-white/10 bg-white/5 p-4"
                          >
                            <small className="font-bold uppercase text-[#f0bd55]">
                              {t.stage || "research"}
                            </small>
                            <b className="mt-1 block text-sm">
                              {t.title || t.query || "Infinity research"}
                            </b>
                            {t.createdAt && (
                              <small className="text-white/45">
                                {new Date(t.createdAt).toLocaleString()}
                              </small>
                            )}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-white/5 p-4 text-sm text-white/55">
                        Your next research result will create the first token
                        here.
                      </p>
                    )}
                  </section>
                )}
                <p className="mt-auto border-t border-white/10 pt-4 text-xs text-white/45">
                  Research, websites and wallet state stay linked to their token
                  IDs.
                </p>
              </aside>
            </div>
          )}
        </>
      )}
      <main className={focused ? "" : "pt-16"}>{children}</main>
    </>
  );
}
