"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import { connectOrCreateWallet } from "@/lib/wallet";
import { contentTerms, detectCatalogEntity, gateResearchSources } from "@/lib/phi-search-filters";
import { loadInfinityProfile, profileContextText } from "@/lib/infinity-profile";
import styles from "./PhiPage2.module.css";

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
type StoryBeat = { id: string; title: string; body: string; source?: Source; imageUrl?: string };
type ResearchNote = { id: string; title: string; body: string; source?: Source };
type RefinementPass = { id: string; terms: string[]; sourceCount: number; at: number; origin?: "discovery" | "keyword" };
type RefinementState = { baseConclusion: string; passes: RefinementPass[] };
type DiscoveryTopic = { key: string; title: string; body: string; keyword: string };
type EvidenceCard = { index: number; title: string; body: string; source?: Source; imageUrl?: string };

const HISTORY = "infinity_phi_context_v1";
const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const LEDGER = "c13b0_infinity_token_ledger_v3";
const REFINE_PREFIX = "infinity_phi_refinement_v1_";

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const splitSentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item) => item.length > 42);
const delay = (ms: number) => new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms));
const WORD_SKIP = new Set(["about", "after", "again", "against", "because", "before", "being", "between", "could", "every", "first", "from", "have", "into", "itself", "more", "other", "over", "same", "such", "than", "that", "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with", "would", "your", "also", "only", "some", "most", "many"]);

const ELEMENTS: Record<string, { symbol: string; number: number }> = {
  hydrogen: { symbol: "H", number: 1 }, helium: { symbol: "He", number: 2 }, boron: { symbol: "B", number: 5 },
  carbon: { symbol: "C", number: 6 }, nitrogen: { symbol: "N", number: 7 }, oxygen: { symbol: "O", number: 8 },
  fluorine: { symbol: "F", number: 9 }, aluminum: { symbol: "Al", number: 13 }, potassium: { symbol: "K", number: 19 },
  iron: { symbol: "Fe", number: 26 }, copper: { symbol: "Cu", number: 29 }, arsenic: { symbol: "As", number: 33 },
  selenium: { symbol: "Se", number: 34 }, yttrium: { symbol: "Y", number: 39 }, niobium: { symbol: "Nb", number: 41 },
  antimony: { symbol: "Sb", number: 51 }, iodine: { symbol: "I", number: 53 }, dysprosium: { symbol: "Dy", number: 66 },
  ytterbium: { symbol: "Yb", number: 70 }, hafnium: { symbol: "Hf", number: 72 }, tantalum: { symbol: "Ta", number: 73 },
  tungsten: { symbol: "W", number: 74 }, rhenium: { symbol: "Re", number: 75 }, platinum: { symbol: "Pt", number: 78 },
  manganese: { symbol: "Mn", number: 25 }, technetium: { symbol: "Tc", number: 43 }, bohrium: { symbol: "Bh", number: 107 },
  gold: { symbol: "Au", number: 79 }, mercury: { symbol: "Hg", number: 80 }, lead: { symbol: "Pb", number: 82 },
  bismuth: { symbol: "Bi", number: 83 }, uranium: { symbol: "U", number: 92 },
};

function wordSet(value: string) {
  return new Set(contentTerms(value).filter((word) => word.length > 3 && !WORD_SKIP.has(word)));
}

function overlapScore(a: string, b: string) {
  const left = wordSet(a);
  const right = wordSet(b);
  let score = 0;
  left.forEach((word) => { if (right.has(word)) score += 1; });
  return score;
}

function nearDuplicate(a: string, b: string) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) return clean(a).toLowerCase() === clean(b).toLowerCase();
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  return shared / Math.min(left.size, right.size) >= 0.78;
}

function dedupeLines(lines: string[], limit = 30) {
  const out: string[] = [];
  for (const raw of lines.map(clean).filter(Boolean)) {
    if (out.some((existing) => nearDuplicate(existing, raw))) continue;
    out.push(raw);
    if (out.length >= limit) break;
  }
  return out;
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

function resolve(query: string, history: HistoryItem[]) {
  const raw = clean(query);
  const lower = raw.toLowerCase();
  const exactElement = ELEMENTS[lower];
  const catalogMatch = exactElement ? { name: lower, data: exactElement } : detectCatalogEntity(raw, ELEMENTS);
  if (catalogMatch) {
    const element = catalogMatch.data;
    const elementName = catalogMatch.name.replace(/(^|\s)\S/g, (match) => match.toUpperCase());
    return {
      kind: "element",
      resolved: `${elementName} chemical element ${element.symbol} atomic number ${element.number}`,
      identity: { kind: "element", name: elementName, symbol: element.symbol, number: element.number } as Identity,
    };
  }
  if (lower === "mercury") {
    const context = history.slice(-24).map((item) => `${item.query} ${item.resolved}`).join(" ");
    if (/chem|element|metal|atom|periodic|oxide|alloy/i.test(context)) {
      return { kind: "element", resolved: "Mercury chemical element Hg atomic number 80", identity: { kind: "element", name: "Mercury", symbol: "Hg", number: 80 } as Identity };
    }
  }
  return { kind: "general", resolved: raw, identity: { kind: "general", name: raw } as Identity };
}

async function hardTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([work.catch(() => null), delay(ms)]) as Promise<T | null>;
}

async function wikipedia(query: string): Promise<Source[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=14&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=900&format=json&origin=*`;
  const data = await hardTimeout(fetch(url, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error("Wikipedia request failed");
    return response.json();
  }), 5000);
  if (!data) return [];
  return Object.values((data as any)?.query?.pages || {}).flatMap((page: any) => {
    const title = clean(page.title);
    const excerpt = clean(page.extract);
    if (!title || !excerpt) return [];
    return [{ title, excerpt, url: page.fullurl || "", provider: "Wikipedia", imageUrl: page.thumbnail?.source }];
  });
}

async function duckDuckGo(query: string): Promise<Source[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
  const data = await hardTimeout(fetch(url, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error("DuckDuckGo request failed");
    return response.json();
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
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=12`;
  const data = await hardTimeout(fetch(url, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error("Crossref request failed");
    return response.json();
  }), 3500);
  if (!data) return [];
  return ((data as any)?.message?.items || []).flatMap((item: any) => {
    const title = clean(item.title?.[0]);
    if (!title) return [];
    return [{
      title,
      url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
      excerpt: clean(item.abstract) || `${title}. Scholarly work indexed by Crossref${item.publisher ? ` from ${item.publisher}` : ""}.`,
      provider: "Crossref",
    }];
  });
}

async function research(query: string): Promise<Source[]> {
  const primary = await wikipedia(query);
  const extras = (await hardTimeout(Promise.all([duckDuckGo(query), crossref(query)]).then(([a, b]) => [...a, ...b]), 4000)) || [];
  return dedupeSources([...primary, ...extras]).filter((source) => source.title && source.excerpt);
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

async function researchKeyword(baseQuery: string, keyword: string) {
  const found = (await hardTimeout(research(`${baseQuery} ${keyword}`), 7000)) || [];
  const strict = found.filter((source) => contextRelevant(source, baseQuery, keyword));
  return strict.length ? strict : found.filter((source) => overlapScore(`${source.title} ${source.excerpt}`, baseQuery) > 0);
}

function isCoinQuery(query: string) {
  return /\b(quarter|dime|nickel|cent|penny|half dollar|dollar|coin|coinage|numismatic|mint)\b/i.test(query);
}

function discoveryTopics(paper: Paper): DiscoveryTopic[] {
  if (isCoinQuery(paper.query)) return [
    { key: "mintage", title: "Mintage and mint production", keyword: "mintage mint production mint location", body: "Mintage tells you how many examples were struck and where they were made. It is the starting point for understanding supply, but a high or low mintage does not by itself determine rarity or value." },
    { key: "business", title: "Business strikes", keyword: "business strike circulation strike", body: "A business strike is made for ordinary circulation rather than special collector presentation. Learning this distinction keeps circulation coins separate from proofs when you compare production, condition, and value." },
    { key: "proof", title: "Proof issues", keyword: "proof strike proof mintage", body: "Proofs are specially prepared collector coins made with different production care than normal circulation strikes. Their mintage, surfaces, grading language, and market values should usually be studied separately." },
    { key: "grading", title: "Grading and certification", keyword: "PCGS grading mint state proof grade certification", body: "Grading describes preservation and eye appeal. For modern U.S. coins, a small change in numerical grade can create a large value difference, so the article should explain the scale before quoting prices." },
    { key: "value", title: "Value by grade", keyword: "PCGS price guide value by grade auction value", body: "A useful value section is a grade-by-grade range rather than one price. It should distinguish guide values from actual market sales and keep proof and business-strike values separate." },
    { key: "composition", title: "Metal, weight, and specifications", keyword: "silver composition weight diameter specifications", body: "Composition, weight, diameter, and silver content identify what the coin physically is. These specifications also help explain melt value, historical production, and authenticity checks." },
    { key: "varieties", title: "Varieties and errors", keyword: "die varieties errors doubled die repunched mint mark", body: "Varieties come from repeatable die differences, while errors come from something going wrong during manufacture. Either can make an otherwise common date much more interesting to collectors." },
    { key: "population", title: "Population and condition rarity", keyword: "PCGS population report condition rarity census", body: "A coin can be common overall but difficult in a very high grade. Population reports help explain condition rarity by showing how many examples have been certified at each level." },
    { key: "auction", title: "Auction history and real sales", keyword: "auction records realized prices sales history", body: "Auction records show what buyers actually paid. They are especially useful when price guides lag the market or when high-grade examples trade infrequently." },
    { key: "history", title: "Design and historical context", keyword: "design history United States Mint historical context", body: "The date makes more sense when it is placed inside the design series, Mint policy, and the historical period in which the coin was produced." },
  ];

  if (paper.identity.kind === "element") return [
    { key: "identity", title: "Atomic identity and periodic position", keyword: "atomic number periodic group electron configuration", body: "Start with where the element sits in the periodic table and why its electron structure matters. That foundation makes later chemistry easier to understand." },
    { key: "occurrence", title: "Where it occurs", keyword: "natural occurrence minerals ores abundance", body: "Occurrence explains whether the element is found free, in minerals, or only in compounds, and how abundant or scarce it is in usable deposits." },
    { key: "properties", title: "Physical and chemical properties", keyword: "physical properties chemical properties melting boiling density", body: "Properties connect the element's atomic structure to what it does in the laboratory and in engineered materials." },
    { key: "compounds", title: "Compounds and oxidation states", keyword: "compounds oxidation states oxides halides chemistry", body: "Compounds show the practical chemistry of the element: which oxidation states are stable, what it bonds with, and which forms matter most." },
    { key: "isotopes", title: "Isotopes and nuclear behavior", keyword: "isotopes half life radioactive stable isotopes", body: "Isotopes can change stability, decay behavior, tracing uses, and nuclear applications without changing the element's chemical identity." },
    { key: "uses", title: "Applications and engineered uses", keyword: "applications technology industrial uses materials", body: "Applications show how the element's properties are turned into devices, alloys, catalysts, phosphors, magnets, or other useful systems." },
    { key: "safety", title: "Safety and exposure", keyword: "health safety toxicity exposure hazards", body: "Safety deserves its own section so chemical toxicity, dust exposure, radioactivity, and workplace handling are not mixed together." },
    { key: "frontier", title: "Open research questions", keyword: "recent research unresolved questions advanced materials", body: "A research frontier section separates established facts from questions that scientists are still testing." },
  ];

  return [
    { key: "definition", title: "What it is and what it is not", keyword: "definition terminology categories", body: "A strong article begins by defining the subject clearly and separating it from neighboring ideas that are easy to confuse with it." },
    { key: "history", title: "How it developed", keyword: "history origin development timeline", body: "History explains how the subject reached its current form and which changes mattered most along the way." },
    { key: "mechanism", title: "How it works", keyword: "how it works mechanism process", body: "The mechanism section turns a label into an explanation by showing the steps, parts, or causes that make the subject work." },
    { key: "types", title: "Major types and categories", keyword: "types categories variants classification", body: "Categories help the reader see which differences are fundamental and which are just variations inside the same idea." },
    { key: "evidence", title: "Measurements and evidence", keyword: "data evidence measurements statistics", body: "Evidence gives the article anchors: measurements, records, experiments, statistics, or other observations that can be checked." },
    { key: "uses", title: "Real-world uses", keyword: "applications examples use cases", body: "Applications show why the subject matters outside a definition and which situations make it useful." },
    { key: "limits", title: "Limits, risks, and failure points", keyword: "limitations risks problems failures", body: "A serious explanation includes where the idea stops working, what can go wrong, and which claims should not be overstated." },
    { key: "future", title: "What to investigate next", keyword: "future research open questions developments", body: "Open questions turn the article into a research path by showing what is established and what still deserves investigation." },
  ];
}

function subjectRelevantLine(text: string, query: string, identity: Identity) {
  const lower = clean(text).toLowerCase();
  if (identity.kind === "element") {
    const name = clean(identity.name).toLowerCase();
    return Boolean(name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(lower));
  }
  const anchors = [...wordSet(query)];
  if (!anchors.length) return true;
  const hits = anchors.filter((word) => lower.includes(word)).length;
  return hits >= Math.min(2, anchors.length);
}

function storyDiscoveryTopics(paper: Paper): DiscoveryTopic[] {
  const storyLines = dedupeLines([...splitSentences(paper.overview), ...paper.findings], 14);
  const storyCards = storyLines.map((body, index) => {
    const source = bestSourceFor(body, paper.sources);
    const title = evidenceTitle(paper, body, source, index);
    const keyword = [title, ...[...wordSet(body)].slice(0, 5)].join(" ");
    return { key: `story-${index}-${body.length}`, title, body, keyword };
  });
  const used = new Set(storyCards.map((card) => card.title.toLowerCase()));
  const guided = discoveryTopics(paper).filter((topic) => !used.has(topic.title.toLowerCase()));
  return [...storyCards, ...guided].slice(0, 16);
}

function intentionalTitle(query: string, identity: Identity) {
  const subject = clean(query).replace(/[?.!]+$/, "");
  if (isCoinQuery(query)) return `${subject}: Mintage, Strikes, Grades, and Collector Context`;
  if (identity.kind === "element") return `${subject}: Atomic Structure, Chemistry, Evidence, and Open Questions`;
  return `${subject}: What the Evidence Shows and Where the Story Leads`;
}

function makePaper(query: string, resolved: string, identity: Identity, sources: Source[], id?: string, created?: number): Paper {
  const allRecords = sources.flatMap((source, sourceIndex) => splitSentences(source.excerpt).map((text) => ({ text, sourceIndex })));
  const subjectRecords = allRecords.filter((item) => subjectRelevantLine(item.text, query, identity));
  const records = subjectRecords.length >= 3 ? subjectRecords : allRecords;
  const ranked = [...records].sort((a, b) => {
    const aScore = overlapScore(a.text, query) + (a.sourceIndex === 0 ? 3 : 0);
    const bScore = overlapScore(b.text, query) + (b.sourceIndex === 0 ? 3 : 0);
    return bScore - aScore;
  }).map((item) => item.text);
  const unique = dedupeLines(ranked, 26);
  const overview = unique.slice(0, 3).join(" ") || `Infinity Phi opened the search for ${query}, but live source providers did not return enough usable material yet.`;
  const overviewParts = dedupeLines(splitSentences(overview), 4);
  const used = overviewParts;
  return {
    id: id || `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query,
    resolved,
    identity,
    title: intentionalTitle(query, identity),
    overview: overviewParts.join(" "),
    findings: unique.filter((line) => !used.some((usedLine) => nearDuplicate(usedLine, line))).slice(0, 20),
    sources: dedupeSources(sources),
    created: created || Date.now(),
  };
}

function bestSourceFor(text: string, sources: Source[]) {
  return [...sources].sort((a, b) => overlapScore(text, `${b.title} ${b.excerpt}`) - overlapScore(text, `${a.title} ${a.excerpt}`))[0];
}

function evidenceTitle(paper: Paper, body: string, source: Source | undefined, index: number) {
  const text = `${body} ${source?.title || ""}`.toLowerCase();
  if (/proof/.test(text)) return "Proof production and collector issues";
  if (/business strike|circulation strike/.test(text)) return "Business strikes and circulation production";
  if (/mintage|minted|production/.test(text) && isCoinQuery(paper.query)) return "Mintage and Mint production";
  if (/pcgs|grade|grading|ms\s?\d|pr\s?\d/.test(text)) return "Grades, certification, and market value";
  if (/silver|composition|weight|diameter/.test(text) && isCoinQuery(paper.query)) return "Metal, weight, and specifications";
  const sourceTitle = clean(source?.title);
  if (sourceTitle && sourceTitle.length >= 8 && sourceTitle.length <= 72) return sourceTitle;
  const clause = clean(body.split(/[;:—]/)[0]);
  return clause.length >= 12 && clause.length <= 72 ? clause.replace(/[.]+$/, "") : `A closer look at ${paper.query} · ${index + 1}`;
}

function makeEvidenceCards(paper: Paper): EvidenceCard[] {
  const visualSources = paper.sources.filter((source) => source.imageUrl);
  const out: EvidenceCard[] = [];
  const titles = new Set<string>();
  paper.findings.forEach((body, index) => {
    if (out.length >= 8) return;
    const source = bestSourceFor(body, paper.sources);
    const title = evidenceTitle(paper, body, source, index);
    const key = title.toLowerCase();
    if (titles.has(key)) return;
    titles.add(key);
    const fallback = visualSources[out.length];
    out.push({ index: out.length, title, body, source, imageUrl: source?.imageUrl || fallback?.imageUrl });
  });
  return out;
}

function makeStoryBeats(paper: Paper): StoryBeat[] {
  const candidates = [
    ...splitSentences(paper.overview),
    ...paper.findings,
    ...paper.sources.slice(0, 10).flatMap((source) => splitSentences(source.excerpt).slice(0, 2)),
  ];
  const lines = dedupeLines(candidates, 16);
  const headings = ["The opening frame", "What the evidence says", "How the pieces connect", "Where the story branches", "Why the distinctions matter", "What changes the value or outcome", "What still needs separating", "What to investigate next"];
  const unusedImages = paper.sources.filter((source) => source.imageUrl).map((source) => ({ url: source.imageUrl!, source }));
  const usedImages = new Set<string>();
  const beats: StoryBeat[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const body = lines.slice(index, index + 2).join(" ");
    const source = bestSourceFor(body, paper.sources);
    let imageUrl: string | undefined;
    if (source?.imageUrl && !usedImages.has(source.imageUrl)) imageUrl = source.imageUrl;
    if (!imageUrl) imageUrl = unusedImages.find((item) => !usedImages.has(item.url))?.url;
    if (imageUrl) usedImages.add(imageUrl);
    beats.push({ id: `beat-${index / 2}`, title: headings[index / 2] || `Story section ${index / 2 + 1}`, body, source, imageUrl });
  }
  return beats;
}

function notesForFocus(paper: Paper, focusText: string, seedBody?: string): ResearchNote[] {
  const ranked = paper.sources
    .flatMap((source) => splitSentences(source.excerpt).map((body) => ({ body, source, score: overlapScore(body, focusText) })))
    .sort((a, b) => b.score - a.score);
  const bodies = dedupeLines([seedBody || "", ...ranked.map((item) => item.body), ...paper.findings], 10);
  return bodies.map((body, index) => {
    const source = bestSourceFor(body, paper.sources);
    const title = index === 0 && seedBody ? clean(focusText).split(/[,;]+/)[0] : clean(source?.title) || `Research note ${index + 1}`;
    return { id: `note-${index}-${body.length}`, title, body, source };
  });
}

function parseKeywordDirections(raw: string) {
  const direct = raw.split(/[;,\n]+/).map(clean).filter(Boolean);
  if (direct.length > 1) return [...new Set(direct)].slice(0, 12);
  const text = clean(raw);
  if (!text) return [];
  const phrases = ["business strike", "proof strike", "silver content", "mint mark", "pcgs grades", "grade values", "auction records", "population report", "die variety", "die varieties"];
  const lower = text.toLowerCase();
  const selected: string[] = [];
  let remainder = ` ${lower} `;
  phrases.forEach((phrase) => {
    if (remainder.includes(` ${phrase} `)) {
      selected.push(phrase);
      remainder = remainder.replace(` ${phrase} `, " ");
    }
  });
  selected.push(...(remainder.match(/[a-z0-9][a-z0-9-]{2,}/g) || []));
  return [...new Set(selected.map(clean).filter(Boolean))].slice(0, 12);
}

async function persistPaper(paper: Paper, history: HistoryItem[]) {
  secureSave(`${PAPER_PREFIX}${paper.id}`, paper, "session");
  secureSave(`${PAPER_PREFIX}${paper.id}`, paper);
  try {
    const compact = { ...paper, findings: paper.findings.slice(0, 18), sources: paper.sources.slice(0, 40).map((source) => ({ ...source, excerpt: source.excerpt.slice(0, 2000) })) };
    const existing = await secureLoadDurable<Paper[]>(PAPERS, []);
    await secureSaveDurable(`${PAPER_PREFIX}${paper.id}`, compact);
    await secureSaveDurable(PAPERS, [...existing.filter((item) => item.id !== paper.id), compact].slice(-12));
    await secureSaveDurable(HISTORY, history);
  } catch {}
  try {
    const existing = await secureLoadDurable<Record<string, any>[]>(LEDGER, []);
    const wallet = connectOrCreateWallet("Infinity Phi");
    const token = {
      id: paper.id, researchId: paper.id, stage: "research", kind: "research", color: "yellow", status: "finished",
      value: 1, units: 1, title: paper.title, query: paper.query, resolved: paper.resolved,
      sourceCount: paper.sources.length, walletId: wallet.walletId, createdAt: new Date(paper.created).toISOString(),
    };
    await secureSaveDurable(LEDGER, [token, ...existing.filter((item) => item.id !== paper.id)].slice(0, 200));
    window.dispatchEvent(new Event("infinity-history-updated"));
  } catch {}
}

export default function PhiPage2() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAllSources, setShowAllSources] = useState(false);
  const [showFullStory, setShowFullStory] = useState(false);
  const [expandedEvidence, setExpandedEvidence] = useState<number | null>(null);
  const [researchNotes, setResearchNotes] = useState<ResearchNote[]>([]);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineStatus, setRefineStatus] = useState("");
  const [refinementPasses, setRefinementPasses] = useState<RefinementPass[]>([]);
  const [baseConclusion, setBaseConclusion] = useState("");
  const [activeDiscovery, setActiveDiscovery] = useState<string | null>(null);

  const topics = useMemo(() => paper ? storyDiscoveryTopics(paper) : [], [paper]);
  const evidenceCards = useMemo(() => paper ? makeEvidenceCards(paper) : [], [paper]);
  const storyBeats = useMemo(() => {
    if (!paper || !researchNotes.length) return [];
    const shapedPaper: Paper = {
      ...paper,
      overview: researchNotes.map((note) => note.body).slice(0, 3).join(" "),
      findings: researchNotes.map((note) => note.body),
    };
    return makeStoryBeats(shapedPaper);
  }, [paper, researchNotes]);
  const heroSource = paper?.sources.find((source) => source.imageUrl) || paper?.sources[0];
  const heroImage = heroSource?.imageUrl;
  const visualPool = useMemo(() => {
    const seen = new Set<string>();
    return (paper?.sources || []).flatMap((source) => source.imageUrl && !seen.has(source.imageUrl) ? (seen.add(source.imageUrl), [{ url: source.imageUrl, source }]) : []);
  }, [paper]);

  async function saveRefinementState(paperId: string, state: RefinementState) {
    secureSave(`${REFINE_PREFIX}${paperId}`, state);
    try { await secureSaveDurable(`${REFINE_PREFIX}${paperId}`, state); } catch {}
  }

  async function runSearch(raw: string, currentHistory: HistoryItem[] = []) {
    const q = clean(raw);
    if (!q) return;
    const resolved = resolve(q, currentHistory);
    const id = `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const shell = makePaper(q, resolved.resolved, resolved.identity, [], id);
    shell.title = `${q}: building the evidence and story…`;
    shell.overview = `Searching live sources for ${q}…`;
    setPaper(shell);
    setBusy(true);
    setNotice("");
    setShowAllSources(false);
    setShowFullStory(false);
    setResearchNotes([]);
    setExpandedEvidence(null);
    setExpandedNote(null);
    setRefinementPasses([]);
    setKeywordInput("");
    setRefineStatus("");
    setBaseConclusion("");
    setActiveDiscovery(null);
    secureSave(`${PAPER_PREFIX}${id}`, shell, "session");
    const nextHistory = [...currentHistory, { query: q, resolved: resolved.resolved, kind: resolved.kind, at: Date.now() }].slice(-80);
    setHistory(nextHistory);
    try {
      const rawSources = (await hardTimeout(research(resolved.resolved), 7500)) || [];
      const profile = await loadInfinityProfile().catch(() => null);
      const savedContext = profile ? profileContextText(profile) : "";
      const context = [currentHistory.slice(-12).map((item) => `${item.query} ${item.resolved}`).join(" "), savedContext].filter(Boolean).join(" ");
      const gated = gateResearchSources(rawSources, q, resolved.identity, context);
      const sources = gated.sources;
      const next = makePaper(q, resolved.resolved, resolved.identity, sources, id);
      setPaper(next);
      setBusy(false);
      setBaseConclusion(next.overview);
      await saveRefinementState(next.id, { baseConclusion: next.overview, passes: [] });
      if (!sources.length) setNotice("Live source providers timed out. The subject is still open, and the orange discovery cards can start a focused pass.");
      window.setTimeout(() => void persistPaper(next, nextHistory), 500);
    } catch {
      setBusy(false);
      setBaseConclusion(shell.overview);
      setNotice("The live source pass stopped safely. You can retry or use one of the discovery directions to make a focused pass.");
      window.setTimeout(() => void persistPaper(shell, nextHistory), 500);
    }
  }

  async function applyRefinementTerms(rawTerms: string[], origin: "discovery" | "keyword", seed?: DiscoveryTopic) {
    if (!paper || refineBusy) return;
    const prior = new Set(refinementPasses.flatMap((pass) => pass.terms).map((term) => term.toLowerCase()));
    const terms = rawTerms.map(clean).filter(Boolean);
    const freshTerms = terms.filter((term) => !prior.has(term.toLowerCase()));
    if (!freshTerms.length) {
      if (seed) {
        setActiveDiscovery(seed.key);
        setResearchNotes(notesForFocus(paper, seed.keyword, seed.body));
        setRefineStatus(`${seed.title} is already included in this research package.`);
      } else setRefineStatus("Those directions are already attached to this subject.");
      return;
    }
    setRefineBusy(true);
    if (seed) {
      setActiveDiscovery(seed.key);
      setResearchNotes([{ id: `seed-${seed.key}`, title: seed.title, body: seed.body }]);
    }
    setRefineStatus(`Keeping “${paper.query}” locked while researching ${freshTerms.join(" · ")}…`);
    const gathered: Source[] = [];
    for (let start = 0; start < freshTerms.length; start += 4) {
      const batch = freshTerms.slice(start, start + 4);
      const settled = await Promise.allSettled(batch.map((term) => researchKeyword(paper.query, term)));
      settled.forEach((result) => { if (result.status === "fulfilled") gathered.push(...result.value); });
    }
    const merged = dedupeSources([...paper.sources, ...gathered]);
    const next = makePaper(paper.query, paper.resolved, paper.identity, merged, paper.id, paper.created);
    const pass: RefinementPass = { id: `pass-${Date.now()}`, terms: freshTerms, sourceCount: gathered.length, at: Date.now(), origin };
    const passes = [...refinementPasses, pass];
    setPaper(next);
    setRefinementPasses(passes);
    setResearchNotes(notesForFocus(next, freshTerms.join(" "), seed?.body));
    setRefineBusy(false);
    setKeywordInput("");
    setRefineStatus(gathered.length
      ? `${gathered.length} context-matched source records were added. The article now knows this direction without losing the original subject.`
      : "That direction is now recorded in the article plan. No new source record matched strongly enough yet, so it stays marked for deeper research.");
    const state = { baseConclusion: baseConclusion || paper.overview, passes };
    await saveRefinementState(paper.id, state);
    window.setTimeout(() => void persistPaper(next, history), 200);
  }

  async function runRefinement(event: FormEvent) {
    event.preventDefault();
    const terms = parseKeywordDirections(keywordInput);
    if (!terms.length) {
      setRefineStatus("Add one or more directions. Separate phrases with commas when you want them searched independently.");
      return;
    }
    await applyRefinementTerms(terms, "keyword");
  }

  function readEvidence(card: EvidenceCard) {
    if (!paper) return;
    const opening = expandedEvidence !== card.index;
    setExpandedEvidence(opening ? card.index : null);
    if (opening) setResearchNotes(notesForFocus(paper, `${card.title} ${card.body}`, card.body));
  }

  function toggleFullStory() {
    if (!paper) return;
    const opening = !showFullStory;
    setShowFullStory(opening);
    if (opening) setResearchNotes(notesForFocus(paper, `${paper.query} complete story`, paper.overview));
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
          if (!exact) return;
          setPaper(exact);
          setQuery(exact.query);
          const localRefine = secureLoad<RefinementState | null>(`${REFINE_PREFIX}${exact.id}`, null);
          let refine = localRefine;
          if (!refine) {
            try { refine = await secureLoadDurable<RefinementState | null>(`${REFINE_PREFIX}${exact.id}`, null); } catch {}
          }
          setBaseConclusion(refine?.baseConclusion || exact.overview);
          setRefinementPasses(refine?.passes || []);
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Research topic" placeholder="Search" />
            <button disabled={busy} aria-label="Search all sources">{busy ? <span className="phi-spinner" /> : <span className="phi-omni" aria-hidden="true">⊙</span>}</button>
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
                  <div className="phi-identity"><Check size={14} /> {paper.identity.kind === "element" ? `${paper.identity.name} · ${paper.identity.symbol} · atomic number ${paper.identity.number}` : paper.identity.name}</div>
                  <p className="phi-editorial-deck">{paper.overview}</p>
                </div>
              </section>

              <section className="phi-living-section" aria-labelledby="phi-discovery-heading">
                <div className="phi-living-heading">
                  <div><h2 id="phi-discovery-heading">Research cards</h2></div>
                  <p>The overview starts factual. These orange cards break the research into useful parts; choosing what matters is what begins shaping your story.</p>
                </div>
                <div className="phi-orange-grid">
                  {topics.map((topic, index) => {
                    const selected = refinementPasses.some((pass) => pass.terms.some((term) => term.toLowerCase() === topic.keyword.toLowerCase()));
                    const image = visualPool[index]?.url;
                    const active = activeDiscovery === topic.key;
                    return <article className={`phi-orange-card${selected || active ? " selected" : ""}`} key={topic.key}>
                      <button type="button" className="phi-orange-main" onClick={() => void applyRefinementTerms([topic.keyword], "discovery", topic)} aria-pressed={selected}>
                        {image ? <img src={image} alt="" loading="lazy" /> : <div className="phi-orange-image-fallback">φ</div>}
                        <div className="phi-orange-copy">
                          <small>{selected ? "Included in this article" : `Discovery ${String(index + 1).padStart(2, "0")}`}</small>
                          <h3>{topic.title}</h3>
                          <p>{topic.body}</p>
                        </div>
                      </button>
                      <div className="phi-orange-actions">
                        <button type="button" disabled={refineBusy} onClick={() => void applyRefinementTerms([topic.keyword], "discovery", topic)}>{selected ? "Read this direction" : "Learn & add"}</button>
                        <a href={`${appPath("phi/build")}?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(paper.query)}&resolved=${encodeURIComponent(paper.resolved)}&phone=1`}><span className="phi-card-orb">φ</span> Workbench</a>
                      </div>
                    </article>;
                  })}
                </div>
              </section>

              <section className="phi-refine-panel" aria-labelledby="phi-refine-heading">
                <div className="phi-refine-head">
                  <small>Professional shortcut · optional</small>
                  <h2 id="phi-refine-heading">Already know what you want to add?</h2>
                  <p className="phi-base-conclusion">Search 1 stays locked to <b>{paper.query}</b>. This box is only for people who already know extra terms; the orange cards above remain the normal discovery path.</p>
                </div>
                {refinementPasses.length > 0 && <div className="phi-refinement-passes">
                  {refinementPasses.map((pass, index) => <div className="phi-refinement-pass" key={pass.id}><b>Pass {index + 2}</b><span>{pass.terms.join(" · ")}</span><small>{pass.sourceCount} new matches</small></div>)}
                </div>}
                <form className="phi-keyword-form" onSubmit={runRefinement}>
                  <label className="phi-keyword-label" htmlFor="phi-keyword-search"><small>Contextual keyword pass</small><b>Add as many specific directions as you need</b></label>
                  <div className="phi-keyword-row">
                    <textarea id="phi-keyword-search" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder={isCoinQuery(paper.query) ? "proof, business strike, PCGS grades, auction records" : "Add specific terms or phrases, separated by commas"} />
                    <button type="submit" disabled={refineBusy}>{refineBusy ? "Researching…" : "Add research"}</button>
                  </div>
                  <p className="phi-keyword-help">Each comma-separated direction is searched independently while “{paper.query}” remains attached to every search.</p>
                  {refineStatus && <div className="phi-refine-status">{refineStatus}</div>}
                </form>
              </section>

              {storyBeats.length > 0 && <section className="phi-living-section" aria-labelledby="phi-story-heading">
                <div className="phi-living-heading">
                  <div><h2 id="phi-story-heading">Story taking shape from your choices</h2></div>
                  <p>This section appears only after your orange-card or research-note choices start defining what the article should actually explain.</p>
                </div>
                <div className="phi-magazine-story">
                  {(showFullStory ? storyBeats : storyBeats.slice(0, 2)).map((beat) => <article className="phi-story-beat" key={beat.id}>
                    <div className="phi-story-copy"><h3>{beat.title}</h3><p>{beat.body}</p></div>
                    <div className="phi-story-media">{beat.imageUrl && <img src={beat.imageUrl} alt={beat.source?.title || beat.title} loading="lazy" />}</div>
                  </article>)}
                  {storyBeats.length > 2 && <button type="button" className="phi-read-more" onClick={toggleFullStory}><span>{showFullStory ? "Collapse the full story" : "Read the full article"}</span><span>{showFullStory ? "−" : "+"}</span></button>}
                </div>
              </section>}

              {evidenceCards.length > 0 && <section className="phi-living-section" aria-labelledby="phi-evidence-heading">
                <div className="phi-living-heading"><div><h2 id="phi-evidence-heading">More directions found in the research</h2></div><p>These orange cards come from the actual source material. Open one when it sounds useful; you can ignore the rest.</p></div>
                <div className="phi-orange-grid">
                  {evidenceCards.map((card) => {
                    const expanded = expandedEvidence === card.index;
                    return <article className={`phi-orange-card${expanded ? " selected" : ""}`} key={`${card.title}-${card.index}`}>
                      <button type="button" className="phi-orange-main" onClick={() => readEvidence(card)} aria-pressed={expanded}>
                        {card.imageUrl ? <img src={card.imageUrl} alt={card.source?.title || card.title} loading="lazy" /> : <div className="phi-orange-image-fallback">φ</div>}
                        <div className="phi-orange-copy"><small>{expanded ? "Reading this direction" : `Research direction ${String(card.index + 1).padStart(2, "0")}`}</small><h3>{card.title}</h3><p>{card.body}</p></div>
                      </button>
                      <div className="phi-orange-actions"><button type="button" onClick={() => readEvidence(card)}>{expanded ? "Show less" : "Read more"}</button><a href={`${appPath("phi/build")}?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(paper.query)}&resolved=${encodeURIComponent(paper.resolved)}&phone=1`}><span className="phi-card-orb">φ</span> Build from this research</a></div>
                    </article>;
                  })}
                </div>
              </section>}

              <section className="phi-living-section phi-purple-section" aria-labelledby="phi-notes-heading">
                <div className="phi-living-heading"><div><h2 id="phi-notes-heading">Research notes</h2></div><p>Purple cards are the working memory created by what you read, what you choose, and any professional keyword passes you add.</p></div>
                <div className="phi-purple-grid">
                  {researchNotes.length === 0 ? <div className="phi-purple-empty">Nothing has to be selected. Read the full story for broad notes, or tap any orange direction when something catches your interest.</div> : researchNotes.map((note, index) => {
                    const expanded = expandedNote === note.id;
                    return <article className={`phi-purple-card${expanded ? " expanded" : ""}`} key={note.id}>
                      <button type="button" className="phi-purple-main" onClick={() => setExpandedNote(expanded ? null : note.id)}><small>Research note {String(index + 1).padStart(2, "0")}{note.source ? ` · ${note.source.provider}` : ""}</small><h3>{note.title}</h3><p>{note.body}</p></button>
                      <a className="phi-purple-build" href={`${appPath("phi/build")}?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(paper.query)}&resolved=${encodeURIComponent(paper.resolved)}&phone=1`}><span className="phi-card-orb">φ</span> Expand this note in the workbench</a>
                    </article>;
                  })}
                </div>
              </section>

              <section className="phi-living-section phi-green-section" aria-labelledby="phi-sources-heading">
                <div className="phi-living-heading"><div><h2 id="phi-sources-heading">Sources</h2></div><p>{busy ? "Live source pass in progress…" : `${paper.sources.length} source records currently support this research package.`}</p></div>
                <div className="phi-green-grid">
                  {(showAllSources ? paper.sources : paper.sources.slice(0, 6)).map((source, index) => <a key={`${source.url}-${index}`} href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined} className="phi-green-card">
                    {source.imageUrl ? <img src={source.imageUrl} alt="" /> : <span className="phi-green-source-number">{index + 1}</span>}
                    <div><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p></div><ExternalLink size={16} />
                  </a>)}
                </div>
                {paper.sources.length > 6 && <button type="button" className="phi-green-more" onClick={() => setShowAllSources((value) => !value)}>{showAllSources ? "Show fewer sources" : `View all ${paper.sources.length} sources`} <ChevronDown size={16} /></button>}
              </section>

              <section className={styles.finish}>
                <a className={styles.fullSite} href={`${appPath("phi/magazine")}?id=${encodeURIComponent(paper.id)}`}><span>φ</span><div><b>Build the full website from everything</b><small>No selections are required. The original search, every refinement you added, and all current research travel into the clean publication.</small></div></a>
                <a className={styles.workbench} href={`${appPath("phi/build")}?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(paper.query)}&resolved=${encodeURIComponent(paper.resolved)}&phone=1`}><b>Open page-two workbench</b><small>Use this only when you want to select several orange directions, individual images, or purple notes before the final publication.</small></a>
              </section>

              <form onSubmit={submit} className="phi-followup"><Sparkles size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start a different subject" /><button>Search</button></form>
            </section>
          </div>
        </article>}

        <footer className="phi-credits">Infinity Phi · discovery-first contextual research · GitHub Pages</footer>
      </div>
    </main>
  );
}
