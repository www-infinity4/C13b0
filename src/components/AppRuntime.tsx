"use client";

import { useEffect } from "react";
import { secureLoad, secureSave } from "@/lib/secure-storage";

const HANDOFF = "c13b0_infinity_spark_handoff_v3";
const DRAFTS = "c13b0_infinity_studio_drafts_v1";
const LEDGER = "c13b0_infinity_token_ledger_v3";
const WALLET = "c13b0_infinity_wallet_v1";
const STATE = "c13b0_infinity_state_v1";

type WalletRecord = { walletId: string; displayName: string };
type Token = { id?: string; query?: string; title?: string; stage?: string; createdAt?: string; units?: number; paper?: unknown };
type Handoff = { token?: Token; paper?: Record<string, unknown>; chain?: Token[]; walletId?: string | null };
type Draft = { id?: string; title?: string; summary?: string; research?: unknown; stage?: string; schema?: string; status?: string; updatedAt?: string };
type UnifiedState = { wallet: WalletRecord | null; tokens: Token[]; drafts: Draft[]; updatedAt: string };

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
    InfinityUnifiedWallet?: {
      UnifiedInfinityWallet: new () => {
        createWallet(input: { displayName: string }): WalletRecord;
        snapshot(): { currentWalletId: string | null; wallets: Record<string, WalletRecord> };
      };
    };
  }
}

function uniqueTokens(tokens: Token[]) {
  const seen = new Set<string>();
  return tokens.filter((token) => {
    if (!token?.id || seen.has(token.id)) return false;
    seen.add(token.id);
    return true;
  }).slice(0, 100);
}

function bridgeInfinityState() {
  const handoff = secureLoad<Handoff | null>(HANDOFF, null);
  let drafts = secureLoad<Draft[]>(DRAFTS, []);
  let tokens = secureLoad<Token[]>(LEDGER, []);
  let wallet = secureLoad<WalletRecord | null>(WALLET, null);

  // Spark's one-step auto-builder jumps directly to /studio/build. The builder
  // reads Studio drafts, so materialize the Spark handoff as that draft before
  // the route renders. This keeps research, title, summary and token ID attached.
  if (handoff?.token?.id) {
    const token = handoff.token;
    const paper = handoff.paper || (token.paper as Record<string, unknown> | undefined);
    const title = String(paper?.title || token.title || token.query || "Infinity project");
    const summary = String(paper?.dek || paper?.overview || "").slice(0, 1200);
    const draft: Draft = {
      schema: "infinity/studio-project/v1",
      id: token.id,
      stage: token.stage || "webpage",
      title,
      summary,
      research: paper || null,
      status: "DRAFT",
      updatedAt: new Date().toISOString(),
    };
    drafts = [draft, ...drafts.filter((item) => item?.id !== draft.id)].slice(0, 100);
    secureSave(DRAFTS, drafts);
    tokens = uniqueTokens([...(handoff.chain || []), token, ...tokens]);
    secureSave(LEDGER, tokens);
  }

  // Always provide the same lightweight wallet API. Existing pages previously
  // returned early when an external wallet script was absent, leaving Wallet
  // visibly present but disconnected.
  if (!window.InfinityUnifiedWallet) {
    class UnifiedInfinityWallet {
      snapshot() {
        const current = secureLoad<WalletRecord | null>(WALLET, null);
        return {
          currentWalletId: current?.walletId || null,
          wallets: current ? { [current.walletId]: current } : {},
        };
      }
      createWallet(input: { displayName: string }) {
        const existing = secureLoad<WalletRecord | null>(WALLET, null);
        if (existing) return existing;
        const next = {
          walletId: `infinity-${crypto.randomUUID()}`,
          displayName: input.displayName || "Infinity Wallet",
        };
        secureSave(WALLET, next);
        return next;
      }
    }
    window.InfinityUnifiedWallet = { UnifiedInfinityWallet };
  }

  wallet = secureLoad<WalletRecord | null>(WALLET, wallet);
  const state: UnifiedState = { wallet, tokens, drafts, updatedAt: new Date().toISOString() };
  secureSave(STATE, state);
}

export default function AppRuntime() {
  useEffect(() => {
    bridgeInfinityState();

    // Keep a unified snapshot current when another tab changes any part of the
    // Infinity state. Individual feature keys remain compatible with old builds.
    const sync = (event: StorageEvent) => {
      if ([HANDOFF, DRAFTS, LEDGER, WALLET].includes(event.key || "")) bridgeInfinityState();
    };
    window.addEventListener("storage", sync);

    const isNative =
      typeof window.Capacitor?.isNativePlatform === "function"
        ? window.Capacitor.isNativePlatform()
        : Boolean(window.Capacitor);
    document.documentElement.dataset.runtime = isNative ? "native" : "web";

    if (!isNative && "serviceWorker" in navigator) {
      const base = location.pathname.startsWith("/C13b0/") ? "/C13b0/" : "/";
      void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    }

    return () => window.removeEventListener("storage", sync);
  }, []);

  return null;
}
