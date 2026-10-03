"use client";

import { appPath } from "@/lib/base-path";
import { secureLoad, secureSave, secureSaveDurable } from "@/lib/secure-storage";

const TOKENS = "infinityPhi:searchTokens:v1",
  ACTIVE = "infinityPhi:activeSearchToken:v1",
  LEDGER = "c13b0_infinity_token_ledger_v3";
export type PhiSearchToken = {
  id: string;
  label: string;
  query: string;
  createdAt: string;
  updatedAt: string;
  items: any[];
};
const clean = (value: unknown, max = 1800) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const readJson = (key: string, fallback: any) => {
  try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
  catch { return fallback; }
};
let authoritativeWalletPromise: Promise<any> | null = null;
function authoritativeWallet() {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = (window as any).InfinityUnifiedWallet;
  if (existing) return Promise.resolve(new existing({ appName: "Infinity Phi" }));
  if (authoritativeWalletPromise) return authoritativeWalletPromise;
  authoritativeWalletPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://unified-wallet.marvaseater.workers.dev/unified-wallet.js";
    script.async = true;
    script.onload = () => {
      const Wallet = (window as any).InfinityUnifiedWallet;
      resolve(Wallet ? new Wallet({ appName: "Infinity Phi" }) : null);
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return authoritativeWalletPromise;
}
async function creditAuthoritativeInfinitySearch(token: PhiSearchToken) {
  try {
    const wallet = await authoritativeWallet();
    if (!wallet) return;
    const result = await wallet.mintToken("INFINITY_SEARCH", {
      query: token.query,
      search_id: token.id,
      legacy_token_id: token.id,
      source: "INFINITY_PHI",
      created_at: token.createdAt,
    }, "infinity-search:" + token.id);
    (window as any).InfinityTokenCount?.reconcile?.(Number(result?.balance) || 0);
  } catch (error) {
    console.warn("Authoritative Infinity search credit deferred", error);
  }
}
function creditInfinitySearch(token: PhiSearchToken) {
  try {
    const session = readJson("starquest_session", null),
      users = readJson("starquest_users", {}),
      signed = session?.key && users[session.key],
      wallet: any = signed || readJson("starquest_guest_profile_v1", {
        key: "__guest__", tokens: 0, infinityTokens: 0, infinityLedger: [], infinitySearches: [],
      });
    wallet.infinityTokens = Math.max(0, Number(wallet.infinityTokens) || 0);
    wallet.infinityLedger = Array.isArray(wallet.infinityLedger) ? wallet.infinityLedger : [];
    wallet.infinitySearches = Array.isArray(wallet.infinitySearches) ? wallet.infinitySearches : [];
    if (!wallet.infinityLedger.some((entry: any) => entry?.tokenId === token.id)) {
      wallet.infinityTokens += 1;
      wallet.infinityLedger.push({
        id: token.id, tokenId: token.id, type: "search_reward", amount: 1,
        balance: wallet.infinityTokens, source: "infinity-phi", query: token.query,
        fingerprint: `infinity-search:${token.id}`, createdAt: Date.now(),
      });
      wallet.infinitySearches.push({ tokenId: token.id, query: token.query, source: "infinity-phi", createdAt: Date.now() });
      wallet.infinityLedger = wallet.infinityLedger.slice(-1000);
      wallet.infinitySearches = wallet.infinitySearches.slice(-1000);
      if (signed) {
        users[session.key] = wallet;
        localStorage.setItem("starquest_users", JSON.stringify(users));
      } else localStorage.setItem("starquest_guest_profile_v1", JSON.stringify(wallet));
    }
    const unified = readJson("infinity_unified_wallet_v1", {}),
      searches = Array.isArray(unified.searches) ? unified.searches : [];
    if (!searches.some((entry: any) => entry?.tokenId === token.id))
      searches.push({ tokenId: token.id, query: token.query, source: "infinity-phi", createdAt: Date.now() });
    unified.infinityTokens = wallet.infinityTokens;
    unified.searches = searches.slice(-1000);
    const walletId = unified.currentWalletId;
    if (walletId && unified.wallets?.[walletId]) {
      const active = unified.wallets[walletId];
      active.balances = { ...(active.balances || {}), infinityTokens: wallet.infinityTokens };
    }
    unified.updatedAt = Date.now();
    unified.source = "infinity-phi";
    localStorage.setItem("infinity_unified_wallet_v1", JSON.stringify(unified));
    window.dispatchEvent(new Event("infinity-wallet-updated"));
    window.dispatchEvent(new CustomEvent("controlphi:wallet-change", { detail: { infinityTokens: wallet.infinityTokens, source: "infinity-phi" } }));
  } catch {}
}

function canonicalWebsiteUrl(id: string, query: string) {
  const params = new URLSearchParams({
    id,
    query,
    mode: "preview",
  });
  return `${appPath("studio/build")}?${params.toString()}`;
}
function publishCanonicalToken(token: Record<string, any>) {
  try {
    const existing = secureLoad<Record<string, any>[]>(LEDGER, []);
    const next = [
      token,
      ...existing.filter((item) => String(item?.id || "") !== String(token.id)),
    ];
    // Match the Quanta path: write the canonical local record immediately,
    // then mirror it to IndexedDB without delaying navigation.
    secureSave(LEDGER, next);
    void secureSaveDurable(LEDGER, next);
    window.dispatchEvent(new Event("infinity-history-updated"));
    window.dispatchEvent(new Event("infinity-wallet-updated"));
    window.dispatchEvent(
      new CustomEvent("infinity:token-ledger-updated", {
        detail: { count: next.length, tokenId: token.id },
      }),
    );
    return token;
  } catch {
    return token;
  }
}
function canonicalPhiToken(token: PhiSearchToken, payload?: Record<string, any>) {
  const websiteUrl = canonicalWebsiteUrl(token.id, token.query);
  return {
    id: token.id,
    researchId: token.id,
    stage: payload ? "research" : "search",
    kind: "research",
    color: "yellow",
    status: "finished",
    value: 1,
    units: 1,
    title: token.query,
    query: token.query,
    resolved: token.query,
    source: "infinity-phi",
    sourceSystem: "INFINITY_PHI",
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
    websiteUrl,
    payload:
      payload ||
      {
        title: token.query,
        dek: "Infinity Phi search token",
        overview: `Infinity Phi is building the research package for ${token.query}.`,
        sources: [],
      },
  };
}
function prebuildCanonicalWebsite(id: string, query: string) {
  if (typeof document === "undefined" || !document.body) return;
  const frame = document.createElement("iframe");
  frame.src = canonicalWebsiteUrl(id, query);
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;width:1px;height:1px;right:-8px;bottom:-8px;opacity:0;pointer-events:none;border:0";
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 18000);
}
export function syncPhiSearchTokenResearch(
  tokenId: string,
  query: string,
  research: {
    title?: string;
    resolved?: string;
    overview?: string;
    sources?: Array<{
      title?: string;
      url?: string;
      excerpt?: string;
      provider?: string;
    }>;
  },
) {
  const tokens = read(),
    found = tokens.find((value) => value.id === tokenId),
    now = new Date().toISOString(),
    token: PhiSearchToken =
      found ||
      {
        id: tokenId,
        label: tokenLabel(query),
        query,
        createdAt: now,
        updatedAt: now,
        items: [],
      },
    payload = {
      title: clean(research.title || query, 500),
      dek: clean(research.resolved || query, 1000),
      overview: clean(research.overview, 6000),
      findings: (research.sources || [])
        .map((source) => clean(source.excerpt, 1800))
        .filter(Boolean)
        .slice(0, 24),
      sources: (research.sources || []).slice(0, 40).map((source) => ({
        title: clean(source.title, 500),
        url: clean(source.url, 1800),
        excerpt: clean(source.excerpt, 2400),
        provider: clean(source.provider, 200),
      })),
    };
  publishCanonicalToken({
    ...canonicalPhiToken({ ...token, updatedAt: now }, payload),
    sourceCount: payload.sources.length,
  });
  prebuildCanonicalWebsite(token.id, token.query);
}

const tokenLabel = (query: string) =>
  `Infinity token · ${clean(query, 72) || "Untitled search"}`;
const itemKey = (item: any) => {
  const media = String(item?.mediaKind || "").toLowerCase(),
    file = Array.isArray(item?.files) ? item.files[0] : null;
  if (media === "audio" || media === "video")
    return `${media}:${clean(file?.url || item?.mediaUrl || item?.storyKey || item?.id)}`;
  if (item?.selectedFromImageSearch || item?.kind === "image-seed")
    return `image:${clean(item?.image || item?.imageUrl || item?.storyKey || item?.id)}`;
  return `card:${clean(item?.storyKey || item?.url || item?.id)}`;
};
function read(): PhiSearchToken[] {
  try {
    const value = JSON.parse(localStorage.getItem(TOKENS) || "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((raw: any) => {
      const id = clean(raw?.id, 300),
        query = clean(raw?.query, 500);
      if (!id || !query) return [];
      return [
        {
          ...raw,
          id,
          query,
          label: /^Token\s+[A-Z]+$/i.test(clean(raw?.label))
            ? tokenLabel(query)
            : clean(raw?.label, 120) || tokenLabel(query),
          items: Array.isArray(raw?.items) ? raw.items : [],
        } as PhiSearchToken,
      ];
    });
  } catch {
    return [];
  }
}
function write(tokens: PhiSearchToken[]) {
  try {
    localStorage.setItem(TOKENS, JSON.stringify(tokens.slice(0, 5000)));
  } catch {}
}
function activate(token: PhiSearchToken) {
  try {
    sessionStorage.setItem(
      ACTIVE,
      JSON.stringify({ id: token.id, query: token.query }),
    );
  } catch {}
  return token;
}
export function beginPhiSearchToken(query: string) {
  const tokens = read(),
    now = new Date().toISOString(),
    cleaned = clean(query, 500),
    token: PhiSearchToken = {
      id: `phi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      label: tokenLabel(cleaned),
      query: cleaned,
      createdAt: now,
      updatedAt: now,
      items: [],
    };
  (window as any).InfinityTokenCount?.register?.(token.id);
  write([token, ...tokens]);
  publishCanonicalToken(canonicalPhiToken(token));
  prebuildCanonicalWebsite(token.id, token.query);
  creditInfinitySearch(token);
  window.dispatchEvent(new CustomEvent("phi:quant-counterpart", { detail: { token_id: token.id, query: token.query, source: "INFINITY_PHI" } }));
  void creditAuthoritativeInfinitySearch(token);
  return activate(token);
}
export function resolvePhiSearchToken(query: string, requestedId = "") {
  const tokens = read(),
    key = clean(query, 500).toLowerCase();
  let token = requestedId
    ? tokens.find((value) => value.id === requestedId)
    : undefined;
  if (!token && !requestedId) {
    try {
      const active = JSON.parse(sessionStorage.getItem(ACTIVE) || "null");
      if (clean(active?.query, 500).toLowerCase() === key)
        token = tokens.find((value) => value.id === active.id);
    } catch {}
  }
  if (!token) token = beginPhiSearchToken(query);
  const repaired = { ...token, label: tokenLabel(token.query) };
  if (repaired.label !== token.label)
    write([repaired, ...tokens.filter((value) => value.id !== repaired.id)]);
  return activate(repaired);
}
export function appendPhiTokenItems(
  tokenId: string,
  query: string,
  items: any[],
) {
  if (!items.length) return resolvePhiSearchToken(query, tokenId);
  let tokens = read(),
    token = tokens.find((value) => value.id === tokenId);
  if (!token) {
    token = resolvePhiSearchToken(query, tokenId);
    tokens = read();
  }
  const expanded = items.flatMap((item) => {
      const kind = String(item?.mediaKind || "").toLowerCase(),
        files = Array.isArray(item?.files) ? item.files : [];
      if ((kind !== "audio" && kind !== "video") || files.length <= 1)
        return [item];
      return files.map((file: any, index: number) => ({
        ...item,
        id: `${clean(item?.id, 300)}-file-${index}`,
        storyKey: `${clean(item?.storyKey || item?.url || item?.id, 1200)}#file=${encodeURIComponent(clean(file?.name || file?.url, 500))}`,
        files: [file],
      }));
    }),
    seen = new Set<string>(),
    merged = [...expanded, ...(token.items || [])]
      .filter((item) => {
        const key = itemKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 240),
    next = {
      ...token,
      label: tokenLabel(token.query),
      updatedAt: new Date().toISOString(),
      items: merged,
    };
  write([next, ...tokens.filter((value) => value.id !== next.id)]);
  return activate(next);
}
export function replacePhiTokenKindItems(
  tokenId: string,
  query: string,
  kind: string,
  items: any[],
) {
  let tokens = read(),
    token = tokens.find((value) => value.id === tokenId);
  if (!token) {
    token = resolvePhiSearchToken(query, tokenId);
    tokens = read();
  }
  const other = (token.items || []).filter(
      (item) =>
        String(item?.mediaKind || "").toLowerCase() !== kind.toLowerCase(),
    ),
    seen = new Set<string>(),
    merged = [...items, ...other]
      .filter((item) => {
        const key = itemKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 240),
    next = {
      ...token,
      label: tokenLabel(token.query),
      updatedAt: new Date().toISOString(),
      items: merged,
    };
  write([next, ...tokens.filter((value) => value.id !== next.id)]);
  return activate(next);
}
export function phiTokenItems(tokenId: string) {
  return read().find((value) => value.id === tokenId)?.items || [];
}
