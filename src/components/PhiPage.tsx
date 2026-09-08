"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import { connectOrCreateWallet } from "@/lib/wallet";

type HistoryItem = { query: string; resolved: string; kind: string; at: number };
type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Identity = { kind: string; name: string; symbol?: string; number?: number };
type Paper = {
  id: string;
  query: string;
  resolved: string;
  identity: Identity;
  title: string;
  overview: string;
  findings: string[];
  sources: Source[];
  created: number;
};

const HISTORY = "infinity_phi_context_v1";
const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const LEDGER = "c13b0_infinity_token_ledger_v3";

function liveBuilderUrl(paper: Paper, focusedFinding: number | null) {
  const params = new URLSearchParams({
    id: paper.id,
    q: paper.query,
    resolved: paper.resolved,
    phone: "1",
    version: "20260908-absolute-builder",
  });
  if (focusedFinding !== null) params.set("focus", String(focusedFinding));
  return `https://www-infinity4.github.io/C13b0/phi/build/?${params.toString()}`;
}

const ELEMENTS: Record<string, { symbol: string; number: number }> = {
  hydrogen: { symbol: "H", number: 1 }, helium: { symbol: "He", number: 2 },
  boron: { symbol: "B", number: 5 }, carbon: { symbol: "C", number: 6 },
  nitrogen: { symbol: "N", number: 7 }, oxygen: { symbol: "O", number: 8 },
  fluorine: { symbol: "F", number: 9 }, aluminum: { symbol: "Al", number: 13 },
  potassium: { symbol: "K", number: 19 }, iron: { symbol: "Fe", number: 26 },
  copper: { symbol: "Cu", number: 29 }, arsenic: { symbol: "As", number: 33 },
  selenium: { symbol: "Se", number: 34 }, yttrium: { symbol: "Y", number: 39 },
  niobium: { symbol: "Nb", number: 41 }, antimony: { symbol: "Sb", number: 51 },
  iodine: { symbol: "I", number: 53 }, dysprosium: { symbol: "Dy", number: 66 },
  ytterbium: { symbol: "Yb", number: 70 }, hafnium: { symbol: "Hf", number: 72 },
  tantalum: { symbol: "Ta", number: 73 }, tungsten: { symbol: "W", number: 74 },
  rhenium: { symbol: "Re", number: 75 }, platinum: { symbol: "Pt", number: 78 },
  gold: { symbol: "Au", number: 79 }, mercury: { symbol: "Hg", number: 80 },
  lead: { symbol: "Pb", number: 82 }, bismuth: { symbol: "Bi", number: 83 },
  uranium: { symbol: "U", number: 92 },
};

const MUSIC = /\b(queen|freddie|music|song|album|singer|band|rock|vocal|concert)\b/i;
const SCIENCE = /\b(element|atom|atomic|chem|chemistry|metal|oxide|ion|alloy|periodic|material|molecule|electron|isotope|physics|rhenium|helium|yttrium|dysprosium|bismuth|antimony|fluorine)\b/i;

function resolve(query: string, history: HistoryItem[]) {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  if (lower !== "mercury") {
    const element = ELEMENTS[lower];
    return element
      ? {
          kind: "element",
          resolved: `${raw} chemical element ${element.symbol} atomic number ${element.number}`,
          identity: { kind: "element", name: raw, symbol: element.symbol, number: element.number } as Identity,
        }
      : { kind: "general", resolved: raw, identity: { kind: "general", name: raw } as Identity };
  }
  const context = history.slice(-32).map((i) => `${i.query} ${i.resolved} ${i.kind}`).join(" ");
  return SCIENCE.test(context) || !MUSIC.test(context)
    ? { kind: "element", resolved: "Mercury chemical element Hg atomic number 80", identity: { kind: "element", name: "Mercury", symbol: "Hg", number: 80 } as Identity }
    : { kind: "music", resolved: "Mercury music Queen Freddie Mercury", identity: { kind: "music", name: "Mercury" } as Identity };
}

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const delay = (ms: number) => new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms));

async function hardTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([work.catch(() => null), delay(ms)]) as Promise<T | null>;
}

function relevant(source: Source, identity: Identity) {
  if (identity.kind !== "element") return true;
  const text = `${source.title} ${source.excerpt}`.toLowerCase();
  const name = identity.name.toLowerCase();
  const symbol = String(identity.symbol || "").toLowerCase();
  const exactName = new RegExp(`\\b${name}\\b`, "i").test(text);
  const atomic = text.includes(`atomic number ${identity.number}`);
  const exactSymbol = new RegExp(`\\b${symbol}\\b`, "i").test(text);
  if (name === "rhenium" && /\bhelium\b/i.test(text) && !exactName) return false;
  return exactName || atomic || (exactSymbol && /\b(element|metal|atomic|isotope|chemical)\b/i.test(text));
}

function sourceScore(source: Source, identity: Identity) {
  if (identity.kind !== "element") return source.provider === "Wikipedia" ? 5 : 0;
  const title = source.title.toLowerCase();
  const excerpt = source.excerpt.toLowerCase();
  const name = identity.name.toLowerCase();
  let score = 0;
  if (title === name || title === `${name} (element)`) score += 200;
  if (new RegExp(`\\b${name}\\b`, "i").test(title)) score += 80;
  if (new RegExp(`\\b${name}\\b`, "i").test(excerpt.slice(0, 420))) score += 35;
  if (excerpt.includes(`atomic number ${identity.number}`)) score += 40;
  if (source.provider === "Wikipedia") score += 15;
  if (source.imageUrl) score += 10;
  return score;
}

async function wikipedia(query: string): Promise<Source[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=14&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=720&format=json&origin=*`;
  const data = await hardTimeout(fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("Wikipedia request failed");
    return r.json();
  }), 5000);
  if (!data) return [];
  return Object.values((data as any)?.query?.pages || {}).flatMap((page: any) => {
    const excerpt = clean(page.extract);
    const title = clean(page.title);
    if (!title || !excerpt) return [];
    return [{ title, url: page.fullurl || "", excerpt, provider: "Wikipedia", imageUrl: page.thumbnail?.source }];
  });
}

async function duckDuckGo(query: string): Promise<Source[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
  const data = await hardTimeout(fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("DuckDuckGo request failed");
    return r.json();
  }), 3500);
  if (!data) return [];
  const out: Source[] = [];
  const d: any = data;
  if (d.AbstractText) out.push({ title: clean(d.Heading || query), url: d.AbstractURL || "", excerpt: clean(d.AbstractText), provider: "DuckDuckGo" });
  (d.RelatedTopics || []).flatMap((item: any) => item.Topics || [item]).forEach((item: any) => {
    if (item.Text) out.push({ title: clean(item.Text).split(" - ")[0], url: item.FirstURL || "", excerpt: clean(item.Text), provider: "DuckDuckGo" });
  });
  return out;
}

async function crossref(query: string): Promise<Source[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=14`;
  const data = await hardTimeout(fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error("Crossref request failed");
    return r.json();
  }), 3500);
  if (!data) return [];
  return ((data as any)?.message?.items || []).flatMap((item: any) => {
    const title = clean(item.title?.[0]);
    if (!title) return [];
    const abstract = clean(item.abstract);
    return [{
      title,
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
      excerpt: abstract || `${title}. Scholarly work indexed by Crossref${item.publisher ? ` from ${item.publisher}` : ""}.`,
      provider: "Crossref",
    }];
  });
}

async function research(query: string, identity: Identity): Promise<Source[]> {
  const primary = await wikipedia(query);
  const extrasPromise = Promise.all([duckDuckGo(query), crossref(query)]).then(([a, b]) => [...a, ...b]);
  const extras = (await hardTimeout(extrasPromise, 3800)) || [];
  const seen = new Set<string>();
  return [...primary, ...extras]
    .filter((source) => {
      const key = source.url || `${source.provider}:${source.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return source.title && source.excerpt && relevant(source, identity);
    })
    .sort((a, b) => sourceScore(b, identity) - sourceScore(a, identity));
}

function makePaper(query: string, resolved: string, identity: Identity, sources: Source[], id?: string): Paper {
  const records = sources
    .flatMap((source, sourceIndex) => source.excerpt.split(/(?<=[.!?])\s+/).map((text) => ({ text: clean(text), sourceIndex })))
    .filter((item) => item.text.length > 55);
  const subject = new RegExp(`\\b${identity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const ranked = records
    .sort((a, b) => ((subject.test(b.text) ? 50 : 0) + (b.sourceIndex === 0 ? 25 : 0)) - ((subject.test(a.text) ? 50 : 0) + (a.sourceIndex === 0 ? 25 : 0)))
    .map((item) => item.text);
  const unique = [...new Set(ranked)];
  const overview = unique.slice(0, 3).join(" ") || `Infinity Phi opened the search for ${query}, but the live source providers did not return usable material before the safety timeout. The interface is still active; retrying or refining the query will start a fresh source pass.`;
  const used = new Set(unique.slice(0, 3));
  return {
    id: id || `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query, resolved, identity, title: query, overview,
    findings: unique.filter((item) => !used.has(item)).slice(0, 12),
    sources,
    created: Date.now(),
  };
}

async function persistAfterRender(paper: Paper, nextHistory: HistoryItem[]) {
  try { await secureSaveDurable(HISTORY, nextHistory); } catch {}
  try {
    const compact = { ...paper, findings: paper.findings.slice(0, 8), sources: paper.sources.slice(0, 16).map((s) => ({ ...s, excerpt: s.excerpt.slice(0, 1600) })) };
    secureSave(`${PAPER_PREFIX}${paper.id}`, paper, "session");
    const existing = await secureLoadDurable<Paper[]>(PAPERS, []);
    await secureSaveDurable(`${PAPER_PREFIX}${paper.id}`, compact);
    await secureSaveDurable(PAPERS, [...existing.filter((item) => item.id !== paper.id), compact].slice(-6));
  } catch {}
  try {
    const existing = await secureLoadDurable<Record<string, unknown>[]>(LEDGER, []);
    const wallet = connectOrCreateWallet("Infinity Phi");
    const token = {
      id: paper.id, researchId: paper.id, stage: "research", kind: "research", color: "yellow",
      status: "finished", value: 1, units: 1, title: paper.query, query: paper.query,
      resolved: paper.resolved, sourceCount: paper.sources.length, walletId: wallet.walletId,
      createdAt: new Date(paper.created).toISOString(),
    };
    await secureSaveDurable(LEDGER, [token, ...existing.filter((item: any) => item.id !== paper.id)].slice(0, 200));
    window.dispatchEvent(new Event("infinity-history-updated"));
  } catch {}
}

export default function PhiPage() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAllSources, setShowAllSources] = useState(false);
  const [focusedFinding, setFocusedFinding] = useState<number | null>(null);

  async function runSearch(raw: string, currentHistory: HistoryItem[] = []) {
    const q = raw.trim();
    if (!q) return;
    const resolved = resolve(q, currentHistory);
    const id = `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const shell = makePaper(q, resolved.resolved, resolved.identity, [], id);
    shell.overview = `Searching live sources for ${q}…`;
    secureSave(`${PAPER_PREFIX}${shell.id}`, shell, "session");
    setPaper(shell);
    setBusy(true);
    setNotice("");
    setShowAllSources(false);
    setFocusedFinding(null);
    const nextHistory = [...currentHistory, { query: q, resolved: resolved.resolved, kind: resolved.kind, at: Date.now() }].slice(-80);
    setHistory(nextHistory);
    try {
      const sources = (await hardTimeout(research(resolved.resolved, resolved.identity), 7000)) || [];
      const next = makePaper(q, resolved.resolved, resolved.identity, sources, id);
      secureSave(`${PAPER_PREFIX}${next.id}`, next, "session");
      setPaper(next);
      setBusy(false);
      if (!sources.length) setNotice("Live source providers timed out. The search page stayed active instead of freezing; retry to make a fresh source pass.");
      window.setTimeout(() => void persistAfterRender(next, nextHistory), 1000);
    } catch {
      setBusy(false);
      setNotice("The live source pass stopped safely instead of freezing the page. Retry the search to start a fresh pass.");
      window.setTimeout(() => void persistAfterRender(shell, nextHistory), 1000);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initial = params.get("q") || "";
    const id = params.get("id") || "";
    const localHistory = secureLoad<HistoryItem[]>(HISTORY, []);
    if (localHistory.length) setHistory(localHistory);
    if (initial) {
      setQuery(initial);
      if (params.get("run") === "1") void runSearch(initial, localHistory);
    }
    if (id && !initial) {
      void (async () => {
        try {
          const exact =
            (await secureLoadDurable<Paper | null>(`${PAPER_PREFIX}${id}`, null)) ||
            secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null, "session") ||
            (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === id);
          if (exact) { setPaper(exact); setQuery(exact.query); }
        } catch {}
      })();
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runSearch(query, history);
  }

  return (
    <main className="phi-mode">
      <div className="phi-shell">
        <header className="phi-topline"><span>Built with ChatGPT</span></header>
        <section className={paper ? "phi-search-section compact" : "phi-search-section"}>
          {!paper && <>
            <div className="phi-orb">φ</div>
            <h1>Infinity φ</h1>
            <p>Structured futures from endless results.</p>
          </>}
          <form onSubmit={submit} className="phi-search-box">
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Research topic" placeholder="Search" />
            <button disabled={busy} aria-label="Search all sources">
              {busy ? <span className="phi-spinner" /> : <span className="phi-omni" aria-hidden="true">⊙</span>}
            </button>
          </form>
          {busy && <div className="phi-thinking"><Sparkles size={16} /> Researching live sources without blocking the page…</div>}
          {notice && <p className="phi-notice">{notice}</p>}
        </section>

        {paper && <article className="phi-results">
          <nav className="phi-tabs"><span className="active">AI overview</span><span>Sources</span><span>Build</span></nav>
          <div className="phi-result-grid">
            <section className="phi-answer">
              <div className="phi-ai-label"><span className="phi-mini-orb">φ</span><b>AI Overview</b></div>
              <h1>{paper.title}</h1>
              <div className="phi-identity"><Check size={14} /> Exact identity: {paper.identity.kind === "element" ? `${paper.identity.name} · ${paper.identity.symbol} · atomic number ${paper.identity.number}` : paper.identity.name}</div>
              <p className="phi-lead">{paper.overview}</p>

              {paper.findings.length > 0 && <section className="phi-key-points">
                <h2>Key points</h2>
                <div className={`phi-finding-grid${focusedFinding !== null ? " has-focus" : ""}`}>
                  {paper.findings.slice(0, 6).map((finding, index) => <button type="button" key={index} aria-pressed={focusedFinding === index} className={focusedFinding === index ? "focused" : ""} onClick={() => setFocusedFinding((current) => current === index ? null : index)}><small>{focusedFinding === index ? "Selected website aim" : `Aim ${index + 1}`}</small>{finding}</button>)}
                </div>
                <div className="phi-build-scope">
                  <b>{focusedFinding === null ? "Build every aim" : "Focused build selected"}</b>
                  <p>{focusedFinding === null ? "No card is selected, so the builder will develop every orange card into its own illustrated website section." : "The selected card becomes the website’s main subject, with deeper research, visual explanations, and supporting cards of its own."}</p>
                  {focusedFinding !== null && <button type="button" onClick={() => setFocusedFinding(null)}>Clear selection and build everything</button>}
                </div>
              </section>}

              {busy ? (
                <div className="phi-build-card phi-build-wait" aria-live="polite">
                  <div><b>Finishing the research package…</b><p>The website button activates as soon as this result stops changing.</p></div>
                  <span className="phi-spinner" aria-hidden="true" />
                </div>
              ) : (
                <a className="phi-build-card" href={liveBuilderUrl(paper, focusedFinding)} target="_self" aria-label="Build full website from this research">
                  <div><b>{focusedFinding === null ? "Build the complete illustrated website" : "Build the selected aim in depth"}</b><p>{focusedFinding === null ? "Every orange card becomes an illustrated section with research cards of its own." : "The chosen card becomes a focused visual script with deeper explanations, evidence, and expansion points."}</p></div>
                  <span className="phi-build-orb" aria-hidden="true">φ</span>
                </a>
              )}

              <form onSubmit={submit} className="phi-followup"><Sparkles size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask a follow-up" /><button>Ask</button></form>
            </section>

            <aside className="phi-sources">
              <h2>Sources</h2>
              <p>{busy ? "Live source pass in progress…" : `${paper.sources.length} results passed validation`}</p>
              {(showAllSources ? paper.sources : paper.sources.slice(0, 4)).map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="phi-source-card"><span>{index + 1}</span><div><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p></div><ExternalLink size={15} /></a>)}
              {paper.sources.length > 4 && <button className="phi-more" onClick={() => setShowAllSources((value) => !value)}>{showAllSources ? "Show fewer" : `View all ${paper.sources.length} sources`} <ChevronDown size={16} /></button>}
            </aside>
          </div>
        </article>}

        <footer className="phi-credits">Infinity Phi · live research interface · GitHub Pages</footer>
      </div>
    </main>
  );
}
