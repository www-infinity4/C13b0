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
  PHI_PAPERS = "infinity_phi_research_v1",
  OMNI_HISTORY = "omniPhi:history:v1",
  QUANTA_HISTORY = "quantaPhiBuildHistoryV1",
  PHI_SEARCH_TOKENS = "infinityPhi:searchTokens:v1";
type WalletRecord = { walletId: string; displayName: string };
type Token = {
  id?: string;
  query?: string;
  title?: string;
  stage?: string;
  kind?: string;
  source?: string;
  sourceSystem?: string;
  createdAt?: string;
  units?: number;
  paper?: unknown;
  payload?: unknown;
  websiteUrl?: string;
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
function legacySearchTokens(): Token[] {
  if (typeof window === "undefined") return [];
  const out: Token[] = [];
  try {
    const infinity = JSON.parse(localStorage.getItem(PHI_SEARCH_TOKENS) || "[]");
    if (Array.isArray(infinity)) {
      for (const item of infinity) {
        const query = String(item?.query || "").trim();
        const id = String(item?.id || "").trim();
        if (!query || !id) continue;
        const createdAt = String(item?.createdAt || new Date().toISOString());
        out.push({
          id,
          query,
          title: query,
          stage: "history",
          kind: "research",
          source: "infinity-phi",
          sourceSystem: "INFINITY_PHI",
          createdAt,
          units: 1,
          websiteUrl: `https://www-infinity4.github.io/C13b0/studio/build/?id=${encodeURIComponent(id)}&query=${encodeURIComponent(query)}&mode=preview`,
          payload: {
            title: query,
            dek: "Imported Infinity Phi search history",
            overview: `Infinity Phi search history for ${query}.`,
            sources: [],
          },
        });
      }
    }
  } catch {}
  try {
    const omni = JSON.parse(localStorage.getItem(OMNI_HISTORY) || "[]");
    if (Array.isArray(omni)) {
      for (const item of omni) {
        const query = String(item?.query || "").trim();
        if (!query) continue;
        const createdAt = String(item?.createdAt || new Date().toISOString());
        const id = String(item?.tokenId || `omni-history-${fingerprint(["omni", query, createdAt])}`);
        out.push({
          id, query, title: query, stage: "history", kind: "omni-search",
          source: "omni-phi", sourceSystem: "OMNI_PHI", createdAt, units: 1,
          websiteUrl: `https://www-infinity4.github.io/C13b0/studio/build/?id=${encodeURIComponent(id)}&query=${encodeURIComponent(query)}&mode=preview`,
          payload: { title: query, dek: "Imported Omni Phi search history", overview: `Omni Phi search history for ${query}.`, sources: [] },
        });
      }
    }
  } catch {}
  try {
    const quanta = JSON.parse(localStorage.getItem(QUANTA_HISTORY) || "[]");
    if (Array.isArray(quanta)) {
      for (const item of quanta) {
        const query = String(item?.query || "").trim();
        if (!query) continue;
        const createdAt = String(item?.created_at || item?.createdAt || new Date().toISOString());
        const id = String(item?.token_id || item?.tokenId || `quant-history-${fingerprint(["quanta", query, createdAt])}`);
        out.push({
          id, query, title: query, stage: "history", kind: "quant",
          source: "quanta-phi", sourceSystem: "QUANTAPHI", createdAt, units: 1,
          websiteUrl: `https://www-infinity4.github.io/C13b0/studio/build/?id=${encodeURIComponent(id)}&query=${encodeURIComponent(query)}&mode=preview`,
          payload: { title: query, dek: "Imported QuantaPhi Quant history", overview: `QuantaPhi search history for ${query}.`, sources: [] },
        });
      }
    }
  } catch {}
  return out;
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
        source: "infinity-phi",
        sourceSystem: "INFINITY_PHI",
      }));
    tokens = uniqueTokens([...migrated, ...tokens]);
  }
  const importedLegacy = legacySearchTokens();
  if (importedLegacy.length) {
    tokens = uniqueTokens([...tokens, ...importedLegacy]);
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
    const previousDraft = drafts.find((item) => item?.id === draft.id);
    if (!previousDraft || previousDraft.researchFingerprint !== fp ||
        previousDraft.title !== title || previousDraft.stage !== draft.stage) {
      drafts = [draft, ...drafts.filter((item) => item?.id !== draft.id)];
      await secureSaveDurable(DRAFTS, drafts);
    }
    tokens = uniqueTokens([...(handoff.chain || []), token, ...tokens]);
  }
  // Storage events reach every other tab on this origin. Rewriting an
  // unchanged ledger makes two open Infinity pages repeatedly wake each other.
  if (JSON.stringify(tokens) !== JSON.stringify(savedTokens)) {
    await secureSaveDurable(LEDGER, tokens);
  }
  // Keep one active identity across C13b0, StarQuest and Mint. This also
  // promotes older C13b0-only wallets into the shared wallet store.
  wallet = connectOrCreateWallet();
  // STATE is a derived snapshot. Do not rewrite it on every startup: a changing
  // updatedAt caused normal-profile storage churn even when nothing changed.
  const nextState = { wallet, tokens, drafts, updatedAt: new Date().toISOString() } satisfies UnifiedState;
  const priorState = await secureLoadDurable<UnifiedState | null>(STATE, null);
  const priorComparable = priorState ? { wallet: priorState.wallet, tokens: priorState.tokens, drafts: priorState.drafts } : null;
  const nextComparable = { wallet: nextState.wallet, tokens: nextState.tokens, drafts: nextState.drafts };
  if (JSON.stringify(priorComparable) !== JSON.stringify(nextComparable)) {
    await secureSaveDurable(STATE, nextState);
  }
  (window as any).InfinityTokenCount?.reconcile?.(tokens.length);
  window.dispatchEvent(new Event("infinity-state-bridged"));
  window.dispatchEvent(new Event("infinity-history-updated"));
}
export default function AppRuntime() {
  useEffect(() => {
    let running = false;
    let queued = false;
    let disposed = false;
    let scheduled = false;
    let timer = 0;
    let idleId = 0;
    let schedule = () => {};
    const direct = async () => {
      if (disposed) return;
      if (running) { queued = true; return; }
      running = true;
      try {
        do {
          queued = false;
          await bridgeInfinityState();
        } while (queued && !disposed);
      } catch (error) {
        console.warn("Infinity history sync deferred", error);
      } finally {
        running = false;
        if (queued) { queued = false; schedule(); }
      }
    };
    schedule = () => {
      if (disposed) return;
      if (running) { queued = true; return; }
      if (scheduled) return;
      scheduled = true;
      const run = () => {
        scheduled = false;
        timer = 0;
        idleId = 0;
        void direct();
      };
      const requestIdle = (window as any).requestIdleCallback;
      if (typeof requestIdle === "function") {
        idleId = requestIdle(run, { timeout: 1200 });
      } else {
        timer = window.setTimeout(run, 250);
      }
    };
    schedule();
    const sync = (event: StorageEvent) => {
      if (
        [HANDOFF, DRAFTS, LEDGER, WALLET].includes(
          event.key || "",
        )
      )
        schedule();
    };
    window.addEventListener("storage", sync);
    window.addEventListener("infinity-handoff-ready", schedule);
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
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
      if (idleId) (window as any).cancelIdleCallback?.(idleId);
      window.removeEventListener("storage", sync);
      window.removeEventListener("infinity-handoff-ready", schedule);
    };
  }, []);
  return null;
}
