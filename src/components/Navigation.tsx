"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, CircleDot, Zap, Wallet, History, Download } from "lucide-react";
import { connectOrCreateWallet, formatWalletId, loadLocalWallet, type WalletRecord } from "@/lib/wallet";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/spark", label: "Infinity Spark" },
  { href: "/business", label: "Build a Business" },
  { href: "/research", label: "Research" },
  { href: "/hydrogen-host", label: "Hydrogen Host" },
  { href: "/visualizer", label: "3D Visualizer" },
  { href: "/game", label: "Infinity Game" },
];

type TokenStub = { id: string; stage: string; title: string; createdAt: string };

function readLedger(): TokenStub[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("c13b0_infinity_token_ledger_v3");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      const inner = JSON.parse(atob(parsed.data));
      return Array.isArray(inner) ? inner.slice(0, 20) : [];
    }
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export default function Navigation() {
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletRecord | null>(() => loadLocalWallet());
  const [ledger] = useState<TokenStub[]>(() => readLedger());
  const pathname = usePathname();

  if (["/spark", "/studio"].includes(pathname.replace(/\/+$/, ""))) return null;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-slate-300 bg-[#172432]/95 backdrop-blur-xl"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" aria-label="Infinity OS home">
            <div className="relative">
              <CircleDot
                className="w-7 h-7 text-blue-300 group-hover:text-white transition-colors"
                aria-hidden="true"
              />
              <Zap
                className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <span className="font-serif text-lg font-black text-white">Infinity <span className="text-blue-300">OS</span></span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1" role="list">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-blue-200 hover:bg-blue-300/10 transition-all duration-200"
                role="listitem"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => {
                setWalletOpen(true);
                if (!wallet) setWallet(connectOrCreateWallet());
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-white/80 text-sm font-bold hover:bg-white/10 transition-all"
              aria-label="Open Infinity wallet"
            >
              <Wallet className="w-4 h-4" />
              {wallet ? formatWalletId(wallet.walletId) : "Wallet"}
            </button>
            <Link
              href="/business"
              className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-black hover:bg-blue-400 transition-all"
              aria-label="Build an Infinity business page"
            >
              Start a Business
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-blue-300 hover:text-white hover:bg-blue-300/10"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div
            id="mobile-menu"
            className="md:hidden pb-4"
            role="navigation"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-white/70 hover:text-blue-200 hover:bg-blue-300/10 transition-all"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/business"
                onClick={() => setOpen(false)}
                className="mt-2 px-4 py-3 rounded-lg bg-blue-500 text-white text-sm font-black text-center"
              >
                Start a Business
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  setWalletOpen(true);
                  if (!wallet) setWallet(connectOrCreateWallet());
                }}
                className="mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-white/15 text-white/80 text-sm font-bold"
              >
                <Wallet className="w-4 h-4" />
                {wallet ? "Wallet" : "Connect wallet"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wallet drawer */}
      {walletOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          onMouseDown={() => setWalletOpen(false)}
        >
          <aside
            className="ml-auto flex h-full w-full max-w-md flex-col bg-white text-[#172432] shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between border-b px-5">
              <b className="font-serif text-xl">Infinity wallet</b>
              <button
                onClick={() => setWalletOpen(false)}
                className="grid size-10 place-items-center rounded-full bg-[#edf3f8]"
                aria-label="Close wallet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {wallet ? (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-[#102f4a] p-5 text-white">
                    <b>{wallet.displayName}</b>
                    <p className="mt-2 break-all font-mono text-xs text-white/60">
                      {wallet.walletId}
                    </p>
                    <p className="mt-4 text-2xl font-black">
                      {ledger.length} token{ledger.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-[#607386]">
                      <History size={17} /> Recent tokens
                    </h3>
                    {ledger.length ? (
                      <div className="space-y-2">
                        {ledger.map((t) => (
                          <div key={t.id} className="rounded-xl border p-4">
                            <small className="font-bold uppercase text-[#9a6317]">
                              {t.stage}
                            </small>
                            <b className="block text-sm">{t.title}</b>
                            <small className="block text-xs text-[#607386]">
                              {new Date(t.createdAt).toLocaleString()}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-[#edf3f8] p-4 text-sm text-[#607386]">
                        Search or build to create linked tokens.
                      </p>
                    )}
                  </section>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[#607386]">
                    Connect or create a device-local Infinity wallet. No seed
                    phrase or private key needed.
                  </p>
                  <button
                    onClick={() => setWallet(connectOrCreateWallet())}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#174d7e] px-4 py-3 font-bold text-white"
                  >
                    <Wallet size={18} /> Connect or create wallet
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify({ wallet, tokens: ledger }, null, 2)],
                    { type: "application/json" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "infinity-wallet-backup.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!wallet}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-bold disabled:opacity-40"
              >
                <Download size={18} /> Export wallet backup
              </button>
            </div>
          </aside>
        </div>
      )}
    </nav>
  );
}
