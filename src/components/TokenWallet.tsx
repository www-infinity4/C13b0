"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FilePlus2,
  History,
  Save,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { appPath } from "@/lib/base-path";
import { connectOrCreateWallet, formatWalletId, type WalletRecord } from "@/lib/wallet";
import { secureLoadDurable, secureSaveDurable } from "@/lib/secure-storage";

const LEDGER = "c13b0_infinity_token_ledger_v3";
const METADATA = "c13b0_infinity_token_amendments_v1";
const UNIFIED = "infinity_unified_wallet_v1";
const PHI_SEARCH_TOKENS = "infinityPhi:searchTokens:v1";
const OMNI_HISTORY = "omniPhi:history:v1";
const QUANTA_HISTORY = "quantaPhiBuildHistoryV1";
const STAR_SESSION = "starquest_session";
const STAR_USERS = "starquest_users";
const STAR_GUEST = "starquest_guest_profile_v1";
const OMNI_PENDING = "omniPhi:pendingInfinitySearches:v1";
const OMNI_LAST = "omniPhi:lastSearchToken:v1";

type TokenRecord = {
  id: string;
  tokenId?: string;
  title?: string;
  query?: string;
  description?: string;
  stage?: string;
  kind?: string;
  status?: string;
  walletId?: string;
  ownerWalletId?: string;
  researchId?: string;
  createdAt?: string;
  mintedAt?: string;
  units?: number;
  source?: string;
  sourceSystem?: string;
  websiteUrl?: string;
  sourceEventId?: string;
  quantSearchId?: string;
};

type Material = {
  id: string;
  title: string;
  url?: string;
  note?: string;
  addedAt: string;
};

type Revision = {
  id: string;
  action: "DETAILS_UPDATED" | "MATERIAL_ADDED";
  at: string;
  previous?: { title: string; description: string };
  next?: { title: string; description: string };
  materialId?: string;
};

type Amendment = {
  tokenId: string;
  title?: string;
  description?: string;
  materials: Material[];
  revisions: Revision[];
  updatedAt?: string;
};

type Amendments = Record<string, Amendment>;

function jsonRead<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
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
function dateString(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  const date = new Date(Number.isFinite(numeric) && numeric > 0 ? numeric : String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function readUnifiedTokens(): TokenRecord[] {
  const state = jsonRead<Record<string, any> | null>(UNIFIED, null);
  return Object.entries(state?.tokens || {}).map(([key, raw]) => {
    const value = raw && typeof raw === "object" ? raw as Record<string, any> : {};
    const id = String(value.tokenId || value.id || key);
    return {
      ...value,
      id,
      tokenId: id,
      title: String(value.title || value.query || "Infinity token"),
      kind: String(value.kind || value.token_type || value.type || "collectible"),
      ownerWalletId: value.ownerWalletId ? String(value.ownerWalletId) : undefined,
      mintedAt: value.mintedAt ? String(value.mintedAt) : undefined,
      source: String(value.source || "unified wallet"),
      sourceSystem: value.sourceSystem ? String(value.sourceSystem) : undefined,
    };
  });
}

function readEverySearchHistory(): TokenRecord[] {
  const out: TokenRecord[] = [];
  const add = (token: Partial<TokenRecord> & { id?: string }) => {
    const id = String(token.id || "").trim();
    if (!id) return;
    out.push({ ...token, id } as TokenRecord);
  };

  const phi = jsonRead<any[]>(PHI_SEARCH_TOKENS, []);
  if (Array.isArray(phi)) {
    phi.forEach((item) => {
      const query = String(item?.query || "").trim();
      const id = String(item?.id || "").trim();
      if (!query || !id) return;
      add({
        id, tokenId: id, query, title: query, kind: "research", stage: "history",
        source: "infinity-phi", sourceSystem: "INFINITY_PHI",
        createdAt: String(item?.createdAt || item?.updatedAt || ""),
        websiteUrl: `${appPath("studio/build")}?id=${encodeURIComponent(id)}&query=${encodeURIComponent(query)}&mode=preview`,
      });
    });
  }

  const omni = jsonRead<any[]>(OMNI_HISTORY, []);
  if (Array.isArray(omni)) {
    omni.forEach((item) => {
      const query = String(item?.query || "").trim();
      if (!query) return;
      const createdAt = String(item?.createdAt || "");
      const id = String(item?.tokenId || item?.id || `omni-history-${fingerprint(["omni", query, createdAt])}`);
      add({
        id, tokenId: id, query, title: query, kind: "omni-search", stage: "history",
        source: "omni-phi", sourceSystem: "OMNI_PHI", createdAt,
        websiteUrl: `${appPath("studio/build")}?id=${encodeURIComponent(id)}&query=${encodeURIComponent(query)}&mode=preview`,
      });
    });
  }

  const omniPending = jsonRead<any[]>(OMNI_PENDING, []);
  if (Array.isArray(omniPending)) {
    omniPending.forEach((item) => {
      const query = String(item?.query || "").trim();
      const id = String(item?.tokenId || item?.id || "").trim();
      if (!query || !id) return;
      add({
        id, tokenId: id, query, title: query, kind: "omni-search", stage: "history",
        source: "omni-phi", sourceSystem: "OMNI_PHI",
        createdAt: dateString(item?.createdAt),
      });
    });
  }
  const omniLast = jsonRead<any | null>(OMNI_LAST, null);
  if (omniLast) {
    const query = String(omniLast?.query || "").trim();
    const id = String(omniLast?.tokenId || omniLast?.id || "").trim();
    if (query && id) {
      add({
        id, tokenId: id, query, title: query, kind: "omni-search", stage: "history",
        source: "omni-phi", sourceSystem: "OMNI_PHI",
        createdAt: dateString(omniLast?.createdAt),
      });
    }
  }

  const quanta = jsonRead<any[]>(QUANTA_HISTORY, []);
  if (Array.isArray(quanta)) {
    quanta.forEach((item) => {
      const query = String(item?.query || "").trim();
      if (!query) return;
      const createdAt = String(item?.created_at || item?.createdAt || "");
      const id = String(item?.token_id || item?.tokenId || item?.id || `quant-history-${fingerprint(["quanta", query, createdAt])}`);
      add({
        id, tokenId: id, query, title: query, kind: "quant", stage: "history",
        source: "quanta-phi", sourceSystem: "QUANTAPHI", createdAt,
        websiteUrl: String(item?.website || "") || `${appPath("studio/build")}?id=${encodeURIComponent(id)}&query=${encodeURIComponent(query)}&mode=preview`,
      });
    });
  }

  const unified = jsonRead<Record<string, any> | null>(UNIFIED, null);
  const searches = Array.isArray(unified?.searches) ? unified!.searches : [];
  searches.forEach((item: any) => {
    const query = String(item?.query || "").trim();
    const id = String(item?.tokenId || item?.id || "").trim();
    if (!query || !id) return;
    const source = String(item?.source || "");
    const lower = source.toLowerCase();
    add({
      id, tokenId: id, query, title: query, stage: "history",
      kind: lower.includes("quanta") ? "quant" : lower.includes("omni") ? "omni-search" : "research",
      source: source || "unified wallet",
      sourceSystem: lower.includes("quanta") ? "QUANTAPHI" : lower.includes("omni") ? "OMNI_PHI" : lower.includes("infinity") ? "INFINITY_PHI" : undefined,
      createdAt: dateString(item?.createdAt),
    });
  });

  const session = jsonRead<{ key?: string } | null>(STAR_SESSION, null);
  const users = jsonRead<Record<string, any>>(STAR_USERS, {});
  const profiles = [
    session?.key && users[session.key] ? users[session.key] : null,
    jsonRead<Record<string, any>>(STAR_GUEST, {}),
  ].filter(Boolean) as Record<string, any>[];
  profiles.forEach((profile) => {
    const walletSearches = Array.isArray(profile.infinitySearches) ? profile.infinitySearches : [];
    walletSearches.forEach((item: any) => {
      const query = String(item?.query || "").trim();
      const id = String(item?.tokenId || item?.id || "").trim();
      if (!query || !id) return;
      const source = String(item?.source || "infinity-phi");
      add({
        id, tokenId: id, query, title: query, kind: source.includes("omni") ? "omni-search" : "research",
        stage: "history", source,
        sourceSystem: source.includes("omni") ? "OMNI_PHI" : "INFINITY_PHI",
        createdAt: dateString(item?.createdAt),
      });
    });
    const walletLedger = Array.isArray(profile.infinityLedger) ? profile.infinityLedger : [];
    walletLedger.forEach((item: any) => {
      const query = String(item?.query || "").trim();
      const id = String(item?.tokenId || item?.id || "").trim();
      if (!query || !id) return;
      const source = String(item?.source || "infinity-phi");
      const lower = source.toLowerCase();
      add({
        id, tokenId: id, query, title: query,
        kind: lower.includes("quanta") ? "quant" : lower.includes("omni") ? "omni-search" : "research",
        stage: "history", source,
        sourceSystem: lower.includes("quanta") ? "QUANTAPHI" : lower.includes("omni") ? "OMNI_PHI" : "INFINITY_PHI",
        createdAt: dateString(item?.createdAt),
      });
    });
  });

  return out;
}

function mergeTokens(actionTokens: TokenRecord[], unifiedTokens: TokenRecord[], historyTokens: TokenRecord[] = []) {
  const records = new Map<string, TokenRecord>();
  const provenance = new Map<string, string>();
  const mergeRecord = (current: TokenRecord | undefined, incoming: TokenRecord, id: string) => {
    const genericSource = (value?: string) => {
      const source = String(value || "").toLowerCase();
      return !source || source === "action ledger" || source === "unified wallet";
    };
    return {
      ...(current || {}),
      ...incoming,
      id,
      tokenId: incoming.tokenId || current?.tokenId,
      query: incoming.query || current?.query,
      title: incoming.title || current?.title,
      kind: incoming.kind || current?.kind,
      createdAt: incoming.createdAt || current?.createdAt,
      mintedAt: incoming.mintedAt || current?.mintedAt,
      websiteUrl: incoming.websiteUrl || current?.websiteUrl,
      sourceSystem: incoming.sourceSystem || current?.sourceSystem,
      source: !genericSource(incoming.source)
        ? incoming.source
        : current?.source || incoming.source || "unified wallet",
    } as TokenRecord;
  };
  actionTokens.forEach((token) => {
    const id = String(token.id || token.tokenId || "").trim();
    if (!id) return;
    records.set(id, mergeRecord(undefined, { ...token, source: token.source || "action ledger" }, id));
    const event = String(token.sourceEventId || token.quantSearchId || "").trim();
    if (event) provenance.set(event, id);
  });
  [...historyTokens, ...unifiedTokens].forEach((token) => {
    const id = String(token.id || token.tokenId || "").trim();
    if (!id) return;
    const event = String(token.sourceEventId || token.quantSearchId || "").trim();
    const canonicalId = event ? provenance.get(event) : "";
    if (canonicalId) {
      records.set(canonicalId, mergeRecord(records.get(canonicalId), token, canonicalId));
      return;
    }
    records.set(id, mergeRecord(records.get(id), token, id));
  });
  return [...records.values()].sort((a, b) =>
    String(b.createdAt || b.mintedAt || "").localeCompare(
      String(a.createdAt || a.mintedAt || ""),
    ),
  );
}

function canonicalTitle(token: TokenRecord) {
  return token.title || token.query || token.kind || "Infinity token";
}

function linkedWork(token: TokenRecord) {
  if (token.websiteUrl) return token.websiteUrl;
  return token.researchId || token.id.startsWith("phi-")
    ? `${appPath("phi")}?id=${encodeURIComponent(token.researchId || token.id)}`
    : `${appPath("studio/build")}?id=${encodeURIComponent(token.id)}&query=${encodeURIComponent(token.query || token.title || "")}&mode=preview`;
}
function websiteWork(token: TokenRecord) {
  return token.websiteUrl || `${appPath("studio/build")}?id=${encodeURIComponent(token.id)}&query=${encodeURIComponent(token.query || token.title || "")}&mode=preview`;
}
function sourceKind(token: TokenRecord) {
  const source = String(token.sourceSystem || token.source || "").toLowerCase();
  const kind = String(token.kind || "").toLowerCase();
  const id = String(token.id || "").toLowerCase();
  if (source.includes("quanta") || kind === "quant" || id.startsWith("quant-")) return "quanta";
  if (source.includes("omni") || kind.includes("omni") || id.startsWith("omni-")) return "omni";
  if (source.includes("infinity") || id.startsWith("phi-") || kind === "research") return "infinity";
  return "legacy";
}
function sourceLabel(token: TokenRecord) {
  const source = sourceKind(token);
  if (source === "quanta") return "QuantaPhi · Quant";
  if (source === "omni") return "Omni Phi";
  if (source === "infinity") return "Infinity Phi";
  return "Legacy token";
}

export default function TokenWallet() {
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [amendments, setAmendments] = useState<Amendments>({});
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialNote, setMaterialNote] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const activeWallet = connectOrCreateWallet();
    const [actionTokens, savedAmendments] = await Promise.all([
      secureLoadDurable<TokenRecord[]>(LEDGER, []),
      secureLoadDurable<Amendments>(METADATA, {}),
    ]);
    const all = mergeTokens(actionTokens, readUnifiedTokens(), readEverySearchHistory());
    setWallet(activeWallet);
    setTokens(all);
    setTokenCount((window as any).InfinityTokenCount?.reconcile?.(all.length)?.value ?? all.length);
    setAmendments(savedAmendments);
    const requested = new URLSearchParams(location.search).get("token") || "";
    const nextId = all.some((token) => token.id === requested)
      ? requested
      : selectedId && all.some((token) => token.id === selectedId)
        ? selectedId
        : all[0]?.id || "";
    if (nextId) openToken(nextId, all, savedAmendments, false);
  }

  useEffect(() => {
    void refresh();
    const sync = () => void refresh();
    window.addEventListener("storage", sync);
    window.addEventListener("infinity-history-updated", sync);
    window.addEventListener("infinity-wallet-updated", sync);
    window.addEventListener("infinity:token-count-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("infinity-history-updated", sync);
      window.removeEventListener("infinity-wallet-updated", sync);
      window.removeEventListener("infinity:token-count-updated", sync);
    };
    // The storage events keep later changes synchronized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openToken(
    id: string,
    records = tokens,
    saved = amendments,
    updateUrl = true,
  ) {
    const token = records.find((item) => item.id === id);
    if (!token) return;
    const amendment = saved[id];
    setSelectedId(id);
    setTitle(amendment?.title || canonicalTitle(token));
    setDescription(amendment?.description || token.description || "");
    setNotice("");
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set("token", id);
      history.replaceState(history.state, "", url.href);
    }
  }

  async function saveDetails() {
    const token = tokens.find((item) => item.id === selectedId);
    if (!token) return;
    const previous = amendments[selectedId];
    const now = new Date().toISOString();
    const next: Amendment = {
      tokenId: selectedId,
      title: title.trim() || canonicalTitle(token),
      description: description.trim(),
      materials: previous?.materials || [],
      revisions: [
        ...(previous?.revisions || []),
        {
          id: crypto.randomUUID(),
          action: "DETAILS_UPDATED",
          at: now,
          previous: {
            title: previous?.title || canonicalTitle(token),
            description: previous?.description || token.description || "",
          },
          next: {
            title: title.trim() || canonicalTitle(token),
            description: description.trim(),
          },
        },
      ],
      updatedAt: now,
    };
    const updated = { ...amendments, [selectedId]: next };
    await secureSaveDurable(METADATA, updated);
    setAmendments(updated);
    setNotice("Token amendment saved");
  }

  async function addMaterial() {
    if (!selectedId || !materialTitle.trim()) {
      setNotice("Give the added material a title first");
      return;
    }
    const cleanUrl = materialUrl.trim();
    if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
      setNotice("Use a complete http:// or https:// address");
      return;
    }
    const previous = amendments[selectedId] || {
      tokenId: selectedId,
      materials: [],
      revisions: [],
    };
    const now = new Date().toISOString();
    const material: Material = {
      id: crypto.randomUUID(),
      title: materialTitle.trim(),
      url: cleanUrl || undefined,
      note: materialNote.trim() || undefined,
      addedAt: now,
    };
    const next: Amendment = {
      ...previous,
      title: title.trim() || previous.title,
      description: description.trim() || previous.description,
      materials: [...previous.materials, material],
      revisions: [
        ...previous.revisions,
        {
          id: crypto.randomUUID(),
          action: "MATERIAL_ADDED",
          at: now,
          materialId: material.id,
        },
      ],
      updatedAt: now,
    };
    const updated = { ...amendments, [selectedId]: next };
    await secureSaveDurable(METADATA, updated);
    setAmendments(updated);
    setMaterialTitle("");
    setMaterialUrl("");
    setMaterialNote("");
    setNotice("Material added to token");
  }

  const selected = tokens.find((token) => token.id === selectedId) || null;
  const amendment = selected ? amendments[selected.id] : undefined;
  const visibleTokens = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return tokens;
    return tokens.filter((token) =>
      `${amendments[token.id]?.title || canonicalTitle(token)} ${token.id} ${token.stage || ""} ${token.kind || ""} ${token.source || ""} ${token.sourceSystem || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [amendments, filter, tokens]);
  const sourceCounts = useMemo(() => {
    let infinity=0,omni=0,quanta=0,legacy=0;
    tokens.forEach((token) => {
      const source = sourceKind(token);
      if (source === "quanta") quanta += 1;
      else if (source === "omni") omni += 1;
      else if (source === "infinity") infinity += 1;
      else legacy += 1;
    });
    const missing = Math.max(0, tokenCount - tokens.length);
    return { infinity, omni, quanta, legacy: legacy + missing, total: tokenCount };
  },[tokens,tokenCount]);

  return (
    <main id="token-wallet" className="min-h-screen bg-[#061a30] px-4 py-5 text-white sm:px-7">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <a href={appPath("phi")} className="flex items-center gap-2 text-white/65">
            <ArrowLeft size={19} /> Infinity Phi
          </a>
          <div className="text-right">
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#f0bd55]">Active wallet</p>
            <p className="font-mono text-xs text-white/55">{wallet ? formatWalletId(wallet.walletId) : "Loading"}</p>
          </div>
        </header>

        <section className="py-7">
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#168b4c]"><Wallet /></div>
            <div>
              <h1 className="font-serif text-4xl font-black tracking-tight">Token wallet</h1>
              <p className="mt-2 max-w-3xl leading-7 text-white/60">Every token remains tied to its original ID and source. Your changes are saved as amendments, so editing never erases the token’s history.</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/10 px-3 py-2">{sourceCounts.total} total</span><span className="rounded-full bg-white/10 px-3 py-2">{sourceCounts.infinity} Infinity</span><span className="rounded-full bg-white/10 px-3 py-2">{sourceCounts.omni} Omni</span><span className="rounded-full bg-white/10 px-3 py-2">{sourceCounts.quanta} Quants</span>{sourceCounts.legacy > 0 && <span className="rounded-full bg-white/10 px-3 py-2">{sourceCounts.legacy} legacy / metadata pending</span>}</div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
          <aside className="rounded-[1.6rem] border border-white/10 bg-white/[.06] p-4">
            <label className="flex items-center gap-2 rounded-xl bg-white/10 px-3">
              <Search size={17} className="text-white/45" />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={`Search ${tokens.length} recorded tokens`} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-white/35" />
            </label>
            <div className="mt-3 grid max-h-[65dvh] gap-2 overflow-y-auto">
              {visibleTokens.map((token) => (
                <button key={token.id} onClick={() => openToken(token.id)} className={`rounded-xl border p-4 text-left ${selectedId === token.id ? "border-[#f0bd55] bg-[#f0bd55]/10" : "border-white/10 bg-black/10"}`}>
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#8fc6ec]">{sourceLabel(token)}</span>
                  <b className="mt-1 block leading-5">{amendments[token.id]?.title || canonicalTitle(token)}</b>
                  <span className="mt-2 block truncate font-mono text-[11px] text-white/40">{token.id}</span>
                </button>
              ))}
              {!visibleTokens.length && <p className="rounded-xl bg-black/15 p-5 text-center text-sm text-white/45">No matching tokens.</p>}
            </div>
          </aside>

          <section className="rounded-[1.6rem] bg-[#f4f7fa] p-5 text-[#17324a] sm:p-7">
            {selected ? (
              <div className="space-y-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#168b4c]"><ShieldCheck size={16} /> Canonical token</p>
                    <p className="mt-2 break-all font-mono text-xs text-slate-500">{selected.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><a href={linkedWork(selected)} className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-bold"><ExternalLink size={16} /> Open linked work</a><a href={websiteWork(selected)} className="flex items-center gap-2 rounded-full bg-[#168b4c] px-4 py-2 text-sm font-black text-white"><ExternalLink size={16} /> Open auto website</a></div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Info label="Original title" value={canonicalTitle(selected)} />
                  <Info label="Source" value={sourceLabel(selected)} />
                  <Info label="Owner" value={selected.walletId || selected.ownerWalletId || wallet?.walletId || "Active wallet"} />
                  <Info label="Issued" value={selected.createdAt || selected.mintedAt ? new Date(selected.createdAt || selected.mintedAt!).toLocaleString() : "Recorded"} />
                </div>

                <section>
                  <h2 className="font-serif text-2xl font-black">Edit token details</h2>
                  <div className="mt-4 grid gap-4">
                    <Field label="Display title"><input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
                    <Field label="Description and working notes"><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
                    <button onClick={() => void saveDetails()} className="flex items-center justify-center gap-2 rounded-xl bg-[#174d7e] px-5 py-3 font-black text-white"><Save size={18} /> Save token amendment</button>
                  </div>
                </section>

                <section className="border-t border-slate-200 pt-7">
                  <h2 className="flex items-center gap-2 font-serif text-2xl font-black"><FilePlus2 /> Add to this token</h2>
                  <div className="mt-4 grid gap-4">
                    <Field label="Material title"><input value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="Document, image, source, design, or note" /></Field>
                    <Field label="Source URL (optional)"><input value={materialUrl} onChange={(event) => setMaterialUrl(event.target.value)} inputMode="url" placeholder="https://" /></Field>
                    <Field label="What this adds"><textarea value={materialNote} onChange={(event) => setMaterialNote(event.target.value)} /></Field>
                    <button onClick={() => void addMaterial()} className="flex items-center justify-center gap-2 rounded-xl bg-[#168b4c] px-5 py-3 font-black text-white"><FilePlus2 size={18} /> Add material</button>
                  </div>
                </section>

                {!!amendment?.materials.length && (
                  <section className="border-t border-slate-200 pt-7">
                    <h2 className="font-serif text-2xl font-black">Attached material</h2>
                    <div className="mt-4 grid gap-3">
                      {amendment.materials.map((material) => (
                        <article key={material.id} className="rounded-xl border border-slate-200 bg-white p-4">
                          <b>{material.title}</b>
                          {material.note && <p className="mt-2 text-sm leading-6 text-slate-600">{material.note}</p>}
                          {material.url && <a href={material.url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 break-all text-sm font-bold text-[#174d7e]"><ExternalLink size={15} />{material.url}</a>}
                          <small className="mt-3 block text-slate-400">Added {new Date(material.addedAt).toLocaleString()}</small>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {!!amendment?.revisions.length && (
                  <section className="border-t border-slate-200 pt-7">
                    <h2 className="flex items-center gap-2 font-serif text-2xl font-black"><History /> Revision history</h2>
                    <div className="mt-4 grid gap-2">
                      {[...amendment.revisions].reverse().map((revision) => (
                        <div key={revision.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 p-4 text-sm"><b>{revision.action === "DETAILS_UPDATED" ? "Details amended" : "Material attached"}</b><span className="text-slate-500">{new Date(revision.at).toLocaleString()}</span></div>
                      ))}
                    </div>
                  </section>
                )}
                {notice && <p className="flex items-center gap-2 rounded-xl bg-emerald-100 p-4 font-bold text-emerald-800"><Check size={18} />{notice}</p>}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center text-center text-slate-500"><div><Wallet className="mx-auto mb-3" /><b>No token selected</b><p className="mt-2 text-sm">Your research and build actions will appear here as itemized tokens.</p></div></div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-bold">{label}<span className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-300 [&>input]:bg-white [&>input]:px-4 [&>input]:py-3 [&>input]:text-base [&>input]:outline-none [&>textarea]:min-h-28 [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-slate-300 [&>textarea]:bg-white [&>textarea]:px-4 [&>textarea]:py-3 [&>textarea]:text-base [&>textarea]:outline-none">{children}</span></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><small className="font-black uppercase tracking-wider text-slate-400">{label}</small><p className="mt-1 break-all text-sm font-bold">{value}</p></div>;
}
