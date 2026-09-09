"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, ExternalLink, Image as ImageIcon, Layers3, Printer, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import styles from "./PhiWorkbench.module.css";

type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Identity = { kind?: string; name?: string; symbol?: string; number?: number };
type Paper = {
  id: string;
  query: string;
  resolved: string;
  identity?: Identity;
  title: string;
  overview: string;
  findings: string[];
  sources: Source[];
  created: number;
};
type Branch = { index: number; title: string; body: string; imageUrl?: string; source?: Source };
type CommonsImage = { url: string; title: string; pageUrl: string };
type Note = { id: string; title: string; body: string };
type SelectionState = {
  branches: number[];
  terms: string[];
  imageUrls: string[];
  notes: Note[];
  deepNotes?: string[];
  updatedAt: string;
};

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SELECTION_PREFIX = "infinity_phi_selection_v2_";
const STOP = new Set(["about","after","again","against","because","before","being","between","could","every","first","from","have","into","itself","more","other","over","same","such","than","that","their","these","they","this","through","under","what","when","where","which","while","with","would","your","also","only","some","most","many","much"]);

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item) => item.length > 45);
const words = (value: string) => clean(value).toLowerCase().match(/[a-z0-9]+/g) || [];

function wordSet(value: string) {
  return new Set(words(value).filter((word) => word.length > 4 && !STOP.has(word)));
}

function overlap(a: string, b: string) {
  const left = wordSet(a);
  const right = wordSet(b);
  let score = 0;
  left.forEach((word) => { if (right.has(word)) score += 1; });
  return score;
}

function bestSource(text: string, sources: Source[]) {
  return [...sources].sort((a, b) => overlap(text, `${b.title} ${b.excerpt}`) - overlap(text, `${a.title} ${a.excerpt}`))[0];
}

function shortTitle(text: string, fallback: string) {
  const clause = clean(text).split(/[.;:—]/)[0].replace(/^[^a-z0-9]+/i, "");
  if (clause.length >= 12 && clause.length <= 78) return clause;
  const key = words(text).filter((word) => word.length > 4 && !STOP.has(word)).slice(0, 5).join(" ");
  return key ? key.replace(/\b\w/g, (char) => char.toUpperCase()) : fallback;
}

function buildBranches(paper: Paper, extraSources: Source[]): Branch[] {
  const material = [
    ...paper.findings,
    ...paper.sources.flatMap((source) => sentences(source.excerpt).slice(0, 2)),
    ...extraSources.flatMap((source) => sentences(source.excerpt).slice(0, 2)),
  ].map(clean).filter(Boolean);
  const seen = new Set<string>();
  const unique = material.filter((line) => {
    const key = line.slice(0, 150).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
  return unique.map((body, index) => {
    const source = bestSource(body, [...paper.sources, ...extraSources]);
    return { index, title: shortTitle(body, `Direction ${index + 1}`), body, source };
  });
}

function noteTitle(body: string, index: number) {
  const clause = shortTitle(body, `Research note ${index + 1}`);
  return clause.length > 72 ? `${clause.slice(0, 69)}…` : clause;
}

function synthesizeNotes(paper: Paper, branches: Branch[], selectedBranches: number[], selectedTerms: string[], sources: Source[]) {
  const chosen = selectedBranches.map((index) => branches[index]).filter(Boolean);
  const focusText = [paper.query, ...chosen.flatMap((branch) => [branch.title, branch.body]), ...selectedTerms].join(" ");
  const sourceLines = sources.flatMap((source) => sentences(source.excerpt).map((body) => ({ body, source })));
  const ranked = sourceLines.sort((a, b) => overlap(b.body, focusText) - overlap(a.body, focusText));
  const base = chosen.length
    ? [...chosen.map((branch) => branch.body), ...ranked.map((item) => item.body)]
    : [...sentences(paper.overview), ...paper.findings, ...ranked.map((item) => item.body)];
  const seen = new Set<string>();
  const unique = base.filter((body) => {
    const key = clean(body).slice(0, 150).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const notes: Note[] = [];
  if (chosen.length > 1) {
    const names = chosen.slice(0, 5).map((branch) => branch.title).join(" · ");
    const bridge = ranked.find((item) => chosen.filter((branch) => overlap(item.body, branch.body) > 0).length >= 2)?.body;
    notes.push({
      id: "connection-note",
      title: `Connection across ${chosen.length} selected directions`,
      body: bridge || `The working edition is deliberately combining ${names}. The next publication should preserve the distinctions while explaining where these selected directions reinforce one another.`,
    });
  }
  unique.slice(0, 13 - notes.length).forEach((body, index) => notes.push({ id: `note-${index}-${Math.abs(body.length)}`, title: noteTitle(body, index), body }));
  return notes;
}

function classifyWord(word: string) {
  const lower = word.toLowerCase();
  if (/design|system|process|engineer|metal|alloy|oxide|electron|atomic|chemical|material|structure|reaction|configuration|manufactur|collect|mint/.test(lower)) return styles.wordGreen;
  if (/critical|rare|risk|unstable|evidence|priority|decay|radioactive|failure|unknown/.test(lower)) return styles.wordPink;
  if (/image|source|history|market|collector|application|device|method|research|website|data/.test(lower)) return styles.wordBlue;
  return styles.wordYellow;
}

function InteractiveText({ text, selectedTerms, onTerm }: { text: string; selectedTerms: string[]; onTerm: (term: string) => void }) {
  const parts = text.split(/(\b[A-Za-z0-9][A-Za-z0-9-]{3,}\b)/g);
  return <p className={styles.interactiveText}>{parts.map((part, index) => {
    const normalized = part.toLowerCase();
    const clickable = /^[A-Za-z0-9][A-Za-z0-9-]{3,}$/.test(part) && part.length > 4 && !STOP.has(normalized);
    if (!clickable) return <span key={`${part}-${index}`}>{part}</span>;
    const active = selectedTerms.includes(normalized);
    return <button type="button" key={`${part}-${index}`} className={`${styles.wordButton} ${classifyWord(part)} ${active ? styles.wordActive : ""}`} onClick={(event) => { event.stopPropagation(); onTerm(normalized); }}>{part}</button>;
  })}</p>;
}

async function wiki(query: string): Promise<Source[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=900&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const title = clean(page.title);
      const excerpt = clean(page.extract);
      if (!title || !excerpt) return [];
      return [{ title, excerpt, url: page.fullurl || "", provider: "Wikipedia · expanded", imageUrl: page.thumbnail?.source }];
    });
  } catch { return []; }
  finally { window.clearTimeout(timer); }
}

async function expandSources(paper: Paper) {
  const prompts = [paper.resolved, paper.query, ...paper.findings.slice(0, 6).map((finding) => `${paper.query} ${shortTitle(finding, "research")}`)];
  const settled = await Promise.allSettled(prompts.map(wiki));
  const seen = new Set<string>();
  return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((source) => {
    const key = source.url || source.title.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 45);
}

async function commonsSearch(query: string): Promise<CommonsImage[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=35&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1000&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl || !String(info.mime || "").startsWith("image/") || /svg/i.test(info.mime || "")) return [];
      return [{ url: info.thumburl, title: clean(page.title).replace(/^File:/, ""), pageUrl: `https://commons.wikimedia.org/?curid=${page.pageid}` }];
    });
  } catch { return []; }
  finally { window.clearTimeout(timer); }
}

async function collectImages(paper: Paper, branches: Branch[]) {
  const prompts = [
    paper.query,
    paper.resolved,
    ...branches.slice(0, 8).map((branch) => `${paper.query} ${branch.title}`),
  ];
  const settled = await Promise.allSettled(prompts.map(commonsSearch));
  const seen = new Set<string>();
  return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((image) => {
    if (!image.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  }).slice(0, 72);
}

export default function PhiWorkbench() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [extraSources, setExtraSources] = useState<Source[]>([]);
  const [images, setImages] = useState<CommonsImage[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<number[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "";
    const parentId = id.split("-note-")[0];
    const query = clean(params.get("q"));
    const resolved = clean(params.get("resolved")) || query;
    const initialFocus = Number(params.get("focus"));
    if (!id && !query) { setError("No research package was supplied."); setLoading(false); return; }
    void (async () => {
      let exact: Paper | null = null;
      for (const candidate of [id, parentId]) {
        if (!candidate || exact) continue;
        exact = secureLoad<Paper | null>(`${PAPER_PREFIX}${candidate}`, null, "session") || secureLoad<Paper | null>(`${PAPER_PREFIX}${candidate}`, null);
        if (!exact) {
          try { exact = await secureLoadDurable<Paper | null>(`${PAPER_PREFIX}${candidate}`, null); } catch {}
        }
        if (!exact) {
          try { exact = (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === candidate) || null; } catch {}
        }
      }
      const value: Paper = exact || {
        id: parentId || id || `phi-${Date.now()}`,
        query,
        resolved,
        title: query || "Infinity Phi publication",
        overview: query ? `A working research edition built from ${query}.` : "Research edition",
        findings: [],
        sources: [],
        created: Date.now(),
      };
      setPaper(value);
      const stored = secureLoad<SelectionState | null>(`${SELECTION_PREFIX}${value.id}`, null);
      if (stored) {
        setSelectedBranches(stored.branches || []);
        setSelectedTerms(stored.terms || []);
        setSelectedImages(stored.imageUrls || []);
      } else if (Number.isInteger(initialFocus) && initialFocus >= 0) setSelectedBranches([initialFocus]);
      setLoading(false);
      setEnriching(true);
      const sources = await expandSources(value);
      setExtraSources(sources);
      const preliminary = buildBranches(value, sources);
      const visualPool = await collectImages(value, preliminary);
      setImages(visualPool);
      setEnriching(false);
    })();
  }, []);

  const allSources = useMemo(() => paper ? [...paper.sources, ...extraSources] : [], [paper, extraSources]);
  const branches = useMemo(() => paper ? buildBranches(paper, extraSources).map((branch, index) => ({ ...branch, imageUrl: images[index]?.url || branch.source?.imageUrl })) : [], [paper, extraSources, images]);
  const notes = useMemo(() => paper ? synthesizeNotes(paper, branches, selectedBranches, selectedTerms, allSources) : [], [paper, branches, selectedBranches, selectedTerms, allSources]);

  useEffect(() => {
    if (!paper) return;
    const state: SelectionState = { branches: selectedBranches, terms: selectedTerms, imageUrls: selectedImages, notes, updatedAt: new Date().toISOString() };
    secureSave(`${SELECTION_PREFIX}${paper.id}`, state);
    const timer = window.setTimeout(() => { void secureSaveDurable(`${SELECTION_PREFIX}${paper.id}`, state).catch(() => undefined); }, 300);
    return () => window.clearTimeout(timer);
  }, [paper, selectedBranches, selectedTerms, selectedImages, notes]);

  function toggleBranch(index: number) {
    setSelectedBranches((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort((a, b) => a - b));
  }
  function toggleTerm(term: string) {
    setSelectedTerms((current) => current.includes(term) ? current.filter((value) => value !== term) : [...current, term].slice(-24));
  }
  function toggleImage(url: string) {
    if (!url) return;
    setSelectedImages((current) => current.includes(url) ? current.filter((value) => value !== url) : [...current, url].slice(-24));
  }

  if (loading) return <main className={styles.loading}>Opening page two…</main>;
  if (error || !paper) return <main className={styles.error}><a href={appPath("phi")}><ArrowLeft size={18} /> Back</a><h1>Research package unavailable</h1><p>{error}</p></main>;

  const hero = selectedImages[0] || images[0]?.url || allSources.find((source) => source.imageUrl)?.imageUrl;
  const magazineUrl = `${appPath("phi/magazine")}?id=${encodeURIComponent(paper.id)}`;

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <a href={`${appPath("phi")}?id=${encodeURIComponent(paper.id)}`} aria-label="Back to research"><ArrowLeft size={20} /></a>
      <div><b>Infinity Phi workbench</b><small>{enriching ? "Expanding evidence and collecting distinct visuals…" : `${branches.length} directions · ${notes.length} notes · ${images.length} distinct images`}</small></div>
      <a className={styles.publishTop} href={magazineUrl}><Printer size={17} /> Page 3</a>
    </header>

    <section className={styles.hero}>
      {hero && <img src={hero} alt="" />}
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}><small>PAGE TWO · WORKING RESEARCH</small><h1>{paper.title}</h1><p>{paper.overview}</p></div>
    </section>

    <div className={styles.layout}>
      <aside className={styles.meta}>
        <span>Research package</span><b>{paper.id}</b>
        <span>Identity</span><b>{paper.resolved}</b>
        <span>Published</span><b>{new Date(paper.created).toLocaleDateString()}</b>
        <span>Build scope</span><b>{selectedBranches.length ? `${selectedBranches.length} selected directions` : "Complete subject"}</b>
        <span>Builder status</span><b>{enriching ? "Expanding" : "Expanded"}</b>
        <span>Images chosen alone</span><b>{selectedImages.length}</b>
        <span>Words steering notes</span><b>{selectedTerms.length}</b>
      </aside>

      <div className={styles.work}>
        <section className={styles.storyboard}>
          <div className={styles.sectionHead}><div><BookOpen size={20} /><h2>Storyboard and research direction</h2></div><p>This is allowed to look like a workbench. Page three will not show this package information.</p></div>
          <div className={styles.storyFrames}>{[paper.overview, ...paper.findings.slice(0, 7)].filter(Boolean).map((body, index) => <article key={index}>
            {images[index]?.url && <img src={images[index].url} alt="" loading={index > 1 ? "lazy" : "eager"} />}
            <div><small>FRAME {String(index + 1).padStart(2, "0")}</small><h3>{shortTitle(body, `Story frame ${index + 1}`)}</h3><p>{body}</p></div>
          </article>)}</div>
        </section>

        <section>
          <div className={styles.sectionHead}><div><Layers3 size={20} /><h2>Orange directions</h2></div><p>Select as many as you want. Their combined meaning—not one exclusive focus—builds the purple notes. Colored words can steer the synthesis separately.</p></div>
          <div className={styles.orangeGrid}>{branches.map((branch) => {
            const selected = selectedBranches.includes(branch.index);
            const imageSelected = Boolean(branch.imageUrl && selectedImages.includes(branch.imageUrl));
            return <article key={branch.index} className={`${styles.orangeCard} ${selected ? styles.orangeSelected : ""}`}>
              <button type="button" className={styles.imageButton} onClick={() => branch.imageUrl && toggleImage(branch.imageUrl)} aria-pressed={imageSelected}>
                {branch.imageUrl ? <img src={branch.imageUrl} alt={branch.title} loading="lazy" /> : <span><ImageIcon size={30} /></span>}
                <em>{imageSelected ? "Image selected by itself" : "Tap image to use image alone"}</em>
              </button>
              <div className={styles.orangeBody}>
                <button type="button" className={styles.branchToggle} onClick={() => toggleBranch(branch.index)} aria-pressed={selected}><small>{selected ? <><Check size={14} /> SELECTED DIRECTION</> : `DIRECTION ${String(branch.index + 1).padStart(2, "0")}`}</small><h3>{branch.title}</h3></button>
                <InteractiveText text={branch.body} selectedTerms={selectedTerms} onTerm={toggleTerm} />
                {branch.source?.url && <a href={branch.source.url} target="_blank" rel="noreferrer">Source <ExternalLink size={14} /></a>}
              </div>
            </article>;
          })}</div>
        </section>

        <section className={styles.purpleSection}>
          <div className={styles.sectionHead}><div><span className={styles.phi}>φ</span><h2>Purple research notes</h2></div><p>{selectedBranches.length ? `These notes currently tie together ${selectedBranches.length} orange directions${selectedTerms.length ? ` plus ${selectedTerms.length} selected words` : ""}.` : "Broad baseline notes are ready; selecting orange directions will narrow and connect them."}</p></div>
          <div className={styles.selectionLine}>{selectedTerms.length ? selectedTerms.map((term) => <button key={term} onClick={() => toggleTerm(term)}>{term} ×</button>) : <span>No colored words selected yet.</span>}</div>
          <div className={styles.purpleGrid}>{notes.map((note, index) => <article key={note.id}><small>NOTE {String(index + 1).padStart(2, "0")}</small><h3>{note.title}</h3><p>{note.body}</p></article>)}</div>
          <a className={styles.printButton} href={magazineUrl}><span>φ</span><div><b>Print the clean magazine website from these notes</b><small>Page three uses the selected directions, words, and images but hides all ledger/workbench information.</small></div></a>
        </section>

        <section>
          <div className={styles.sectionHead}><div><ImageIcon size={20} /><h2>Visual direction</h2></div><p>{images.length >= 50 ? `${images.length} different images are available; none are intentionally repeated.` : `Still collecting distinct images… ${images.length} found so far.`}</p></div>
          <div className={styles.visualGrid}>{images.slice(0, 60).map((image) => {
            const selected = selectedImages.includes(image.url);
            return <button type="button" key={image.url} className={selected ? styles.visualSelected : ""} onClick={() => toggleImage(image.url)} aria-pressed={selected}><img src={image.url} alt={image.title} loading="lazy" /><span>{selected ? "Selected" : image.title}</span></button>;
          })}</div>
        </section>

        <section className={styles.sources}>
          <div className={styles.sectionHead}><div><h2>Green sources</h2></div><p>{allSources.length} source records support the workbench.</p></div>
          <div className={styles.sourceGrid}>{allSources.slice(0, 24).map((source, index) => <a key={`${source.url}-${index}`} href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined}><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p></a>)}</div>
        </section>
      </div>
    </div>
  </main>;
}
