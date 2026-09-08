"use client";
import { useEffect } from "react";
import {
  secureLoadDurable,
  secureSaveDurable,
} from "@/lib/secure-storage";
import { connectOrCreateWallet } from "@/lib/wallet";
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
export async function bridgeInfinityState() {
  const [handoff, savedDrafts, savedTokens, savedWallet, phiPapers] =
    await Promise.all([
      secureLoadDurable<Handoff | null>(HANDOFF, null),
      secureLoadDurable<Draft[]>(DRAFTS, []),
      secureLoadDurable<Token[]>(LEDGER, []),
      secureLoadDurable<WalletRecord | null>(WALLET, null),
      secureLoadDurable<PhiPaper[]>(PHI_PAPERS, []),
    ]);
  let drafts = savedDrafts,
    tokens = savedTokens,
    wallet = savedWallet;
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
    await secureSaveDurable(LEDGER, tokens);
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
    await secureSaveDurable(DRAFTS, drafts);
    tokens = uniqueTokens([...(handoff.chain || []), token, ...tokens]);
    await secureSaveDurable(LEDGER, tokens);
  }
  // Keep one active identity across C13b0, StarQuest and Mint. This also
  // promotes older C13b0-only wallets into the shared wallet store.
  wallet = connectOrCreateWallet();
  await secureSaveDurable(STATE, {
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
    void bridgeInfinityState();
    const sync = (event: StorageEvent) => {
      if (
        [HANDOFF, DRAFTS, LEDGER, WALLET, "infinity_unified_wallet_v1"].includes(
          event.key || "",
        )
      )
        void bridgeInfinityState();
    };
    const direct = () => void bridgeInfinityState();
    window.addEventListener("storage", sync);
    window.addEventListener("infinity-handoff-ready", direct);
    const isNative =
      typeof window.Capacitor?.isNativePlatform === "function"
        ? window.Capacitor.isNativePlatform()
        : Boolean(window.Capacitor);
    document.documentElement.dataset.runtime = isNative ? "native" : "web";
    const currentUrl = new URL(location.href);
    if (currentUrl.searchParams.has("cache-repair")) {
      currentUrl.searchParams.delete("cache-repair");
      history.replaceState(history.state, "", currentUrl.href);
    }
    if (!isNative) {
      // The web build is no longer an installable/offline PWA. Remove any
      // previously installed C13b0 worker and every old Infinity shell cache.
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(
              registrations
                .filter((registration) =>
                  new URL(registration.scope).pathname.startsWith("/C13b0/"),
                )
                .map((registration) => registration.unregister()),
            ),
          )
          .catch(() => undefined);
      }
      if ("caches" in window) {
        void caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("infinity-shell-"))
                .map((key) => caches.delete(key)),
            ),
          )
          .catch(() => undefined);
      }
    }
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("infinity-handoff-ready", direct);
    };
  }, []);
  return null;
}
