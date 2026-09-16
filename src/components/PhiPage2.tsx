"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search, Share2, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureSave } from "@/lib/secure-storage";

type HistoryItem = { query: string; resolved: string; kind: string; at: number };
type Source = {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
  score?: number;
};
type ResultRecord = {
  query: string;
  resolved: string;
  title: string;
  overview: string;
  sources: Source[];
  created: number;
};
type ShareResult = { copied?: boolean; cancelled?: boolean; awarded?: number; progressToNextCoin?: number };

const HISTORY = "infinity_phi_context_v1";
const OMNI_RESEARCH = "omniPhi:lastResearch:v1";
const FALLBACK_IMAGE = "https://www-infinity4.github.io/C13b0/og-image.png";
const STOP = new Set(["about", "after", "again", "against", "because", "before", "being", "between", "could", "every", "first", "from", "have", "into", "itself", "more", "other", "over", "same", "such", "than", "that", "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with", "would", "your", "also", "only", "some", "most", "many", "search"]);
const ELEMENTS: Record<string, { symbol: string; number: number }> = {
  hydrogen: { symbol: "H", number: 1 }, helium: { symbol: "He", number: 2 }, boron: { symbol: "B", number: 5 },
  carbon: { symbol: "C", number: 6 }, nitrogen: { symbol: "N", number: 7 }, oxygen: { symbol: "O", number: 8 },
  fluorine: { symbol: "F", number: 9 }, aluminum: { symbol: "Al", number: 13 }, potassium: { symbol: "K", number: 19 },
  manganese: { symbol: "Mn", number: 25 }, iron: { symbol: "Fe", number: 26 }, copper: { symbol: "Cu", number: 29 },
  arsenic: { symbol: "As", number: 33 }, selenium: { symbol: "Se", number: 34 }, yttrium: { symbol: "Y", number: 39 },
  niobium: { symbol: "Nb", number: 41 }, technetium: { symbol: "Tc", number: 43 }, antimony: { symbol: "Sb", number: 51 },
  iodine: { symbol: "I", number: 53 }, dysprosium: { symbol: "Dy", number: 66 }, ytterbium: { symbol: "Yb", number: 70 },
  hafnium: { symbol: "Hf", number: 72 }, tantalum: { symbol: "Ta", number: 73 }, tungsten: { symbol: "W", number: 74 },
  rhenium: { symbol: "Re", number: 75 }, platinum: { symbol: "Pt", number: 78 }, gold: { symbol: "Au", number: 79 },
  mercury: { symbol: "Hg", number: 80 }, lead: { symbol: "Pb", number: 82 }, bismuth: { symbol: "Bi", number: 83 },
  uranium: { symbol: "U", number: 92 }, bohrium: { symbol: "Bh", number: 107 },
};

const clean = (value: unknown, max = 3200) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const domainOf = (value: string) => {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; }
};
const sentence = (value: string) => clean(value).split(/(?<=[.!?])\s+/).find((item) => item.length > 35) || clean(value, 420);
const tokens = (value: string) => [...new Set((clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !STOP.has(word)))];

async function withTimeout<T>(promise: Promise<T>, ms = 5200): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = window.setTimeout(() => reject(new Error("timeout")), ms); }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

function resolvedQuery(query: string) {
  const exact = ELEMENTS[clean(query).toLowerCase()];
  if (!exact) return query;
  const name = clean(query).replace(/(^|\s)\S/g, (match) => match.toUpperCase());
  return `${name} chemical element ${exact.symbol} atomic number ${exact.number}`;
}

function normalizeSource(raw: Partial<Source> & { title?: string; excerpt?: string }, provider: string): Source | null {
  const title = clean(raw.title, 240);
  const excerpt = clean(raw.excerpt, 2800);
  if (!title || !excerpt) return null;
  const url = clean(raw.url, 1400);
  const domain = clean(raw.domain, 180) || domainOf(url) || provider;
  return {
    id: clean(raw.id, 240) || `${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.abs(hash(`${url}|${title}`))}`,
    title,
    url,
    domain,
    excerpt,
    provider: clean(raw.provider, 100) || provider,
    imageUrl: clean(raw.imageUrl, 1600) || undefined,
  };
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = ((result << 5) - result + value.charCodeAt(index)) | 0;
  return result;
}

async function fetchWikipedia(query: string): Promise<Source[]> {
  const endpoint = new URL("https://en.wikipedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: query, gsrlimit: "12",
    prop: "extracts|pageimages|info", exintro: "1", explaintext: "1", exlimit: "max",
    piprop: "thumbnail", pithumbsize: "900", inprop: "url", format: "json", origin: "*",
  }).toString();
  const response = await withTimeout(fetch(endpoint, { cache: "no-store" }), 4800);
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  const data = await response.json();
  return Object.values((data as any)?.query?.pages || {}).flatMap((page: any) => {
    const source = normalizeSource({
      id: `wikipedia-${page.pageid}`,
      title: page.title,
      url: page.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`,
      domain: "wikipedia.org",
      excerpt: page.extract,
      imageUrl: page.thumbnail?.source,
    }, "Wikipedia");
    return source ? [source] : [];
  });
}

function openAlexAbstract(inverted: unknown) {
  if (!inverted || typeof inverted !== "object") return "";
  const words: string[] = [];
  Object.entries(inverted as Record<string, unknown>).forEach(([word, positions]) => {
    (Array.isArray(positions) ? positions : []).forEach((position) => {
      if (Number.isFinite(position) && Number(position) < 420) words[Number(position)] = word;
    });
  });
  return clean(words.filter(Boolean).join(" "), 2600);
}

async function fetchOpenAlex(query: string): Promise<Source[]> {
  const endpoint = new URL("https://api.openalex.org/works");
  endpoint.search = new URLSearchParams({ search: query, "per-page": "12" }).toString();
  const response = await withTimeout(fetch(endpoint, { cache: "no-store" }), 4800);
  if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
  const data = await response.json();
  return ((data as any)?.results || []).flatMap((work: any) => {
    const title = clean(work.display_name || work.title, 240);
    const abstract = openAlexAbstract(work.abstract_inverted_index);
    const host = clean(work.primary_location?.source?.display_name || work.best_oa_location?.source?.display_name || work.type_crossref || "scholarly source", 180);
    const year = work.publication_year ? ` Published ${work.publication_year}.` : "";
    const source = normalizeSource({
      id: clean(work.id, 240),
      title,
      url: work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || work.doi || work.id || "",
      excerpt: abstract || `${title}.${year} Scholarly work indexed by OpenAlex from ${host}.`,
      domain: host,
    }, "OpenAlex");
    return source ? [source] : [];
  });
}

async function fetchCrossref(query: string): Promise<Source[]> {
  const endpoint = new URL("https://api.crossref.org/works");
  endpoint.search = new URLSearchParams({ query, rows: "12" }).toString();
  const response = await withTimeout(fetch(endpoint, { cache: "no-store" }), 4800);
  if (!response.ok) throw new Error(`Crossref ${response.status}`);
  const data = await response.json();
  return ((data as any)?.message?.items || []).flatMap((item: any) => {
    const title = clean(item.title?.[0], 240);
    const source = normalizeSource({
      title,
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
      excerpt: clean(item.abstract, 2800) || `${title}. Scholarly work indexed by Crossref${item.publisher ? ` from ${clean(item.publisher, 180)}` : ""}.`,
      domain: clean(item.publisher, 180),
    }, "Crossref");
    return source ? [source] : [];
  });
}

async function fetchNasa(query: string): Promise<Source[]> {
  const endpoint = new URL("https://images-api.nasa.gov/search");
  endpoint.search = new URLSearchParams({ q: query, media_type: "image", page_size: "12" }).toString();
  const response = await withTimeout(fetch(endpoint, { cache: "no-store" }), 4800);
  if (!response.ok) throw new Error(`NASA ${response.status}`);
  const data = await response.json();
  return ((data as any)?.collection?.items || []).flatMap((item: any) => {
    const meta = item.data?.[0] || {};
    const nasaId = clean(meta.nasa_id, 180);
    const source = normalizeSource({
      id: nasaId,
      title: meta.title,
      url: nasaId ? `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}` : clean(item.href, 1200),
      domain: "nasa.gov",
      excerpt: clean(meta.description || meta.description_508, 2800),
      imageUrl: clean((item.links || []).find((link: any) => link.render === "image")?.href || item.links?.[0]?.href, 1600),
    }, "NASA");
    return source ? [source] : [];
  });
}

async function fetchInternetArchive(query: string): Promise<Source[]> {
  const endpoint = new URL("https://archive.org/advancedsearch.php");
  endpoint.search = new URLSearchParams({
    q: query, "fl[]": "identifier,title,description,creator,date", rows: "12", page: "1", output: "json",
  }).toString();
  const response = await withTimeout(fetch(endpoint, { cache: "no-store" }), 4800);
  if (!response.ok) throw new Error(`Internet Archive ${response.status}`);
  const data = await response.json();
  return ((data as any)?.response?.docs || []).flatMap((doc: any) => {
    const identifier = clean(doc.identifier, 260);
    const title = clean(Array.isArray(doc.title) ? doc.title[0] : doc.title, 240);
    const description = clean(Array.isArray(doc.description) ? doc.description[0] : doc.description, 2600);
    const creator = clean(Array.isArray(doc.creator) ? doc.creator.join(", ") : doc.creator, 260);
    const date = clean(doc.date, 80);
    const source = normalizeSource({
      id: identifier,
      title,
      url: identifier ? `https://archive.org/details/${encodeURIComponent(identifier)}` : "",
      domain: "archive.org",
      excerpt: description || `${title}.${creator ? ` Created by ${creator}.` : ""}${date ? ` Date: ${date}.` : ""} Historical or archival record indexed by Internet Archive.`,
      imageUrl: identifier ? `https://archive.org/services/img/${encodeURIComponent(identifier)}` : undefined,
    }, "Internet Archive");
    return source ? [source] : [];
  });
}

async function fetchDuckDuckGo(query: string): Promise<Source[]> {
  const endpoint = new URL("https://api.duckduckgo.com/");
  endpoint.search = new URLSearchParams({ q: query, format: "json", no_html: "1", skip_disambig: "0" }).toString();
  const response = await withTimeout(fetch(endpoint, { cache: "no-store" }), 4200);
  if (!response.ok) throw new Error(`DuckDuckGo ${response.status}`);
  const data = await response.json() as any;
  const out: Source[] = [];
  const primary = normalizeSource({ title: data.Heading || query, url: data.AbstractURL || "", excerpt: data.AbstractText || "" }, "DuckDuckGo");
  if (primary) out.push(primary);
  (data.RelatedTopics || []).flatMap((item: any) => item.Topics || [item]).slice(0, 10).forEach((item: any) => {
    const source = normalizeSource({
      title: clean(item.Text).split(" - ")[0], url: item.FirstURL || "", excerpt: item.Text || "",
    }, "DuckDuckGo");
    if (source) out.push(source);
  });
  return out;
}

function relevance(source: Source, query: string) {
  const words = tokens(query);
  if (!words.length) return 1;
  const title = source.title.toLowerCase();
  const body = source.excerpt.toLowerCase();
  let score = 0;
  words.forEach((word) => {
    if (title.includes(word)) score += 4;
    if (body.slice(0, 1500).includes(word)) score += 1;
  });
  if (source.imageUrl) score += 0.4;
  if (source.provider === "Wikipedia") score += 0.25;
  return score / words.length;
}

function selectSources(sources: Source[], query: string) {
  const seen = new Set<string>();
  const domainCount = new Map<string, number>();
  const providerCount = new Map<string, number>();
  const ranked = sources
    .filter((source) => {
      const key = (source.url || `${source.provider}:${source.title}`).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((source) => ({ ...source, score: relevance(source, query) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const chosen: Source[] = [];
  ranked.forEach((source) => {
    if (chosen.length >= 15) return;
    const domain = (source.domain || source.provider).toLowerCase();
    const provider = source.provider.toLowerCase();
    const domains = domainCount.get(domain) || 0;
    const providers = providerCount.get(provider) || 0;
    if (domain.includes("wikipedia.org") && providers >= 1) return;
    if (domains >= 2 || providers >= 4) return;
    if ((source.score || 0) <= 0 && chosen.length >= 7) return;
    chosen.push(source);
    domainCount.set(domain, domains + 1);
    providerCount.set(provider, providers + 1);
  });

  if (chosen.length < 10) {
    ranked.forEach((source) => {
      if (chosen.length >= 12) return;
      if (!chosen.some((item) => (item.url || `${item.provider}:${item.title}`) === (source.url || `${source.provider}:${source.title}`))) chosen.push(source);
    });
  }
  return chosen;
}

async function searchAllSources(query: string) {
  const resolved = resolvedQuery(query);
  const searches = [...new Set([query, resolved])].slice(0, 2);
  const tasks: Promise<Source[]>[] = [];
  searches.forEach((search) => {
    tasks.push(fetchWikipedia(search));
    tasks.push(fetchOpenAlex(search));
    tasks.push(fetchCrossref(search));
    tasks.push(fetchNasa(search));
    tasks.push(fetchInternetArchive(search));
  });
  tasks.push(fetchDuckDuckGo(query));
  const settled = await Promise.allSettled(tasks);
  const merged = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return { resolved, sources: selectSources(merged, resolved) };
}

function buildOverview(query: string, sources: Source[]) {
  const lines: string[] = [];
  sources.forEach((source) => {
    const first = sentence(source.excerpt);
    if (!first) return;
    const normalized = first.toLowerCase();
    if (lines.some((line) => line.toLowerCase() === normalized)) return;
    lines.push(first);
  });
  return lines.slice(0, 3).join(" ") || `Infinity Phi opened ${query}, but the public source providers did not return usable evidence on this pass.`;
}

function buildRecord(query: string, resolved: string, sources: Source[]): ResultRecord {
  return {
    query,
    resolved,
    title: query,
    overview: buildOverview(query, sources),
    sources,
    created: Date.now(),
  };
}

function saveSharedResearch(record: ResultRecord) {
  try {
    localStorage.setItem(OMNI_RESEARCH, JSON.stringify({
      version: "infinity-omni-render-v1",
      query: record.query,
      mode: "search",
      createdAt: new Date(record.created).toISOString(),
      overview: record.overview,
      source: { id: "source", label: record.query, position: { x: 0, y: 0, z: 0 }, affinity: 1 },
      nodes: [],
      sources: record.sources.map((source) => ({
        id: source.id,
        title: source.title,
        url: source.url,
        domain: source.domain,
        provider: source.provider,
        extract: source.excerpt,
        image: source.imageUrl || "",
        storyKey: source.url || source.id,
      })),
      sourceSystem: "Infinity Phi · Omni renderer",
      profileSnapshot: {},
    }));
  } catch {}
}

function awardShare(reference: string) {
  try {
    const attemptId = `phi-share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const read = (key: string, fallback: any) => {
      try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; }
    };
    const session = read("starquest_session", null);
    const users = read("starquest_users", {});
    const signedIn = session?.key && users[session.key];
    const wallet: any = signedIn || read("starquest_guest_profile_v1", { tokens: 0, shareCount: 0, pendingShareCredits: 0, shareEvents: [], ledger: [] });
    wallet.tokens = Math.max(0, Number(wallet.tokens) || 0);
    wallet.shareCount = Math.max(0, Number(wallet.shareCount) || 0) + 1;
    wallet.pendingShareCredits = Math.max(0, Number(wallet.pendingShareCredits) || 0) + 1;
    wallet.shareEvents = Array.isArray(wallet.shareEvents) ? wallet.shareEvents : [];
    wallet.ledger = Array.isArray(wallet.ledger) ? wallet.ledger : [];
    wallet.shareEvents.push({ id: attemptId, reference, method: "web_share_api", confirmed: true, createdAt: Date.now() });
    let awarded = 0;
    while (wallet.pendingShareCredits >= 10) { wallet.pendingShareCredits -= 10; wallet.tokens += 1; awarded += 1; }
    wallet.ledger.push({ id: `tx-${attemptId}`, type: awarded ? "share_reward" : "share_credit", amount: awarded, balance: wallet.tokens, pendingShareCredits: wallet.pendingShareCredits, referenceId: attemptId, createdAt: Date.now() });
    wallet.shareEvents = wallet.shareEvents.slice(-250);
    wallet.ledger = wallet.ledger.slice(-500);
    if (signedIn) { users[session.key] = wallet; localStorage.setItem("starquest_users", JSON.stringify(users)); }
    else localStorage.setItem("starquest_guest_profile_v1", JSON.stringify(wallet));
    window.dispatchEvent(new CustomEvent("starquest:share-progress", { detail: { progressToNextCoin: wallet.pendingShareCredits, awarded, balance: wallet.tokens } }));
    return { progressToNextCoin: wallet.pendingShareCredits, awarded };
  } catch {
    return {};
  }
}

async function shareSource(source: Source, query: string): Promise<ShareResult> {
  const storyKey = source.url || source.id;
  const params = new URLSearchParams({
    sharedTitle: source.title,
    sharedBody: source.excerpt.slice(0, 1200),
    sharedUrl: source.url,
    sharedImage: source.imageUrl || "",
    sharedDomain: source.domain || source.provider,
    sharedQuery: query,
  });
  const shareUrl = `https://www-infinity4.github.io/News-Phi/?${params.toString()}#story=${encodeURIComponent(storyKey)}`;
  if (!navigator.share) {
    try { await navigator.clipboard.writeText(shareUrl); return { copied: true }; } catch { return {}; }
  }
  try {
    await navigator.share({ title: source.title, text: source.excerpt.slice(0, 320), url: shareUrl });
    return awardShare(shareUrl);
  } catch (error: any) {
    return error?.name === "AbortError" ? { cancelled: true } : {};
  }
}

function readQuery() {
  if (typeof window === "undefined") return "";
  return clean(new URLSearchParams(window.location.search).get("q") || "", 1000);
}

export default function PhiPage2() {
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [record, setRecord] = useState<ResultRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [shareStatus, setShareStatus] = useState<Record<string, string>>({});
  const requestRef = useRef(0);
  const history = useMemo(() => secureLoad<HistoryItem[]>(HISTORY, []), [record?.created]);

  async function run(nextQuery: string, writeUrl = false) {
    const q = clean(nextQuery, 1000);
    if (!q) return;
    const requestId = ++requestRef.current;
    setQuery(q);
    setInput(q);
    setBusy(true);
    setNotice("");
    setRecord({ query: q, resolved: resolvedQuery(q), title: q, overview: `Searching the public source field for ${q}…`, sources: [], created: Date.now() });

    if (writeUrl) {
      const target = new URL(window.location.href);
      target.pathname = appPath("phi");
      target.search = "";
      target.searchParams.set("q", q);
      target.searchParams.set("run", "1");
      target.hash = "";
      History.prototype.pushState.call(window.history, { infinityPhiSearch: q }, "", target.toString());
    }

    try {
      const result = await searchAllSources(q);
      if (requestId !== requestRef.current) return;
      const next = buildRecord(q, result.resolved, result.sources);
      setRecord(next);
      setBusy(false);
      if (!next.sources.length) setNotice("The renderer stayed active, but no provider returned usable public evidence on this pass. Search again or change the wording; the page will not time out or 404.");
      const nextHistory = [...secureLoad<HistoryItem[]>(HISTORY, []), { query: q, resolved: result.resolved, kind: result.resolved === q ? "general" : "element", at: Date.now() }].slice(-80);
      secureSave(HISTORY, nextHistory);
      saveSharedResearch(next);
      window.dispatchEvent(new Event("infinity-history-updated"));
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setBusy(false);
      setNotice("The public providers did not finish, but the result renderer stayed live. Retry this search without leaving the page.");
    }
  }

  useEffect(() => {
    const initial = readQuery();
    if (!initial) return;
    void run(initial, false);
    return () => { requestRef.current += 1; };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(input, true);
  }

  const sources = record?.sources || [];
  const orange = sources.slice(0, 10);
  const purple = sources.slice(0, 8);
  const green = sources.slice(0, 15);
  const hero = sources.find((source) => source.imageUrl) || sources[0];

  if (!query && !record) return null;

  return (
    <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-20 sm:px-5" aria-live="polite">
      <section className="mb-5 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <a href={appPath("phi")} className="rounded-full bg-violet-700 px-3 py-2 text-xs font-black text-white">Search φ</a>
          <a href={`${appPath("phi/code")}?q=${encodeURIComponent(query)}`} className="rounded-full border border-violet-300 bg-white px-3 py-2 text-xs font-black text-violet-800">Code φ</a>
          <a href={`${appPath("phi/create")}?q=${encodeURIComponent(query)}`} className="rounded-full border border-violet-300 bg-white px-3 py-2 text-xs font-black text-violet-800">Create φ</a>
          <span className="ml-auto text-xs font-bold text-slate-500">Infinity Phi · Omni result engine</span>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border-2 border-violet-300 bg-slate-50 p-2">
          <Search size={20} className="shrink-0 text-violet-700" />
          <input value={input} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base font-semibold text-slate-950 outline-none" aria-label="Search Infinity Phi" />
          <button type="submit" disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-700 text-lg font-black text-white disabled:opacity-60" aria-label="Search">
            {busy ? <Sparkles size={18} className="animate-pulse" /> : "φ"}
          </button>
        </form>
        {busy && <div className="mt-3 flex items-center gap-2 text-sm font-bold text-violet-700"><Sparkles size={16} className="animate-pulse" /> Searching providers in parallel; one slow source cannot stop the page.</div>}
        {notice && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{notice}</p>}
      </section>

      {record && (
        <article className="space-y-7">
          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-xl">
            {hero?.imageUrl ? <img src={hero.imageUrl} alt={hero.title} className="h-56 w-full object-cover sm:h-72" onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} /> : null}
            <div className="p-5 sm:p-7">
              <div className="mb-2 text-xs font-black uppercase tracking-[.18em] text-violet-700">AI overview</div>
              <h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-4xl">{record.title}</h1>
              <p className="phi-editorial-deck mt-4 text-base leading-7 text-slate-700 sm:text-lg">{record.overview}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span>{sources.length} live source records</span><span>•</span><span>{record.resolved}</span>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><div className="text-xs font-black uppercase tracking-[.18em] text-orange-700">Best paths</div><h2 className="text-2xl font-black text-slate-950">Orange cards</h2></div>
              <span className="text-xs font-bold text-slate-500">Real source evidence shaped into result cards</span>
            </div>
            {orange.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {orange.map((source, index) => (
                  <article key={source.id || index} className="phi-orange-card overflow-hidden rounded-[26px] border-2 border-orange-400 bg-gradient-to-br from-orange-500 to-red-700 text-white shadow-lg" data-atom-nucleus={query}>
                    {source.imageUrl ? <img src={source.imageUrl} alt={source.title} className="h-44 w-full object-cover" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="grid h-24 place-items-center text-4xl font-black">φ</div>}
                    <div className="p-5">
                      <small className="font-black uppercase tracking-[.12em] text-yellow-200">{source.provider} · result {index + 1}</small>
                      <h3 className="mt-2 text-xl font-black leading-tight text-yellow-100">{source.title}</h3>
                      <p className="mt-3 leading-6 text-orange-50">{source.excerpt.slice(0, 520)}{source.excerpt.length > 520 ? "…" : ""}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {source.url && <a href={source.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-2 text-xs font-black">Read source <ExternalLink size={13} /></a>}
                        <a href={`${appPath("phi/build")}?${new URLSearchParams({ q: query, focus: source.title }).toString()}`} className="rounded-full bg-yellow-300 px-3 py-2 text-xs font-black text-red-950">Build this story</a>
                        <button type="button" className="phi-share-card inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/10 px-3 py-2 text-xs font-black" onClick={async () => {
                          const result = await shareSource(source, query);
                          setShareStatus((current) => ({ ...current, [source.id]: result.awarded ? "Shared · 1 StarCoin!" : result.progressToNextCoin != null ? `Shared · ${result.progressToNextCoin}/10 ⭐` : result.copied ? "Link copied" : result.cancelled ? "Share cancelled" : "Share card · +1/10 ⭐" }));
                        }}><Share2 size={13} /> {shareStatus[source.id] || "Share card · +1/10 ⭐"}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-5 font-semibold text-orange-900">The result shell is live. Provider cards will appear here as soon as usable evidence arrives.</div>}
          </section>

          <section className="rounded-[30px] bg-violet-950 p-5 text-white shadow-xl sm:p-7">
            <div className="mb-4"><div className="text-xs font-black uppercase tracking-[.18em] text-fuchsia-300">Research directions</div><h2 className="text-2xl font-black">Purple cards</h2></div>
            <div className="grid gap-3 md:grid-cols-2">
              {purple.length ? purple.map((source, index) => (
                <article key={`purple-${source.id}-${index}`} className="rounded-2xl border border-fuchsia-300/30 bg-white/10 p-4">
                  <small className="font-black uppercase tracking-[.12em] text-fuchsia-300">Research note {String(index + 1).padStart(2, "0")}</small>
                  <h3 className="mt-2 text-lg font-black">{source.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-violet-100">{sentence(source.excerpt)}</p>
                  <a href={`${appPath("phi/build")}?${new URLSearchParams({ q: query, focus: source.title, note: sentence(source.excerpt) }).toString()}`} className="mt-3 inline-block rounded-full bg-fuchsia-300 px-3 py-2 text-xs font-black text-violet-950">Expand into website</a>
                </article>
              )) : <p className="text-violet-200">Research notes will populate from the same successful source set.</p>}
            </div>
          </section>

          <section className="rounded-[30px] bg-emerald-950 p-5 text-white shadow-xl sm:p-7">
            <div className="mb-4"><div className="text-xs font-black uppercase tracking-[.18em] text-emerald-300">Evidence</div><h2 className="text-2xl font-black">Green sources</h2></div>
            <div className="grid gap-3 md:grid-cols-2">
              {green.length ? green.map((source, index) => (
                <a key={`green-${source.id}-${index}`} href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noopener" : undefined} className="phi-green-card rounded-2xl border border-emerald-300/30 bg-white/10 p-4 transition hover:bg-white/15" onClick={(event) => { if (!source.url) event.preventDefault(); }}>
                  <small className="font-black uppercase tracking-[.12em] text-emerald-300">{source.provider} · {source.domain}</small>
                  <b className="mt-2 block text-base font-black">{source.title}</b>
                  <p className="mt-2 text-sm leading-6 text-emerald-50">{source.excerpt.slice(0, 260)}{source.excerpt.length > 260 ? "…" : ""}</p>
                  {source.url && <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-200">Open source <ExternalLink size={12} /></span>}
                </a>
              )) : <p className="text-emerald-200">No source links were returned on this pass.</p>}
            </div>
          </section>

          {history.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
              <b className="text-slate-900">Infinity history is still connected.</b> Recent searches remain available to the main Infinity Phi shell and search suggestions.
            </section>
          )}
        </article>
      )}
    </main>
  );
}
