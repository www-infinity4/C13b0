"use client";
import { useEffect } from "react";
import { secureLoad, secureSave } from "@/lib/secure-storage";
const HANDOFF = "c13b0_infinity_spark_handoff_v3",
  DRAFTS = "c13b0_infinity_studio_drafts_v1",
  LEDGER = "c13b0_infinity_token_ledger_v3",
  WALLET = "c13b0_infinity_wallet_v1",
  STATE = "c13b0_infinity_state_v1",
  PHI_PAPERS = "infinity_phi_research_v1";
type WalletRecord = { walletId: string; displayName: string };
type Token = {
  id?: string;
  query?: string;
  title?: string;
  stage?: string;
  createdAt?: string;
  units?: number;
  paper?: unknown;
};
type Handoff = {
  token?: Token;
  paper?: Record<string, unknown>;
  chain?: Token[];
  walletId?: string | null;
};
type Draft = {
  id?: string;
  title?: string;
  summary?: string;
  research?: unknown;
  stage?: string;
  schema?: string;
  status?: string;
  updatedAt?: string;
  researchFingerprint?: string;
};
type UnifiedState = {
  wallet: WalletRecord | null;
  tokens: Token[];
  drafts: Draft[];
  updatedAt: string;
};
type PhiPaper = {
  id: string;
  query: string;
  resolved: string;
  created: number;
  sources?: unknown[];
};
declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
    InfinityUnifiedWallet?: {
      UnifiedInfinityWallet: new () => {
        createWallet(input: { displayName: string }): WalletRecord;
        snapshot(): {
          currentWalletId: string | null;
          wallets: Record<string, WalletRecord>;
        };
      };
    };
  }
}
function uniqueTokens(tokens: Token[]) {
  const seen = new Set<string>();
  return tokens.filter((t) => {
    if (!t?.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}
function fingerprint(value: unknown) {
  const text = JSON.stringify(value || {});
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
export function bridgeInfinityState() {
  const handoff = secureLoad<Handoff | null>(HANDOFF, null);
  let drafts = secureLoad<Draft[]>(DRAFTS, []),
    tokens = secureLoad<Token[]>(LEDGER, []),
    wallet = secureLoad<WalletRecord | null>(WALLET, null);
  const phiPapers = secureLoad<PhiPaper[]>(PHI_PAPERS, []);
  if (phiPapers.length) {
    const migrated = phiPapers
      .slice()
      .reverse()
      .map((paper) => ({
        id: paper.id,
        researchId: paper.id,
        stage: "research",
        title: paper.query,
        query: paper.query,
        createdAt: new Date(paper.created).toISOString(),
        units: 1,
      }));
    tokens = uniqueTokens([...migrated, ...tokens]).slice(0, 200);
    secureSave(LEDGER, tokens);
  }
  if (handoff?.token?.id) {
    const token = handoff.token,
      paper =
        handoff.paper || (token.paper as Record<string, unknown> | undefined),
      title = String(
        paper?.title || token.title || token.query || "Infinity project",
      ),
      summary = String(paper?.dek || paper?.overview || ""),
      fp = fingerprint(paper),
      draft: Draft = {
        schema: "infinity/studio-project/v2",
        id: token.id,
        stage: token.stage || "webpage",
        title,
        summary,
        research: paper || null,
        researchFingerprint: fp,
        status: "DRAFT",
        updatedAt: new Date().toISOString(),
      };
    drafts = [draft, ...drafts.filter((item) => item?.id !== draft.id)];
    secureSave(DRAFTS, drafts);
    tokens = uniqueTokens([...(handoff.chain || []), token, ...tokens]);
    secureSave(LEDGER, tokens);
  }
  if (!window.InfinityUnifiedWallet) {
    class UnifiedInfinityWallet {
      snapshot() {
        const c = secureLoad<WalletRecord | null>(WALLET, null);
        return {
          currentWalletId: c?.walletId || null,
          wallets: c ? { [c.walletId]: c } : {},
        };
      }
      createWallet(input: { displayName: string }) {
        const e = secureLoad<WalletRecord | null>(WALLET, null);
        if (e) return e;
        const randomId =
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        const n = {
          walletId: `infinity-${randomId}`,
          displayName: input.displayName || "Infinity Wallet",
        };
        secureSave(WALLET, n);
        return n;
      }
    }
    window.InfinityUnifiedWallet = { UnifiedInfinityWallet };
  }
  wallet = secureLoad<WalletRecord | null>(WALLET, wallet);
  secureSave(STATE, {
    wallet,
    tokens,
    drafts,
    updatedAt: new Date().toISOString(),
  } satisfies UnifiedState);
  window.dispatchEvent(new Event("infinity-state-bridged"));
  window.dispatchEvent(new Event("infinity-history-updated"));
}
export default function AppRuntime() {
  useEffect(() => {
    bridgeInfinityState();
    const sync = (event: StorageEvent) => {
      if ([HANDOFF, DRAFTS, LEDGER, WALLET].includes(event.key || ""))
        bridgeInfinityState();
    };
    const direct = () => bridgeInfinityState();
    window.addEventListener("storage", sync);
    window.addEventListener("infinity-handoff-ready", direct);
    const isNative =
      typeof window.Capacitor?.isNativePlatform === "function"
        ? window.Capacitor.isNativePlatform()
        : Boolean(window.Capacitor);
    document.documentElement.dataset.runtime = isNative ? "native" : "web";
    if (!isNative && "serviceWorker" in navigator) {
      const base =
        location.pathname === "/C13b0" ||
        location.pathname.startsWith("/C13b0/")
          ? "/C13b0/"
          : "/";
      void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
    }
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("infinity-handoff-ready", direct);
    };
  }, []);
  return null;
}
