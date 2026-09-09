"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Check, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
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
type Highlight = { index: number; title: string; body: string; source?: Source; imageUrl?: string };
type StoryBeat = { id: string; title: string; body: string; source?: Source; imageUrl?: string };
type ResearchNote = { id: string; title: string; body: string; source?: Source; focusIndex: number | null };
type RefinementPass = { id: string; terms: string[]; sourceCount: number; at: number };
type RefinementState = { baseConclusion: string; passes: RefinementPass[] };

const HISTORY = "infinity_phi_context_v1";
const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const LEDGER = "c13b0_infinity_token_ledger_v3";
const REFINE_PREFIX = "infinity_phi_refinement_v1_";

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const splitSentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item) => item.length > 45);
const delay = (ms: number) => new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms));
const WORD_SKIP = new Set(["about", "after", "again", "against", "because", "before", "being", "between", "could", "every", "first", "from", "have", "into", "itself", "more", "other", "over", "same", "such", "than", "that", "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with", "would", "your"]);

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(36);
}

function liveBuilderUrl(paper: Paper, focusedFinding: number | null, note?: string) {
  const noteText = clean(note);
  const params = new URLSearchParams({
    id: noteText ? `${paper.id}-note-${hashText(noteText)}` : paper.id,
    q: noteText ? `${paper.query}: ${noteText}` : paper.query,
    resolved: noteText ? `${paper.resolved} ${noteText}` : paper.resolved,
    phone: "1",
    version: "20260909-context-refinement",
    focus: noteText ? "-1" : focusedFinding === null ? "-1" : String(focusedFinding),
  });
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

function wordSet(value: string) {
  return new Set((clean(value).toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 3 && !WORD_SKIP.has(word)));
}

function overlapScore(a: string, b: string) {
  const left = wordSet(a);
  const right = wordSet(b);
  let score = 0;
  left.forEach((word) => { if (right.has(word)) score += 1; });
  return score;
}

function contextRelevant(source: Source, baseQuery: string, keyword: string) {
  const text = `${source.title} ${source.excerpt}`.toLowerCase();
  const baseWords = [...wordSet(baseQuery)];
  const keywordWords = [...wordSet(keyword)];
  const baseHits = baseWords.filter((word) => text.includes(word)).length;
  const keywordHits = keywordWords.filter((word) => text.includes(word)).length;
  const baseNeed = Math.min(2, Math.max(1, baseWords.length));
  return baseHits >= baseNeed && (keywordWords.length === 0 || keywordHits >= 1);
}

async function researchKeyword(baseQuery: string, keyword: string, identity: Identity) {
  const query = `${baseQuery} ${keyword}`;
  const found = (await hardTimeout(research(query, identity), 7000)) || [];
  return found.filter((source) => contextRelevant(source, baseQuery, keyword));
}

function parseKeywordDirections(raw: string) {
  const direct = raw.split(/[;,\n]+/).map(clean).filter(Boolean);
  if (direct.length > 1) return [...new Set(direct)].slice(0, 12);
  const text = clean(raw);
  if (!text) return [];
  const lower = text.toLowerCase();
  const phrases = ["business strike", "proof strike", "silver content", "mint mark", "pcgs grades", "grade values", "auction records", "key dates", "die variety", "die varieties"];
  const selected: string[] = [];
  let remainder = ` ${lower} `;
  for (const phrase of phrases) {
    if (remainder.includes(` ${phrase} `)) {
      selected.push(phrase);
      remainder = remainder.replace(` ${phrase} `, " ");
    }
  }
  selected.push(...(remainder.match(/[a-z0-9][a-z0-9-]{2,}/g) || []));
  return [...new Set(selected.map(clean).filter(Boolean))].slice(0, 12);
}

function intentionalTitle(query: string, identity: Identity, sources: Source[]) {
  const subject = clean(identity.name || query).replace(/[?.!]+$/, "");
  const lower = `${query} ${sources.slice(0, 6).map((source) => `${source.title} ${source.excerpt}`).join(" ")}`.toLowerCase();
  if (/\b(quarter|dime|nickel|cent|penny|half dollar|dollar|coin|coinage|numismatic)\b/.test(lower)) {
    const phrase = clean(query).replace(/[?.!]+$/, "");
    return `${phrase}: Mintage, Strikes, Grades, and Collector Context`;
  }
  if (identity.kind === "element") {
    if (/group\s*7|manganese group|rhenium/.test(lower)) return `${subject} at the Edge of Group 7: What Its Chemistry Can Actually Tell Us`;
    return `${subject} in Context: Chemistry, Evidence, and the Questions That Matter`;
  }
  if (/\b(magnet|magnetic|coerciv|permanent magnet)\b/.test(lower)) return `${subject}: How Magnetic Structure Shapes What the Material Can Do`;
  if (/\b(hydrogen|spectral|1420|21 cm)\b/.test(lower)) return `${subject}: From Atomic Behavior to the Engineering Questions Around It`;
  if (/\b(storage|memory|data)\b/.test(lower)) return `${subject}: How the Information Could Be Stored, Read, and Tested`;
  const phrase = subject.split(/\s+/).slice(0, 10).join(" ");
  return `${phrase}: What the Evidence Shows and Where the Story Leads`;
}

function bestSourceFor(text: string, sources: Source[]) {
  let best = sources[0];
  let score = -1;
  sources.forEach((source) => {
    const next = overlapScore(text, `${source.title} ${source.excerpt}`) + (source.imageUrl ? 0.25 : 0);
    if (next > score) { score = next; best = source; }
  });
  return best;
}

function highlightTitle(paper: Paper, finding: string, source: Source | undefined, index: number) {
  const subject = clean(paper.identity.name || paper.query);
  const text = `${finding} ${source?.title || ""}`.toLowerCase();
  if (/proof/.test(text)) return "Proof Production and Collector Issues";
  if (/business strike|circulation strike/.test(text)) return "Business Strikes and Circulation Production";
  if (/mintage|minted|production/.test(text) && /coin|quarter|dime|cent|dollar/.test(`${paper.query} ${text}`.toLowerCase())) return "Mintage and Mint Production";
  if (/pcgs|grade|grading|ms\s?\d|pr\s?\d/.test(text)) return "Grades, Certification, and Market Value";
  if (/silver|composition|weight|diameter/.test(text) && /coin|quarter|dime|cent|dollar/.test(`${paper.query} ${text}`.toLowerCase())) return "Metal, Weight, and Physical Specifications";
  if (/group\s*7|manganese group/.test(text)) return `Where ${subject} Fits in Group 7`;
  if (/oxidation state|oxidation/.test(text)) return `${subject}'s Oxidation-State Chemistry`;
  if (/electron configuration|electronic configuration/.test(text)) return "Electron Configuration and Chemical Behavior";
  if (/isotope|half-life|radioactive|decay/.test(text)) return "Isotopes, Stability, and Decay";
  if (/discover|synthesi|produced|laboratory/.test(text)) return `How ${subject} Was Made and Identified`;
  if (/numismatic/.test(text)) return "Numismatics: How Collectors Read Coins";
  if (/silver round|bullion/.test(text)) return "Collectible Silver Rounds and Bullion";
  if (/coinage|currency|mint/.test(text)) return "Coinage, Mints, and Monetary History";
  if (/antique|ancient|historic/.test(text)) return "Antique Coins and the Stories They Carry";
  const sourceTitle = clean(source?.title);
  if (sourceTitle && sourceTitle.toLowerCase() !== subject.toLowerCase() && sourceTitle.length >= 8 && sourceTitle.length <= 78) return sourceTitle;
  const clause = clean(finding.split(/[;:—]/)[0]);
  if (clause.length >= 12 && clause.length <= 72) return clause.replace(/[.]+$/, "");
  return `A Closer Look at ${subject} · ${index + 1}`;
}

function makePaper(query: string, resolved: string, identity: Identity, sources: Source[], id?: string, created?: number): Paper {
  const records = sources
    .flatMap((source, sourceIndex) => splitSentences(source.excerpt).map((text) => ({ text, sourceIndex })))
    .filter((item) => item.text.length > 55);
  const escapedName = clean(identity.name || query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const subject = new RegExp(`\\b${escapedName}\\b`, "i");
  const ranked = records
    .sort((a, b) => ((subject.test(b.text) ? 50 : 0) + (b.sourceIndex === 0 ? 25 : 0)) - ((subject.test(a.text) ? 50 : 0) + (a.sourceIndex === 0 ? 25 : 0)))
    .map((item) => item.text);
  const unique = [...new Set(ranked)];
  const overview = unique.slice(0, 3).join(" ") || `Infinity Phi opened the search for ${query}, but the live source providers did not return usable material before the safety timeout. Retry or add contextual keywords to make a fresh source pass.`;
  const used = new Set(unique.slice(0, 3));
  return {
    id: id || `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query,
    resolved,
    identity,
    title: intentionalTitle(query, identity, sources),
    overview,
    findings: unique.filter((item) => !used.has(item)).slice(0, 18),
    sources,
    created: created || Date.now(),
  };
}

function makeHighlights(paper: Paper): Highlight[] {
  const visualSources = paper.sources.filter((source) => source.imageUrl);
  return paper.findings.slice(0, 8).map((body, index) => {
    const source = bestSourceFor(body, paper.sources);
    return {
      index,
      title: highlightTitle(paper, body, source, index),
      body,
      source,
      imageUrl: source?.imageUrl || visualSources[index % Math.max(1, visualSources.length)]?.imageUrl,
    };
  });
}

function makeStoryBeats(paper: Paper, highlights: Highlight[], focusedFinding: number | null): StoryBeat[] {
  const focus = focusedFinding === null ? null : highlights.find((item) => item.index === focusedFinding) || null;
  const candidates = [
    ...splitSentences(paper.overview),
    ...paper.findings.slice(0, 12),
    ...paper.sources.slice(0, 8).flatMap((source) => splitSentences(source.excerpt).slice(0, 2)),
  ].map(clean).filter(Boolean);
  const seen = new Set<string>();
  let unique = candidates.filter((line) => {
    const key = line.slice(0, 150).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (focus) unique = unique.sort((a, b) => overlapScore(b, focus.body) - overlapScore(a, focus.body));
  const lines = unique.slice(0, 14);
  const headings = focus
    ? [`Focused lens — ${focus.title}`, "What the evidence adds", "The mechanism and context", "Where the focused story branches", "What still needs separating", "The next research move", "What the deeper pass changes"]
    : ["The opening frame", "What the evidence says", "How the pieces connect", "Where the story branches", "Why the distinctions matter", "What to investigate next", "The larger context"];
  const visualSources = paper.sources.filter((source) => source.imageUrl);
  const beats: StoryBeat[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const body = lines.slice(index, index + 2).join(" ");
    const source = bestSourceFor(body, paper.sources);
    beats.push({
      id: `beat-${index / 2}`,
      title: headings[index / 2] || `Story frame ${index / 2 + 1}`,
      body,
      source,
      imageUrl: source?.imageUrl || visualSources[(index / 2) % Math.max(1, visualSources.length)]?.imageUrl,
    });
  }
  return beats;
}

function relatedHighlights(beat: StoryBeat, highlights: Highlight[]) {
  return [...highlights]
    .map((highlight) => ({ highlight, score: overlapScore(beat.body, `${highlight.title} ${highlight.body}`) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.highlight);
}

function notesForStory(beats: StoryBeat[]): ResearchNote[] {
  return beats.map((beat, index) => ({
    id: `story-note-${index}`,
    title: `Story research · ${beat.title}`,
    body: beat.body,
    source: beat.source,
    focusIndex: null,
  }));
}

function notesForHighlight(paper: Paper, highlight: Highlight): ResearchNote[] {
  const rankedSources = [...paper.sources].sort((a, b) => overlapScore(highlight.body, `${b.title} ${b.excerpt}`) - overlapScore(highlight.body, `${a.title} ${a.excerpt}`));
  const material = [
    highlight.body,
    ...rankedSources.slice(0, 5).flatMap((source) => splitSentences(source.excerpt).slice(0, 2)),
    ...paper.findings.filter((finding) => finding !== highlight.body && overlapScore(finding, highlight.body) > 0).slice(0, 4),
  ];
  const seen = new Set<string>();
  return material.filter((line) => {
    const key = clean(line).slice(0, 150).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8).map((body, index) => {
    const source = bestSourceFor(body, rankedSources);
    return {
      id: `focus-${highlight.index}-note-${index}`,
      title: index === 0 ? `${highlight.title} · working note` : clean(source?.title) || `${highlight.title} · evidence ${index + 1}`,
      body,
      source,
      focusIndex: highlight.index,
    };
  });
}

function dedupeSources(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url || `${source.provider}:${source.title}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function persistAfterRender(paper: Paper, nextHistory: HistoryItem[]) {
  try { await secureSaveDurable(HISTORY, nextHistory); } catch {}
  try {
    const compact = { ...paper, findings: paper.findings.slice(0, 14), sources: paper.sources.slice(0, 32).map((s) => ({ ...s, excerpt: s.excerpt.slice(0, 1800) })) };
    secureSave(`${PAPER_PREFIX}${paper.id}`, paper, "session");
    secureSave(`${PAPER_PREFIX}${paper.id}`, paper);
    const existing = await secureLoadDurable<Paper[]>(PAPERS, []);
    await secureSaveDurable(`${PAPER_PREFIX}${paper.id}`, compact);
    await secureSaveDurable(PAPERS, [...existing.filter((item) => item.id !== paper.id), compact].slice(-10));
  } catch {}
  try {
    const existing = await secureLoadDurable<Record<string, unknown>[]>(LEDGER, []);
    const wallet = connectOrCreateWallet("Infinity Phi");
    const token = {
      id: paper.id, researchId: paper.id, stage: "research", kind: "research", color: "yellow",
      status: "finished", value: 1, units: 1, title: paper.title, query: paper.query,
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
  const [showFullStory, setShowFullStory] = useState(false);
  const [expandedHighlight, setExpandedHighlight] = useState<number | null>(null);
  const [researchNotes, setResearchNotes] = useState<ResearchNote[]>([]);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [researchTrail, setResearchTrail] = useState("Read the story or choose an orange branch to start building tailored research notes.");
  const [keywordInput, setKeywordInput] = useState("");
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineStatus, setRefineStatus] = useState("");
  const [refinementPasses, setRefinementPasses] = useState<RefinementPass[]>([]);
  const [baseConclusion, setBaseConclusion] = useState("");

  async function saveRefinementState(paperId: string, state: RefinementState) {
    secureSave(`${REFINE_PREFIX}${paperId}`, state);
    try { await secureSaveDurable(`${REFINE_PREFIX}${paperId}`, state); } catch {}
  }

  async function runSearch(raw: string, currentHistory: HistoryItem[] = []) {
    const q = raw.trim();
    if (!q) return;
    const resolved = resolve(q, currentHistory);
    const id = `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const shell = makePaper(q, resolved.resolved, resolved.identity, [], id);
    shell.title = `${q}: building the evidence and story…`;
    shell.overview = `Searching live sources for ${q}…`;
    secureSave(`${PAPER_PREFIX}${shell.id}`, shell, "session");
    setPaper(shell);
    setBusy(true);
    setNotice("");
    setShowAllSources(false);
    setFocusedFinding(null);
    setShowFullStory(false);
    setExpandedHighlight(null);
    setResearchNotes([]);
    setExpandedNote(null);
    setResearchTrail("Read the story or choose an orange branch to start building tailored research notes.");
    setRefinementPasses([]);
    setKeywordInput("");
    setRefineStatus("");
    setBaseConclusion("");
    const nextHistory = [...currentHistory, { query: q, resolved: resolved.resolved, kind: resolved.kind, at: Date.now() }].slice(-80);
    setHistory(nextHistory);
    try {
      const sources = (await hardTimeout(research(resolved.resolved, resolved.identity), 7000)) || [];
      const next = makePaper(q, resolved.resolved, resolved.identity, sources, id);
      secureSave(`${PAPER_PREFIX}${next.id}`, next, "session");
      setPaper(next);
      setBusy(false);
      setBaseConclusion(next.overview);
      await saveRefinementState(next.id, { baseConclusion: next.overview, passes: [] });
      if (!sources.length) setNotice("Live source providers timed out. The search page stayed active instead of freezing; retry or add contextual keywords.");
      window.setTimeout(() => void persistAfterRender(next, nextHistory), 700);
    } catch {
      setBusy(false);
      setBaseConclusion(shell.overview);
      setNotice("The live source pass stopped safely instead of freezing the page. Retry the search to start a fresh pass.");
      window.setTimeout(() => void persistAfterRender(shell, nextHistory), 700);
    }
  }

  async function runRefinement(event: FormEvent) {
    event.preventDefault();
    if (!paper || refineBusy) return;
    const terms = parseKeywordDirections(keywordInput);
    if (!terms.length) {
      setRefineStatus("Add one or more keyword directions. Separate phrases with commas when you want them searched independently.");
      return;
    }
    const prior = new Set(refinementPasses.flatMap((pass) => pass.terms).map((term) => term.toLowerCase()));
    const freshTerms = terms.filter((term) => !prior.has(term.toLowerCase()));
    if (!freshTerms.length) {
      setRefineStatus("Those directions are already attached to this subject. Add another direction to deepen it further.");
      return;
    }
    setRefineBusy(true);
    setRefineStatus(`Searching ${freshTerms.length} direction${freshTerms.length === 1 ? "" : "s"} with “${paper.query}” locked as the parent subject…`);
    const gathered: Source[] = [];
    for (let start = 0; start < freshTerms.length; start += 4) {
      const batch = freshTerms.slice(start, start + 4);
      const settled = await Promise.allSettled(batch.map((term) => researchKeyword(paper.query, term, paper.identity)));
      settled.forEach((result) => { if (result.status === "fulfilled") gathered.push(...result.value); });
    }
    const merged = dedupeSources([...paper.sources, ...gathered]);
    const next = makePaper(paper.query, paper.resolved, paper.identity, merged, paper.id, paper.created);
    const pass: RefinementPass = { id: `pass-${Date.now()}`, terms: freshTerms, sourceCount: gathered.length, at: Date.now() };
    const passes = [...refinementPasses, pass];
    setPaper(next);
    setRefinementPasses(passes);
    setKeywordInput("");
    setRefineBusy(false);
    setFocusedFinding(null);
    setShowFullStory(false);
    setExpandedHighlight(null);
    const nextHighlights = makeHighlights(next);
    const nextBeats = makeStoryBeats(next, nextHighlights, null);
    setResearchNotes(notesForStory(nextBeats).slice(0, 8));
    setResearchTrail(`Keyword pass ${passes.length} added ${freshTerms.join(", ")}. The original subject remains locked while the article aim gets narrower.`);
    setRefineStatus(gathered.length
      ? `${gathered.length} context-matched source records were added. You can add another keyword pass or continue to the workbench.`
      : "No new context-matched source records came back for that pass. The keywords are still recorded as article directions; add another pass or adjust the wording.");
    const state = { baseConclusion: baseConclusion || paper.overview, passes };
    await saveRefinementState(paper.id, state);
    window.setTimeout(() => void persistAfterRender(next, history), 250);
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
            secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null) ||
            (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === id);
          if (exact) {
            setPaper(exact);
            setQuery(exact.query);
            const localRefine = secureLoad<RefinementState | null>(`${REFINE_PREFIX}${exact.id}`, null);
            let refine = localRefine;
            if (!refine) {
              try { refine = await secureLoadDurable<RefinementState | null>(`${REFINE_PREFIX}${exact.id}`, null); } catch {}
            }
            setBaseConclusion(refine?.baseConclusion || exact.overview);
            setRefinementPasses(refine?.passes || []);
          }
        } catch {}
      })();
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runSearch(query, history);
  }

  const highlights = paper ? makeHighlights(paper) : [];
  const storyBeats = paper ? makeStoryBeats(paper, highlights, focusedFinding) : [];
  const heroSource = paper?.sources.find((source) => source.imageUrl) || paper?.sources[0];
  const heroImage = heroSource?.imageUrl;

  function chooseHighlight(index: number) {
    if (!paper) return;
    const highlight = highlights.find((item) => item.index === index);
    if (!highlight) return;
    const clearing = focusedFinding === index;
    if (clearing) {
      setFocusedFinding(null);
      setExpandedHighlight(null);
      setResearchNotes([]);
      setResearchTrail("Orange branch cleared. Read the full story or choose another branch to rebuild the purple notes.");
      return;
    }
    setFocusedFinding(index);
    setExpandedHighlight(index);
    setShowFullStory(false);
    setExpandedNote(null);
    setResearchNotes(notesForHighlight(paper, highlight));
    setResearchTrail(`Focused research: ${highlight.title}. Purple notes are now weighted toward this branch.`);
  }

  function toggleFullStory() {
    if (!paper) return;
    const opening = !showFullStory;
    setShowFullStory(opening);
    if (opening) {
      setExpandedNote(null);
      setResearchNotes(notesForStory(storyBeats));
      setResearchTrail(focusedFinding === null
        ? "Full story opened. Every story frame has been converted into purple research notes you can expand or turn into a website."
        : "Focused full story opened. Purple research notes now reflect the selected orange branch across the entire article.");
    }
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

        {paper && <article className="phi-results phi-living-result">
          <nav className="phi-tabs"><span className="active">AI overview</span></nav>
          <div className="phi-result-grid">
            <section className="phi-answer">
              <section className="phi-editorial-hero" aria-label="Editorial title and lead image">
                <div className="phi-editorial-copy">
                  <span className="phi-editorial-kicker"><BookOpen size={15} /> Research edition</span>
                  <h1>{paper.title}</h1>
                  <div className="phi-identity"><Check size={14} /> {paper.identity.kind === "element" ? `${paper.identity.name} · ${paper.identity.symbol} · atomic number ${paper.identity.number}` : paper.identity.name}</div>
                  <p className="phi-editorial-deck">{paper.overview}</p>
                </div>
                <div className="phi-hero-media">
                  {heroImage ? <img src={heroImage} alt={heroSource?.title || paper.title} /> : <div className="phi-hero-fallback">φ</div>}
                  <div className="phi-hero-caption">{heroSource ? `${heroSource.provider} · ${heroSource.title}` : "Lead visual will strengthen as image-bearing research sources arrive."}</div>
                </div>
              </section>

              <section className="phi-refine-panel" aria-labelledby="phi-refine-heading">
                <div className="phi-refine-head">
                  <small>Search 1 · subject locked</small>
                  <h2 id="phi-refine-heading">{paper.query}</h2>
                  <p className="phi-base-conclusion">{baseConclusion || paper.overview}</p>
                </div>
                {refinementPasses.length > 0 && <div className="phi-refinement-passes">
                  {refinementPasses.map((pass, index) => <div className="phi-refinement-pass" key={pass.id}><b>Pass {index + 2}</b><span>{pass.terms.join(" · ")}</span><small>{pass.sourceCount} new matches</small></div>)}
                </div>}
                <form className="phi-keyword-form" onSubmit={runRefinement}>
                  <label className="phi-keyword-label" htmlFor="phi-keyword-search">
                    <small>Search {refinementPasses.length + 2}+ · contextual keyword pass</small>
                    <b>Add the details you want this same article to cover</b>
                  </label>
                  <div className="phi-keyword-row">
                    <textarea id="phi-keyword-search" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="proof, business strike, mintage, PCGS grades, values, silver content" />
                    <button type="submit" disabled={refineBusy}>{refineBusy ? "Researching…" : "Add keyword research"}</button>
                  </div>
                  <p className="phi-keyword-help">Comma-separated directions are searched independently, but every one remains attached to “{paper.query}”. Add as many passes as you need before opening the page-two workbench.</p>
                  {refineStatus && <div className="phi-refine-status">{refineStatus}</div>}
                </form>
              </section>

              {storyBeats.length > 0 && <section className="phi-living-section" aria-labelledby="phi-story-heading">
                <div className="phi-living-heading">
                  <div><h2 id="phi-story-heading">The full story</h2></div>
                  <p>The baseline grows as you add contextual keyword passes. Orange threads narrow the reading path without changing the original subject.</p>
                </div>
                <div className="phi-magazine-story">
                  {(showFullStory ? storyBeats : storyBeats.slice(0, 2)).map((beat) => {
                    const threads = relatedHighlights(beat, highlights);
                    return <article className="phi-story-beat" key={beat.id}>
                      <div className="phi-story-copy">
                        <h3>{beat.title}</h3>
                        <p>{beat.body}</p>
                      </div>
                      <div className="phi-story-media">
                        {beat.imageUrl && <img src={beat.imageUrl} alt={beat.source?.title || beat.title} />}
                        {threads.length > 0 && <div className="phi-story-thread">
                          <span>Related direction</span>
                          {threads.map((thread) => <button type="button" key={thread.index} onClick={() => chooseHighlight(thread.index)}>{thread.title}</button>)}
                        </div>}
                      </div>
                    </article>;
                  })}
                  {storyBeats.length > 2 && <button type="button" className="phi-read-more" onClick={toggleFullStory}>
                    <span>{showFullStory ? "Collapse the full story" : "Read the full article"}</span>
                    <span>{showFullStory ? "−" : "+"}</span>
                  </button>}
                </div>
                <div className="phi-research-trail">{researchTrail}</div>
              </section>}

              {highlights.length > 0 && <section className="phi-living-section" aria-labelledby="phi-next-stories-heading">
                <div className="phi-living-heading">
                  <div><h2 id="phi-next-stories-heading">Next stories to produce</h2></div>
                  <p>Orange cards remain narrowing directions. The page-two workbench can combine several of them at once before the clean magazine is printed.</p>
                </div>
                <div className="phi-orange-grid">
                  {highlights.map((highlight) => {
                    const selected = focusedFinding === highlight.index;
                    return <article className={`phi-orange-card${selected ? " selected" : ""}`} key={highlight.index}>
                      <button type="button" className="phi-orange-main" onClick={() => chooseHighlight(highlight.index)} aria-pressed={selected}>
                        {highlight.imageUrl ? <img src={highlight.imageUrl} alt={highlight.source?.title || highlight.title} /> : <div className="phi-orange-image-fallback">φ</div>}
                        <div className="phi-orange-copy">
                          <small>{selected ? "Active story branch" : `Next story ${String(highlight.index + 1).padStart(2, "0")}`}</small>
                          <h3>{highlight.title}</h3>
                          <p>{highlight.body}</p>
                        </div>
                      </button>
                      <div className="phi-orange-actions">
                        <button type="button" onClick={() => { setExpandedHighlight(expandedHighlight === highlight.index ? null : highlight.index); if (!selected) chooseHighlight(highlight.index); }}>{expandedHighlight === highlight.index ? "Show less" : "Read more"}</button>
                        <a href={liveBuilderUrl(paper, highlight.index)}><span className="phi-card-orb">φ</span> Build this story</a>
                      </div>
                    </article>;
                  })}
                </div>
              </section>}

              <section className="phi-living-section phi-purple-section" aria-labelledby="phi-notes-heading">
                <div className="phi-living-heading">
                  <div><h2 id="phi-notes-heading">Research notes</h2></div>
                  <p>Purple cards record the direction created by reading, orange choices, and your contextual keyword passes.</p>
                </div>
                <div className="phi-purple-grid">
                  {researchNotes.length === 0 ? <div className="phi-purple-empty">Read the full story, choose an orange story card, or add keyword passes above. Those interactions become the signal used to build these purple cards.</div> : researchNotes.map((note, index) => {
                    const isExpanded = expandedNote === note.id;
                    return <article className={`phi-purple-card${isExpanded ? " expanded" : ""}`} key={note.id}>
                      <button type="button" className="phi-purple-main" onClick={() => setExpandedNote(isExpanded ? null : note.id)}>
                        <small>Research note {String(index + 1).padStart(2, "0")}{note.source ? ` · ${note.source.provider}` : ""}</small>
                        <h3>{note.title}</h3>
                        <p>{note.body}</p>
                      </button>
                      <a className="phi-purple-build" href={liveBuilderUrl(paper, note.focusIndex, note.body)}><span className="phi-card-orb">φ</span> Expand this note into its own website</a>
                    </article>;
                  })}
                </div>
              </section>

              <section className="phi-living-section phi-green-section" aria-labelledby="phi-sources-heading">
                <div className="phi-living-heading">
                  <div><h2 id="phi-sources-heading">Sources</h2></div>
                  <p>{busy ? "Live source pass in progress…" : `${paper.sources.length} source records currently support this research package.`}</p>
                </div>
                <div className="phi-green-grid">
                  {(showAllSources ? paper.sources : paper.sources.slice(0, 6)).map((source, index) => <a key={`${source.url}-${index}`} href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined} className="phi-green-card">
                    {source.imageUrl ? <img src={source.imageUrl} alt="" /> : <span className="phi-green-source-number">{index + 1}</span>}
                    <div><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p></div>
                    <ExternalLink size={16} />
                  </a>)}
                </div>
                {paper.sources.length > 6 && <button type="button" className="phi-green-more" onClick={() => setShowAllSources((value) => !value)}>{showAllSources ? "Show fewer sources" : `View all ${paper.sources.length} sources`} <ChevronDown size={16} /></button>}
              </section>

              {busy || refineBusy ? (
                <div className="phi-build-card phi-build-wait" aria-live="polite">
                  <div><b>Finishing the research package…</b><p>The workbench opens as soon as this pass stops changing.</p></div>
                  <span className="phi-spinner" aria-hidden="true" />
                </div>
              ) : (
                <a className="phi-build-card" href={liveBuilderUrl(paper, focusedFinding)} target="_self" aria-label="Open page two workbench from this research">
                  <div><b>φ Open the page-two workbench</b><p>{refinementPasses.length ? `${refinementPasses.length} contextual keyword pass${refinementPasses.length === 1 ? "" : "es"} will travel with the original subject into the orange/purple/image assembly stage.` : "Add keyword passes first if you want to define the article aim more precisely, or continue now with the broad research package."}</p></div>
                  <span className="phi-build-orb" aria-hidden="true">φ</span>
                </a>
              )}

              <form onSubmit={submit} className="phi-followup"><Sparkles size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start a different subject" /><button>Search</button></form>
            </section>
          </div>
        </article>}

        <footer className="phi-credits">Infinity Phi · contextual research interface · GitHub Pages</footer>
      </div>
    </main>
  );
}
