"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Check,
  Download,
  ExternalLink,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { secureLoad, secureSave } from "@/lib/secure-storage";
import {
  buildBusinessStyleProfile,
  type BusinessHistorySignal,
} from "@/lib/business-generation";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  durability: string;
};

type StorefrontProvider = "eBay" | "Etsy" | "Shopify" | "Custom storefront";
type StorefrontDraft = {
  provider: StorefrontProvider;
  url: string;
  mode: "link" | "catalog-import" | "publish-sync";
};

type TransferIntent = {
  id: string;
  idempotencyKey: string;
  senderWalletId: string;
  recipientWalletId: string;
  websiteTokenId: string;
  amount: number;
  memo: string;
  status: "pending-server";
  createdAt: string;
};

type WalletRecord = { walletId: string; displayName: string };
type WalletApi = {
  createWallet(input: { displayName: string }): WalletRecord;
  snapshot(): { currentWalletId: string | null; wallets: Record<string, WalletRecord> };
};

declare global {
  interface Window {
    InfinityUnifiedWallet?: { UnifiedInfinityWallet: new () => WalletApi };
    __infinitySparkHandoff?: string;
  }
}

const DRAFT_KEY = "c13b0_infinity_business_draft_v2";
const LEGACY_DRAFT_KEY = "c13b0_infinity_business_draft_v1";
const HANDOFF_KEY = "c13b0_infinity_spark_handoff_v3";
const PHI_HISTORY_KEY = "infinity_phi_context_v1";
const TRANSFER_KEY = "c13b0_infinity_transfer_intents_v1";

const categories = [
  "Food and grocery",
  "Clothing",
  "Household",
  "Tools",
  "Electronics",
  "Books and learning",
  "Health and wellness",
  "Crafts",
  "Repair and services",
];

const storefrontProviders: StorefrontProvider[] = ["eBay", "Etsy", "Shopify", "Custom storefront"];

function newProduct(id?: string): Product {
  return { id: id || crypto.randomUUID(), name: "", category: categories[0], price: "", durability: "" };
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export default function BusinessStarter() {
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [sparkQuery, setSparkQuery] = useState("");
  const [report, setReport] = useState("");
  const [sources, setSources] = useState("");
  const [siteType, setSiteType] = useState("Product page");
  const [tokenId, setTokenId] = useState("");
  const [products, setProducts] = useState<Product[]>([newProduct("product-1")]);
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<BusinessHistorySignal[]>([]);
  const [variationNonce, setVariationNonce] = useState(0);
  const [storefront, setStorefront] = useState<StorefrontDraft>({ provider: "eBay", url: "", mode: "link" });
  const [recipientWalletId, setRecipientWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferMemo, setTransferMemo] = useState("");
  const [transferNotice, setTransferNotice] = useState("");
  const [agreed, setAgreed] = useState({ lawful: false, infinityOnly: false, noAdult: false, truthful: false });

  useEffect(() => {
    try {
      const draft = secureLoad<any>(DRAFT_KEY, null) || secureLoad<any>(LEGACY_DRAFT_KEY, null);
      if (draft) {
        setSparkQuery(draft.research?.query || "");
        setReport(draft.research?.report || "");
        setSources((draft.research?.sources || []).join("\n"));
        setSiteType(draft.websiteToken?.siteType || "Product page");
        setTokenId(draft.websiteToken?.tokenId || crypto.randomUUID());
        setBusinessName(draft.businessName || "");
        setDescription(draft.description || "");
        setProducts(Array.isArray(draft.products) && draft.products.length ? draft.products : [newProduct()]);
        setAgreed(draft.agreed || { lawful: false, infinityOnly: false, noAdult: false, truthful: false });
        setVariationNonce(Number(draft.generationProfile?.variationNonce || 0));
        if (draft.storefront?.provider) {
          setStorefront({
            provider: storefrontProviders.includes(draft.storefront.provider) ? draft.storefront.provider : "Custom storefront",
            url: draft.storefront.url || "",
            mode: ["link", "catalog-import", "publish-sync"].includes(draft.storefront.mode) ? draft.storefront.mode : "link",
          });
        }
      } else {
        setTokenId(crypto.randomUUID());
      }

      const localHistory = secureLoad<BusinessHistorySignal[]>(PHI_HISTORY_KEY, []);
      if (Array.isArray(localHistory)) setHistory(localHistory.slice(-80));

      const incomingQuery = new URLSearchParams(window.location.search).get("query");
      if (incomingQuery && !draft?.research?.query) setSparkQuery(incomingQuery);

      let handoff = window.__infinitySparkHandoff ? JSON.parse(window.__infinitySparkHandoff) : null;
      if (!handoff) handoff = secureLoad(HANDOFF_KEY, null, "session") ?? secureLoad(HANDOFF_KEY, null, "local");
      if (handoff && !draft?.research?.query) {
        setSparkQuery(handoff.token?.query || handoff.query || incomingQuery || "");
        setReport(typeof handoff.paper === "object" ? handoff.paper.overview || "" : handoff.report || "");
        setSources(
          Array.isArray(handoff.paper?.sources)
            ? handoff.paper.sources.map((source: { url?: string }) => source.url).filter(Boolean).join("\n")
            : Array.isArray(handoff.sources)
              ? handoff.sources.join("\n")
              : ""
        );
        setSiteType(handoff.token?.stage === "webpage" ? "Research page" : handoff.siteType || "Product page");
        setDescription(handoff.paper?.dek || handoff.overview || "");
        if (handoff.token?.id || handoff.token?.tokenId) setTokenId(handoff.token.id || handoff.token.tokenId);
      }

      if (window.InfinityUnifiedWallet) {
        const api = new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
        const state = api.snapshot();
        if (state.currentWalletId) setWallet(state.wallets[state.currentWalletId] || null);
      }
    } catch {
      if (!tokenId) setTokenId(crypto.randomUUID());
    }
  }, []);

  const generationProfile = useMemo(
    () => buildBusinessStyleProfile({
      businessName,
      siteType,
      researchQuery: sparkQuery,
      tokenId: tokenId || "pre-token",
      walletId: wallet?.walletId || null,
      history,
      variationNonce,
    }),
    [businessName, siteType, sparkQuery, tokenId, wallet?.walletId, history, variationNonce]
  );

  const storefrontUrl = safeExternalUrl(storefront.url);
  const complete = useMemo(
    () => Boolean(
      wallet &&
      sparkQuery.trim() &&
      report.trim() &&
      sources.trim() &&
      businessName.trim() &&
      description.trim() &&
      products.some(p => p.name.trim() && Number(p.price) > 0) &&
      Object.values(agreed).every(Boolean)
    ),
    [wallet, sparkQuery, report, sources, businessName, description, products, agreed]
  );

  function collectWallet() {
    if (!window.InfinityUnifiedWallet) return;
    const api = new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
    const state = api.snapshot();
    const current = state.currentWalletId ? state.wallets[state.currentWalletId] : null;
    setWallet(current || api.createWallet({ displayName: `${businessName.trim() || "Business"} Infinity Wallet` }));
  }

  function payload() {
    return {
      schema: "infinity/business-page-draft/v2",
      businessName: businessName.trim(),
      description: description.trim(),
      walletId: wallet?.walletId || null,
      research: {
        query: sparkQuery.trim(),
        report: report.trim(),
        sources: sources.split("\n").map(s => s.trim()).filter(Boolean),
        evidenceStatus: "USER_REVIEW_REQUIRED",
      },
      websiteToken: {
        tokenId,
        kind: "INFINITY_WEBSITE_TOKEN_DRAFT",
        siteType,
        ownerWalletId: wallet?.walletId || null,
        tradeState: "NOT_ISSUED",
        provenance: "INFINITY_SPARK_DRAFT",
      },
      generationProfile: {
        engine: "history-driven-structured-script-v1",
        ...generationProfile,
        sourceHistoryCount: history.length,
        variationRule: "history + subject + token identity + explicit variation nonce",
      },
      storefront: {
        provider: storefront.provider,
        url: storefrontUrl || null,
        mode: storefront.mode,
        authState: "not-connected",
        syncState: "idle",
        rule: "Public links may be used immediately; catalog import or publishing requires provider authorization.",
      },
      capabilityCard: {
        localStorage: ["read own draft", "write own draft", "queue transfer intent"],
        downloads: ["export portable record"],
        wallet: ["read or create device-local Infinity wallet", "prepare recipient transfer intent"],
        network: ["Cloudflare action-engine schema prepared", "canonical ledger settlement required"],
        storefront: ["public store link", "connector manifest", "authorized import/publish reserved for connected provider"],
        publishing: "VISIBLE_CONFIRMATION_REQUIRED",
        purchases: "VISIBLE_CONFIRMATION_REQUIRED",
      },
      permissionReceipt: {
        acceptedRules: Object.values(agreed).every(Boolean),
        recordedAt: new Date().toISOString(),
        externalActionTaken: false,
      },
      acceptedPayment: ["INFINITY"],
      rejectedPayment: ["CASH", "BITCOIN", "CRYPTOCURRENCY"],
      products: products.filter(p => p.name.trim()).map(p => ({ ...p, priceInfinity: Number(p.price) })),
      productPolicy: { lawfulGeneralRetailOnly: true, adultContent: false, plannedObsolescenceReview: "gradual" },
      review: {
        localPolicyCheck: "READY",
        infinityReview: "PLANNED",
        chatgptReview: "PLANNED",
        watsonxReview: "PLANNED",
        humanApprovalRequired: true,
      },
      updatedAt: new Date().toISOString(),
      agreed,
    };
  }

  function saveDraft() {
    const value = payload();
    secureSave(DRAFT_KEY, value, "session");
    secureSave(DRAFT_KEY, value);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function exportDraft() {
    const blob = new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${businessName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "infinity-business"}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function prepareTransfer() {
    setTransferNotice("");
    if (!wallet) {
      setTransferNotice("Connect the sender wallet first.");
      return;
    }
    const recipient = recipientWalletId.trim();
    const amount = Number(transferAmount);
    if (!recipient || recipient === wallet.walletId) {
      setTransferNotice("Enter a different recipient wallet ID.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setTransferNotice("Transfer amount must be a positive whole Infinity amount.");
      return;
    }

    const createdAt = new Date().toISOString();
    const intent: TransferIntent = {
      id: crypto.randomUUID(),
      idempotencyKey: `${wallet.walletId}:${recipient}:${tokenId}:${amount}:${Date.now()}`,
      senderWalletId: wallet.walletId,
      recipientWalletId: recipient,
      websiteTokenId: tokenId,
      amount,
      memo: transferMemo.trim(),
      status: "pending-server",
      createdAt,
    };
    const existing = secureLoad<TransferIntent[]>(TRANSFER_KEY, []);
    secureSave(TRANSFER_KEY, [intent, ...existing].slice(0, 100), "session");
    secureSave(TRANSFER_KEY, [intent, ...existing].slice(0, 100));
    setTransferNotice(`Transfer intent ${intent.id.slice(0, 8)} prepared. It is not settled until the Cloudflare ledger verifies balance and returns a receipt.`);
    setTransferAmount("");
    setTransferMemo("");
  }

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 grid gap-6 rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-[#10263f] via-[#101b31] to-[#241331] p-6 shadow-2xl sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[.24em] text-cyan-300">Infinity Business Pages</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">Research becomes a different business site every time.</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">The builder uses the current subject, recent Infinity Phi history, website-token identity, and a variation seed to choose the page structure. Storefront links, wallet ownership, and transfer intents travel with the business record.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
            <div className="text-white/50">Current design genome</div>
            <div className="mt-1 text-xl font-black text-cyan-200">{generationProfile.name}</div>
            <div className="mt-1 max-w-64 break-all text-xs text-white/40">{generationProfile.fingerprint}</div>
          </div>
        </header>

        <section className="mb-7 overflow-hidden rounded-[1.75rem] border border-amber-300/20 bg-amber-300/[.045] p-6 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[.24em] text-amber-300">Infinity Spark</p>
              <h2 className="mt-2 text-3xl font-black">Search → research → website → asset</h2>
              <p className="mt-3 leading-7 text-white/65">The research package stays attached to the site, but the presentation does not collapse into one template. Recent history influences which information gets emphasized and how the sections are ordered.</p>
              <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs font-bold">
                <div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">🔎</div>Research</div>
                <div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">🧬</div>Genome</div>
                <div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">🌐</div>Website</div>
                <div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">💎</div>Asset</div>
              </div>
            </div>
            <div className="grid content-start gap-4">
              {report ? (
                <>
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[.06] p-5">
                    <div className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Research imported automatically</div>
                    <h3 className="mt-2 text-2xl font-black">{sparkQuery}</h3>
                    <p className="mt-3 text-sm text-white/55">{sources.split("\n").filter(Boolean).length} sources preserved · {history.length} history signals available</p>
                  </div>
                  <label className="grid gap-2 font-semibold">Website format
                    <select value={siteType} onChange={e => setSiteType(e.target.value)} className="rounded-xl border border-white/15 bg-[#07100c] px-4 py-3">
                      <option>Product page</option><option>Service page</option><option>Learning page</option><option>Research page</option><option>Tool or application</option>
                    </select>
                  </label>
                  <span className="rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] p-4 text-xs leading-5 text-white/55">Website token: <strong className="break-all text-emerald-200">{tokenId || "Preparing local identity…"}</strong><br/>Status: draft—not issued or tradeable yet.</span>
                </>
              ) : (
                <div className="rounded-2xl border border-emerald-300/25 bg-black/25 p-6">
                  <h3 className="text-2xl font-black">Start with real research</h3>
                  <p className="mt-2 leading-7 text-white/55">Spark retrieves sources and carries the report into this builder.</p>
                  <Link href="/spark" className="mt-5 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-black text-[#00150b] hover:bg-white">Open Infinity Spark</Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-7 rounded-[1.75rem] border border-violet-400/20 bg-violet-400/[.055] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">History-driven structured script</p>
              <h2 className="mt-2 text-3xl font-black">{generationProfile.name}</h2>
              <p className="mt-3 leading-7 text-white/65">{generationProfile.layout}. {generationProfile.rhythm}. Voice: {generationProfile.voice}.</p>
            </div>
            <button onClick={() => setVariationNonce(value => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 font-black text-violet-100 hover:bg-violet-300/20"><RefreshCw size={17}/> New variation</button>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {generationProfile.sectionPlan.map((section, index) => <div key={section} className="rounded-2xl border border-white/10 bg-black/25 p-4"><span className="text-xs font-black text-violet-300">{String(index + 1).padStart(2, "0")}</span><p className="mt-2 font-bold">{section}</p></div>)}
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/55">
            <b className="text-white/80">History terms influencing this run:</b> {generationProfile.historyTerms.length ? generationProfile.historyTerms.join(" · ") : "No prior Phi terms yet; the research subject and token identity drive this variation."}
          </div>
        </section>

        <div className="grid gap-7 lg:grid-cols-[1.25fr_.75fr]">
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6 sm:p-8">
              <div className="flex items-center gap-3"><Store className="text-cyan-300"/><h2 className="text-2xl font-black">1. Describe the business</h2></div>
              <div className="mt-6 grid gap-5">
                <label className="grid gap-2 font-semibold">Business name<input value={businessName} onChange={e => setBusinessName(e.target.value)} className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan-400" placeholder="Example: Main Street Repair"/></label>
                <label className="grid gap-2 font-semibold">What do you provide?<textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-28 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan-400" placeholder="Explain the products, services, customers, and practical value."/></label>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-wider text-amber-300">Product catalog</p><h2 className="mt-1 text-2xl font-black">2. Add products or services</h2></div><button onClick={() => setProducts(p => [...p, newProduct()])} className="flex items-center gap-2 rounded-xl bg-emerald-300/15 px-4 py-3 font-bold text-emerald-200 hover:bg-emerald-300/25"><Plus size={18}/> Add</button></div>
              <div className="mt-6 space-y-4">{products.map((product, index) => <div key={product.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="mb-4 flex items-center justify-between"><strong>Item {index + 1}</strong>{products.length > 1 && <button aria-label={`Remove item ${index + 1}`} onClick={() => setProducts(p => p.filter(x => x.id !== product.id))} className="rounded-lg p-2 text-white/50 hover:bg-red-500/15 hover:text-red-300"><X size={18}/></button>}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input aria-label="Product name" value={product.name} onChange={e => setProducts(p => p.map(x => x.id === product.id ? { ...x, name: e.target.value } : x))} className="rounded-xl border border-white/15 bg-black/35 px-4 py-3" placeholder="Product or service name"/>
                  <select aria-label="Product category" value={product.category} onChange={e => setProducts(p => p.map(x => x.id === product.id ? { ...x, category: e.target.value } : x))} className="rounded-xl border border-white/15 bg-[#090d1b] px-4 py-3">{categories.map(c => <option key={c}>{c}</option>)}</select>
                  <label className="flex items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-4"><input aria-label="Price in Infinity" inputMode="decimal" value={product.price} onChange={e => setProducts(p => p.map(x => x.id === product.id ? { ...x, price: e.target.value } : x))} className="w-full bg-transparent py-3 outline-none" placeholder="Price"/><span className="font-bold text-emerald-300">Infinity</span></label>
                  <input aria-label="Durability or repair information" value={product.durability} onChange={e => setProducts(p => p.map(x => x.id === product.id ? { ...x, durability: e.target.value } : x))} className="rounded-xl border border-white/15 bg-black/35 px-4 py-3" placeholder="Durability, repair, or useful-life note"/>
                </div>
              </div>)}</div>
            </div>

            <div className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/[.045] p-6 sm:p-8">
              <div className="flex items-center gap-3"><Link2 className="text-cyan-300"/><h2 className="text-2xl font-black">3. Existing storefront connector</h2></div>
              <p className="mt-3 max-w-3xl leading-7 text-white/60">An Infinity business page can act as the front door to an existing store immediately by linking it. Catalog import and publishing are represented in the record, but they remain blocked until that provider is connected and authorized.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <select value={storefront.provider} onChange={e => setStorefront(value => ({ ...value, provider: e.target.value as StorefrontProvider }))} className="rounded-xl border border-white/15 bg-[#090d1b] px-4 py-3">{storefrontProviders.map(provider => <option key={provider}>{provider}</option>)}</select>
                <input value={storefront.url} onChange={e => setStorefront(value => ({ ...value, url: e.target.value }))} className="rounded-xl border border-white/15 bg-black/35 px-4 py-3 md:col-span-2" placeholder="https://www.ebay.com/usr/your-store or another public storefront URL"/>
                <select value={storefront.mode} onChange={e => setStorefront(value => ({ ...value, mode: e.target.value as StorefrontDraft["mode"] }))} className="rounded-xl border border-white/15 bg-[#090d1b] px-4 py-3"><option value="link">Link storefront</option><option value="catalog-import">Catalog import</option><option value="publish-sync">Publish sync</option></select>
                <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white/55 md:col-span-2">Connector state: <b className="text-amber-200">not connected</b> · {storefront.mode === "link" ? "public link can be used without account access" : "provider authorization is required before this mode can run"}</div>
              </div>
              {storefrontUrl && <a href={storefrontUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white">Open linked storefront <ExternalLink size={15}/></a>}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/[.06] p-6">
              <div className="flex items-center gap-3"><Wallet className="text-emerald-300"/><h2 className="text-2xl font-black">4. Unified wallet</h2></div>
              <p className="mt-3 leading-7 text-white/65">The browser can collect or identify the current Infinity wallet. Server-side transfers still require a canonical ledger receipt.</p>
              {wallet ? <div className="mt-5 rounded-xl border border-emerald-400/25 bg-black/25 p-4"><div className="text-xs uppercase tracking-wider text-emerald-300">Connected</div><div className="mt-1 font-bold">{wallet.displayName}</div><div className="mt-2 break-all text-xs text-white/45">{wallet.walletId}</div></div> : <button onClick={collectWallet} className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-black text-black hover:bg-emerald-400">Collect or connect wallet</button>}
            </section>

            <section className="rounded-[1.75rem] border border-fuchsia-400/20 bg-fuchsia-400/[.05] p-6">
              <div className="flex items-center gap-3"><ArrowRightLeft className="text-fuchsia-300"/><h2 className="text-2xl font-black">5. Transfer to another user</h2></div>
              <p className="mt-3 text-sm leading-6 text-white/60">This prepares a signed-by-context transfer intent for the Cloudflare action engine. The browser does not mark money settled by itself.</p>
              <div className="mt-4 grid gap-3">
                <input value={recipientWalletId} onChange={e => setRecipientWalletId(e.target.value)} className="rounded-xl border border-white/15 bg-black/30 px-4 py-3" placeholder="Recipient Infinity wallet ID"/>
                <input value={transferAmount} onChange={e => setTransferAmount(e.target.value)} inputMode="numeric" className="rounded-xl border border-white/15 bg-black/30 px-4 py-3" placeholder="Whole Infinity amount"/>
                <input value={transferMemo} onChange={e => setTransferMemo(e.target.value)} className="rounded-xl border border-white/15 bg-black/30 px-4 py-3" placeholder="Memo or reason"/>
                <button onClick={prepareTransfer} className="rounded-xl bg-fuchsia-300 px-4 py-3 font-black text-[#22001d] hover:bg-white">Prepare transfer intent</button>
                {transferNotice && <p className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-white/65">{transferNotice}</p>}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6">
              <div className="flex items-center gap-3"><ShieldCheck className="text-amber-300"/><h2 className="text-2xl font-black">6. Store agreement</h2></div>
              <div className="mt-5 space-y-3">{[
                ["lawful", "I will list ordinary lawful products and services."],
                ["infinityOnly", "This page accepts Infinity only—no cash, Bitcoin, or cryptocurrency."],
                ["noAdult", "No pornography, sexual services, illegal goods, or dangerous prohibited listings."],
                ["truthful", "Descriptions, prices, durability, and repair information will be truthful."],
              ].map(([key, label]) => <label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6"><input type="checkbox" checked={agreed[key as keyof typeof agreed]} onChange={e => setAgreed(v => ({ ...v, [key]: e.target.checked }))} className="mt-1 h-4 w-4 accent-cyan-400"/><span>{label}</span></label>)}</div>
            </section>

            <section className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/[.05] p-6">
              <h2 className="text-xl font-black">Network readiness</h2>
              <div className="mt-4 space-y-3 text-sm">{[
                ["History style engine", "Ready", "text-emerald-300"],
                ["Storefront link", storefrontUrl ? "Ready" : "Optional", storefrontUrl ? "text-emerald-300" : "text-white/50"],
                ["Catalog authentication", "Connector required", "text-amber-300"],
                ["Transfer D1 schema", "Prepared", "text-cyan-300"],
                ["Ledger settlement", "Server verification required", "text-amber-300"],
              ].map(([name, status, color]) => <div key={name} className="flex justify-between gap-3 border-b border-white/10 pb-2"><span className="text-white/65">{name}</span><strong className={`text-right ${color}`}>{status}</strong></div>)}</div>
            </section>

            <div className="grid gap-3">
              <button onClick={saveDraft} disabled={!complete} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-4 font-black text-[#00150b] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">{saved ? <Check size={19}/> : <Store size={19}/>} {saved ? "Business genome saved" : "Save business-page draft"}</button>
              <button onClick={exportDraft} disabled={!complete} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 font-bold text-white/75 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"><Download size={18}/> Export complete business record</button>
              <p className="text-center text-xs leading-5 text-white/40">Saving records the research, style genome, storefront connector and wallet ownership locally. Network publication, authenticated catalog actions and settled transfers require the Cloudflare/ledger services.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
