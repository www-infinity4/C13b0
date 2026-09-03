"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Download, Plus, ShieldCheck, Store, Wallet, X } from "lucide-react";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  durability: string;
};

type WalletRecord = { walletId: string; displayName: string };
type WalletApi = {
  createWallet(input: { displayName: string }): WalletRecord;
  snapshot(): { currentWalletId: string | null; wallets: Record<string, WalletRecord> };
};

declare global {
  interface Window {
    InfinityUnifiedWallet?: { UnifiedInfinityWallet: new () => WalletApi };
  }
}

const DRAFT_KEY = "c13b0_infinity_business_draft_v1";
const categories = ["Food and grocery", "Clothing", "Household", "Tools", "Electronics", "Books and learning", "Health and wellness", "Crafts", "Repair and services"];

function newProduct(id?: string): Product {
  return { id: id || crypto.randomUUID(), name: "", category: categories[0], price: "", durability: "" };
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
  const [agreed, setAgreed] = useState({ lawful: false, infinityOnly: false, noAdult: false, truthful: false });

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
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
      }
      else setTokenId(crypto.randomUUID());
      const incomingQuery = new URLSearchParams(window.location.search).get("query");
      if (incomingQuery && !draft?.research?.query) setSparkQuery(incomingQuery);
      if (window.InfinityUnifiedWallet) {
        const api = new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
        const state = api.snapshot();
        if (state.currentWalletId) setWallet(state.wallets[state.currentWalletId] || null);
      }
    } catch { /* A damaged local draft starts clean. */ }
  }, []);

  const complete = useMemo(() => Boolean(wallet && sparkQuery.trim() && report.trim() && sources.trim() && businessName.trim() && description.trim() && products.some(p => p.name.trim() && Number(p.price) > 0) && Object.values(agreed).every(Boolean)), [wallet, sparkQuery, report, sources, businessName, description, products, agreed]);

  function collectWallet() {
    if (!window.InfinityUnifiedWallet) return;
    const api = new window.InfinityUnifiedWallet.UnifiedInfinityWallet();
    const state = api.snapshot();
    const current = state.currentWalletId ? state.wallets[state.currentWalletId] : null;
    setWallet(current || api.createWallet({ displayName: `${businessName.trim() || "Business"} Infinity Wallet` }));
  }

  function payload() {
    return {
      schema: "infinity/business-page-draft/v1",
      businessName: businessName.trim(), description: description.trim(), walletId: wallet?.walletId || null,
      research: { query: sparkQuery.trim(), report: report.trim(), sources: sources.split("\n").map(s => s.trim()).filter(Boolean), evidenceStatus: "USER_REVIEW_REQUIRED" },
      websiteToken: { tokenId, kind: "INFINITY_WEBSITE_TOKEN_DRAFT", siteType, ownerWalletId: wallet?.walletId || null, tradeState: "NOT_ISSUED", provenance: "INFINITY_SPARK_DRAFT" },
      capabilityCard: { localStorage: ["read own draft", "write own draft"], downloads: ["export portable record"], wallet: ["read or create device-local Infinity wallet"], network: [], publishing: "VISIBLE_CONFIRMATION_REQUIRED", purchases: "VISIBLE_CONFIRMATION_REQUIRED" },
      permissionReceipt: { acceptedRules: Object.values(agreed).every(Boolean), recordedAt: new Date().toISOString(), externalActionTaken: false },
      acceptedPayment: ["INFINITY"], rejectedPayment: ["CASH", "BITCOIN", "CRYPTOCURRENCY"],
      products: products.filter(p => p.name.trim()).map(p => ({ ...p, priceInfinity: Number(p.price) })),
      productPolicy: { lawfulGeneralRetailOnly: true, adultContent: false, plannedObsolescenceReview: "gradual" },
      review: { localPolicyCheck: "READY", infinityReview: "PLANNED", chatgptReview: "PLANNED", watsonxReview: "PLANNED", humanApprovalRequired: true },
      updatedAt: new Date().toISOString(), agreed,
    };
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload()));
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

  function startResearchRecord() {
    if (!sparkQuery.trim()) return;
    setReport(`Research question\n${sparkQuery.trim()}\n\nSummary\n\nWhy it matters\n\nKey findings\n\nTools or services this could support\n\nLimits, uncertainty, and questions still open\n`);
  }

  return (
    <main className="min-h-screen bg-[#050711] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 grid gap-6 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-violet-950 via-[#09152a] to-emerald-950/60 p-6 shadow-2xl sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="text-sm font-black uppercase tracking-[.24em] text-cyan-300">Infinity Business Pages</p><h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-6xl">Build a useful business. Accept Infinity.</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">Start a lawful product or service page, collect your unified wallet, and prepare a transparent record for review. No cash, Bitcoin, cryptocurrency, pornography, or illegal goods.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm"><div className="text-white/50">Payment rail</div><div className="mt-1 text-xl font-black text-emerald-300">Infinity only</div></div>
        </header>

        <section className="mb-7 overflow-hidden rounded-[1.75rem] border border-amber-400/20 bg-gradient-to-r from-amber-400/[.08] via-violet-400/[.06] to-cyan-400/[.08] p-6 sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[.24em] text-amber-300">Infinity Spark</p>
              <h2 className="mt-2 text-3xl font-black">Search → research → website → asset</h2>
              <p className="mt-3 leading-7 text-white/65">Begin with a question. Preserve the report, its sources, and its uncertainty. Then turn that work into a useful site attached to the creator’s unified wallet.</p>
              <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs font-bold"><div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">🔎</div>Research</div><div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">📚</div>Report</div><div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">🌐</div>Website</div><div className="rounded-xl bg-black/25 p-3"><div className="text-2xl">💎</div>Asset</div></div>
              <p className="mt-4 text-xs leading-5 text-white/40">This page creates the local research and website-token record. Live web retrieval, source ranking, user accounts, user-to-user discovery, AI cross-review, verified issuance, trading, and deployment require connected services and visible approval.</p>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-2 font-semibold">What do you want to research or build?<div className="flex gap-2"><input value={sparkQuery} onChange={e=>setSparkQuery(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none focus:border-amber-400" placeholder="Ask a question or enter a topic"/><button onClick={startResearchRecord} disabled={!sparkQuery.trim()} className="rounded-xl bg-amber-400 px-4 py-3 font-black text-black disabled:opacity-40">Start report</button></div></label>
              <label className="grid gap-2 font-semibold">Research report<textarea value={report} onChange={e=>setReport(e.target.value)} className="min-h-52 rounded-xl border border-white/15 bg-black/30 px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-cyan-400" placeholder="The sourced report and its uncertainty belong here."/></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 font-semibold">Sources<textarea value={sources} onChange={e=>setSources(e.target.value)} className="min-h-28 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none" placeholder="One source URL or citation per line"/></label><label className="grid gap-2 font-semibold">Turn the report into<select value={siteType} onChange={e=>setSiteType(e.target.value)} className="rounded-xl border border-white/15 bg-[#090d1b] px-4 py-3"><option>Product page</option><option>Service page</option><option>Learning page</option><option>Research page</option><option>Tool or application</option></select><span className="rounded-xl border border-violet-400/20 bg-violet-400/[.08] p-3 text-xs font-normal leading-5 text-white/55">Website token: <strong className="break-all text-violet-200">{tokenId || "Preparing local identity…"}</strong><br/>Status: draft—not issued or tradeable yet.</span></label></div>
            </div>
          </div>
        </section>

        <div className="grid gap-7 lg:grid-cols-[1.25fr_.75fr]">
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6 sm:p-8">
              <div className="flex items-center gap-3"><Store className="text-cyan-300"/><h2 className="text-2xl font-black">1. Describe the business</h2></div>
              <div className="mt-6 grid gap-5"><label className="grid gap-2 font-semibold">Business name<input value={businessName} onChange={e=>setBusinessName(e.target.value)} className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan-400" placeholder="Example: Main Street Repair"/></label><label className="grid gap-2 font-semibold">What do you provide?<textarea value={description} onChange={e=>setDescription(e.target.value)} className="min-h-28 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base outline-none focus:border-cyan-400" placeholder="Explain the products, services, customers, and practical value."/></label></div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-wider text-violet-300">Product catalog</p><h2 className="mt-1 text-2xl font-black">2. Add products or services</h2></div><button onClick={()=>setProducts(p=>[...p,newProduct()])} className="flex items-center gap-2 rounded-xl bg-violet-500/20 px-4 py-3 font-bold text-violet-200 hover:bg-violet-500/30"><Plus size={18}/> Add</button></div>
              <div className="mt-6 space-y-4">{products.map((product,index)=><div key={product.id} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-4 flex items-center justify-between"><strong>Item {index+1}</strong>{products.length>1&&<button aria-label={`Remove item ${index+1}`} onClick={()=>setProducts(p=>p.filter(x=>x.id!==product.id))} className="rounded-lg p-2 text-white/50 hover:bg-red-500/15 hover:text-red-300"><X size={18}/></button>}</div><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Product name" value={product.name} onChange={e=>setProducts(p=>p.map(x=>x.id===product.id?{...x,name:e.target.value}:x))} className="rounded-xl border border-white/15 bg-black/35 px-4 py-3" placeholder="Product or service name"/><select aria-label="Product category" value={product.category} onChange={e=>setProducts(p=>p.map(x=>x.id===product.id?{...x,category:e.target.value}:x))} className="rounded-xl border border-white/15 bg-[#090d1b] px-4 py-3">{categories.map(c=><option key={c}>{c}</option>)}</select><label className="flex items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-4"><input aria-label="Price in Infinity" inputMode="decimal" value={product.price} onChange={e=>setProducts(p=>p.map(x=>x.id===product.id?{...x,price:e.target.value}:x))} className="w-full bg-transparent py-3 outline-none" placeholder="Price"/><span className="font-bold text-emerald-300">Infinity</span></label><input aria-label="Durability or repair information" value={product.durability} onChange={e=>setProducts(p=>p.map(x=>x.id===product.id?{...x,durability:e.target.value}:x))} className="rounded-xl border border-white/15 bg-black/35 px-4 py-3" placeholder="Durability, repair, or useful-life note"/></div></div>)}</div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border border-emerald-400/20 bg-emerald-400/[.06] p-6"><div className="flex items-center gap-3"><Wallet className="text-emerald-300"/><h2 className="text-2xl font-black">3. Unified wallet</h2></div><p className="mt-3 leading-7 text-white/65">The wallet stays on this device in this first version. Never enter a seed phrase, recovery phrase, private key, bank card, or outside payment account.</p>{wallet?<div className="mt-5 rounded-xl border border-emerald-400/25 bg-black/25 p-4"><div className="text-xs uppercase tracking-wider text-emerald-300">Connected</div><div className="mt-1 font-bold">{wallet.displayName}</div><div className="mt-2 break-all text-xs text-white/45">{wallet.walletId}</div></div>:<button onClick={collectWallet} className="mt-5 w-full rounded-xl bg-emerald-500 px-4 py-3 font-black text-black hover:bg-emerald-400">Collect or connect wallet</button>}</section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/[.045] p-6"><div className="flex items-center gap-3"><ShieldCheck className="text-amber-300"/><h2 className="text-2xl font-black">4. Store agreement</h2></div><div className="mt-5 space-y-3">{[
              ["lawful","I will list ordinary lawful products and services."], ["infinityOnly","This page accepts Infinity only—no cash, Bitcoin, or cryptocurrency."], ["noAdult","No pornography, sexual services, illegal goods, or dangerous prohibited listings."], ["truthful","Descriptions, prices, durability, and repair information will be truthful."]
            ].map(([key,label])=><label key={key} className="flex cursor-pointer gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6"><input type="checkbox" checked={agreed[key as keyof typeof agreed]} onChange={e=>setAgreed(v=>({...v,[key]:e.target.checked}))} className="mt-1 h-4 w-4 accent-cyan-400"/><span>{label}</span></label>)}</div></section>

            <section className="rounded-[1.75rem] border border-cyan-400/20 bg-cyan-400/[.05] p-6"><h2 className="text-xl font-black">Review record</h2><div className="mt-4 space-y-3 text-sm">{[["Local policy check","Ready","text-emerald-300"],["Infinity review","Planned","text-amber-300"],["ChatGPT review","Planned","text-amber-300"],["IBM watsonx review","Planned","text-amber-300"],["Human approval","Required","text-cyan-300"]].map(([name,status,color])=><div key={name} className="flex justify-between gap-3 border-b border-white/10 pb-2"><span className="text-white/65">{name}</span><strong className={color}>{status}</strong></div>)}</div><p className="mt-4 text-sm leading-6 text-white/50">Future AI services must disclose what information they receive. They advise and cross-check; publication and purchases still require visible human confirmation.</p></section>

            <div className="grid gap-3"><button onClick={saveDraft} disabled={!complete} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-4 font-black disabled:cursor-not-allowed disabled:opacity-40">{saved?<Check size={19}/>:<Store size={19}/>} {saved?"Draft saved on this device":"Save business-page draft"}</button><button onClick={exportDraft} disabled={!complete} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 font-bold text-white/75 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"><Download size={18}/> Export portable record</button><p className="text-center text-xs leading-5 text-white/40">Saving creates a draft, not a public store. Server review, verified balances, checkout settlement, and publication remain separate future steps.</p></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
