"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, ExternalLink, Image as ImageIcon, Layers3, Printer, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import styles from "./PhiWorkbench.module.css";

type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Identity = { kind?: string; name?: string; symbol?: string; number?: number };
type Paper = { id: string; query: string; resolved: string; identity?: Identity; title: string; overview: string; findings: string[]; sources: Source[]; created: number };
type Branch = { id: string; title: string; body: string; imageUrl?: string; source?: Source };
type CommonsImage = { url: string; title: string; pageUrl: string };
type Note = { id: string; title: string; body: string };
type SelectionState = {
  branches: number[];
  branchIds?: string[];
  branchBodies?: string[];
  terms: string[];
  imageUrls: string[];
  noteImages?: Record<string, string[]>;
  notes: Note[];
  deepNotes?: string[];
  updatedAt: string;
};

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SELECTION_PREFIX = "infinity_phi_selection_v2_";
const STOP = new Set(["about","after","again","against","because","before","being","between","could","every","first","from","have","into","itself","more","other","over","same","such","than","that","their","these","they","this","through","under","what","when","where","which","while","with","would","your","also","only","some","most","many","much","there","then","than","them","were","been","does","into","each","very","will"]);
const GENERIC = new Set(["chemical","element","elements","metal","metals","research","story","evidence","material","materials","properties","property","different","important","information","system","systems"]);

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item) => item.length > 45);
const words = (value: string) => clean(value).toLowerCase().match(/[a-z0-9]+/g) || [];
const keyWords = (value: string) => words(value).filter((word) => word.length > 4 && !STOP.has(word));

function wordSet(value: string) { return new Set(keyWords(value)); }
function overlap(a: string, b: string) { const left = wordSet(a); const right = wordSet(b); let score = 0; left.forEach((word) => { if (right.has(word)) score += 1; }); return score; }
function hashText(value: string) { let hash = 0; for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0; return Math.abs(hash).toString(36); }
function branchId(body: string) { return `branch-${hashText(clean(body).toLowerCase())}`; }
function shortTitle(text: string, fallback: string) {
  const clause = clean(text).split(/[.;:—]/)[0].replace(/^[^a-z0-9]+/i, "");
  if (clause.length >= 12 && clause.length <= 78) return clause;
  const key = keyWords(text).slice(0, 6).join(" ");
  return key ? key.replace(/\b\w/g, (char) => char.toUpperCase()) : fallback;
}
function dedupeSources(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => { const key = source.url || `${source.provider}:${source.title}`; if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
function dedupeLines(lines: string[], limit = 80) {
  const out: string[] = [];
  for (const raw of lines) {
    const line = clean(raw); if (!line) continue;
    const duplicate = out.some((old) => overlap(old, line) >= Math.min(7, Math.max(3, Math.floor(Math.min(keyWords(old).length, keyWords(line).length) * .68))));
    if (!duplicate) out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
function bestSource(text: string, sources: Source[]) { return [...sources].sort((a, b) => overlap(text, `${b.title} ${b.excerpt}`) - overlap(text, `${a.title} ${a.excerpt}`))[0]; }
function informationScore(text: string) {
  let score = Math.min(5, keyWords(text).length / 6);
  if (/\d/.test(text)) score += 2;
  if (/\b(measured|mintage|grade|value|temperature|density|isotope|compound|oxidation|production|population|auction|application|process|mechanism|history|structure|configuration)\b/i.test(text)) score += 2;
  if (text.length > 100 && text.length < 480) score += 1;
  return score;
}
function focusAnchors(text: string) { return [...new Set(keyWords(text).filter((word) => !GENERIC.has(word)))].slice(0, 24); }
function focusMatch(text: string, focus: string) {
  if (!focus) return 1;
  const anchors = focusAnchors(focus);
  const lower = text.toLowerCase();
  const anchorHits = anchors.filter((word) => lower.includes(word)).length;
  return overlap(text, focus) + anchorHits * 1.5;
}
function storyPool(paper: Paper, sources: Source[]) {
  return dedupeLines([
    ...sentences(paper.overview),
    ...paper.findings,
    ...sources.flatMap((source) => sentences(source.excerpt).slice(0, 4)),
  ], 100);
}
function buildStory(paper: Paper, sources: Source[], focus: string, selectedBodies: string[]) {
  const pool = storyPool(paper, sources);
  if (!focus) return pool.sort((a, b) => informationScore(b) - informationScore(a)).slice(0, 18);
  const ranked = pool
    .map((body) => ({ body, score: focusMatch(body, focus) * 5 + informationScore(body) }))
    .filter((item) => item.score >= 7 || selectedBodies.includes(item.body))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.body);
  return dedupeLines([...selectedBodies, ...ranked], 18);
}
function imageForBranch(branch: Branch, images: CommonsImage[], used: Set<string>) {
  const ranked = images.map((image) => ({ image, score: overlap(`${image.title}`, `${branch.title} ${branch.body}`) })).sort((a, b) => b.score - a.score);
  const best = ranked.find((item) => !used.has(item.image.url) && item.score > 0)?.image || images.find((image) => !used.has(image.url));
  if (best) used.add(best.url);
  return best?.url;
}
function buildBranches(story: string[], sources: Source[], images: CommonsImage[], focus: string) {
  const usedImages = new Set<string>();
  return story
    .map((body) => {
      const source = bestSource(body, sources);
      const branch: Branch = { id: branchId(body), title: shortTitle(body, "Research direction"), body, source };
      branch.imageUrl = imageForBranch(branch, images, usedImages) || source?.imageUrl;
      return branch;
    })
    .sort((a, b) => focus ? focusMatch(b.body, focus) - focusMatch(a.body, focus) : informationScore(b.body) - informationScore(a.body));
}
function noteTitle(body: string, index: number) { const title = shortTitle(body, `Research note ${index + 1}`); return title.length > 76 ? `${title.slice(0,73)}…` : title; }
function synthesizeNotes(paper: Paper, selected: Branch[], terms: string[], sources: Source[]) {
  const focus = [...selected.flatMap((branch) => [branch.title, branch.body]), ...terms].join(" ");
  if (!focus) return dedupeLines([...sentences(paper.overview), ...paper.findings], 8).map((body, index) => ({ id: `note-${hashText(body)}`, title: noteTitle(body, index), body }));
  const sourceLines = sources.flatMap((source) => sentences(source.excerpt).map((body) => ({ body, source })));
  const ranked = sourceLines
    .map((item) => ({ ...item, score: focusMatch(item.body, focus) * 5 + informationScore(item.body) }))
    .filter((item) => item.score >= 8)
    .sort((a, b) => b.score - a.score);
  const notes: Note[] = [];
  if (selected.length > 1) {
    const bridge = ranked.find((item) => selected.filter((branch) => overlap(item.body, `${branch.title} ${branch.body}`) > 0).length >= 2)?.body;
    notes.push({ id: "connection-note", title: `How ${selected.length} selected directions connect`, body: bridge || `This edition is intentionally joining ${selected.map((branch) => branch.title).slice(0,5).join("; ")}. The final article should keep those distinctions clear while emphasizing evidence that directly connects the selected ideas.` });
  }
  dedupeLines([...selected.map((branch) => branch.body), ...ranked.map((item) => item.body)], 14 - notes.length).forEach((body, index) => notes.push({ id: `note-${hashText(body)}`, title: noteTitle(body, index), body }));
  return notes;
}
function classifyWord(word: string) {
  const lower = word.toLowerCase();
  if (/design|system|process|engineer|metal|alloy|oxide|electron|atomic|chemical|material|structure|reaction|configuration|manufactur|collect|mint/.test(lower)) return styles.wordGreen;
  if (/critical|rare|risk|unstable|evidence|priority|decay|radioactive|failure|unknown/.test(lower)) return styles.wordPink;
  if (/image|source|history|market|collector|application|device|method|research|website|data|grade|value/.test(lower)) return styles.wordBlue;
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
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 5200);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=1000&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" }); if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => { const title = clean(page.title); const excerpt = clean(page.extract); if (!title || !excerpt) return []; return [{ title, excerpt, url: page.fullurl || "", provider: "Wikipedia · focused", imageUrl: page.thumbnail?.source }]; });
  } catch { return []; } finally { window.clearTimeout(timer); }
}
async function commonsSearch(query: string): Promise<CommonsImage[]> {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 6500);
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1200&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "force-cache" }); if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => { const info = page.imageinfo?.[0]; const mime = String(info?.mime || ""); if (!info?.thumburl || !mime.startsWith("image/") || /svg/i.test(mime)) return []; return [{ url: info.thumburl, title: clean(page.title).replace(/^File:/, ""), pageUrl: `https://commons.wikimedia.org/?curid=${page.pageid}` }]; });
  } catch { return []; } finally { window.clearTimeout(timer); }
}
async function initialSources(paper: Paper) {
  const prompts = [paper.query, paper.resolved, ...paper.findings.slice(0,6).map((line) => `${paper.query} ${shortTitle(line,"research")}`)];
  const settled = await Promise.allSettled(prompts.map(wiki));
  return dedupeSources([...paper.sources, ...settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])]).slice(0,70);
}
async function focusSources(paper: Paper, selected: Branch[], terms: string[]) {
  const prompts = [...selected.slice(0,6).map((branch) => `${branch.title} ${keyWords(branch.body).slice(0,8).join(" ")}`), ...terms.slice(-8)].filter(Boolean);
  if (!prompts.length) return [];
  const settled = await Promise.allSettled(prompts.map((prompt) => wiki(prompt)));
  const focus = [...selected.flatMap((branch) => [branch.title, branch.body]), ...terms].join(" ");
  return dedupeSources(settled.flatMap((result) => result.status === "fulfilled" ? result.value : []))
    .filter((source) => focusMatch(`${source.title} ${source.excerpt}`, focus) >= 3)
    .slice(0,55);
}
async function collectImages(paper: Paper, story: string[], focus: string) {
  const prompts = [focus || paper.query, ...story.slice(0,12).map((body) => shortTitle(body, ""))].filter(Boolean).slice(0,14);
  const settled = await Promise.allSettled(prompts.map(commonsSearch));
  const seen = new Set<string>();
  return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((image) => { if (!image.url || seen.has(image.url)) return false; seen.add(image.url); return true; }).slice(0,120);
}

export default function PhiWorkbenchV3() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [images, setImages] = useState<CommonsImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [noteImages, setNoteImages] = useState<Record<string,string[]>>({});
  const [showAllCards, setShowAllCards] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search); const id = params.get("id") || ""; const parentId = id.split("-note-")[0]; const query = clean(params.get("q")); const resolved = clean(params.get("resolved")) || query;
    if (!id && !query) { setError("No research package was supplied."); setLoading(false); return; }
    void (async () => {
      let exact: Paper | null = null;
      for (const candidate of [id,parentId]) {
        if (!candidate || exact) continue;
        exact = secureLoad<Paper | null>(`${PAPER_PREFIX}${candidate}`, null, "session") || secureLoad<Paper | null>(`${PAPER_PREFIX}${candidate}`, null);
        if (!exact) try { exact = await secureLoadDurable<Paper | null>(`${PAPER_PREFIX}${candidate}`, null); } catch {}
        if (!exact) try { exact = (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === candidate) || null; } catch {}
      }
      const value: Paper = exact || { id: parentId || id || `phi-${Date.now()}`, query, resolved, title: query || "Infinity Phi publication", overview: query ? `A working research edition built from ${query}.` : "Research edition", findings: [], sources: [], created: Date.now() };
      setPaper(value); setLoading(false); setEnriching(true);
      const expanded = await initialSources(value); setSources(expanded);
      const baseStory = buildStory(value, expanded, "", []);
      const visualPool = await collectImages(value, baseStory, ""); setImages(visualPool);
      const stored = secureLoad<SelectionState | null>(`${SELECTION_PREFIX}${value.id}`, null) || await secureLoadDurable<SelectionState | null>(`${SELECTION_PREFIX}${value.id}`, null).catch(() => null);
      if (stored) {
        const baseBranches = buildBranches(baseStory, expanded, visualPool, "");
        const ids = stored.branchIds?.length ? stored.branchIds : (stored.branchBodies || []).map(branchId);
        setSelectedIds(ids.length ? ids : (stored.branches || []).map((index) => baseBranches[index]?.id).filter(Boolean));
        setSelectedTerms(stored.terms || []); setSelectedImages(stored.imageUrls || []); setNoteImages(stored.noteImages || {});
      }
      setEnriching(false);
    })();
  }, []);

  const baseStory = useMemo(() => paper ? buildStory(paper, sources, "", []) : [], [paper,sources]);
  const baseBranches = useMemo(() => buildBranches(baseStory, sources, images, ""), [baseStory,sources,images]);
  const selectedBranches = useMemo(() => selectedIds.map((id) => baseBranches.find((branch) => branch.id === id)).filter(Boolean) as Branch[], [selectedIds,baseBranches]);
  const focus = useMemo(() => [...selectedBranches.flatMap((branch) => [branch.title,branch.body]), ...selectedTerms].join(" "), [selectedBranches,selectedTerms]);
  const focusedStory = useMemo(() => paper ? buildStory(paper, sources, focus, selectedBranches.map((branch) => branch.body)) : [], [paper,sources,focus,selectedBranches]);
  const frontier = useMemo(() => buildBranches(focusedStory, sources, images, focus), [focusedStory,sources,images,focus]);
  const notes = useMemo(() => paper ? synthesizeNotes(paper, selectedBranches, selectedTerms, sources) : [], [paper,selectedBranches,selectedTerms,sources]);
  const visibleBranches = useMemo(() => {
    if (showAllCards) return baseBranches;
    const unseen = frontier.filter((branch) => !selectedIds.includes(branch.id));
    return unseen.slice(0, Math.max(5, 10 - Math.min(selectedIds.length,5)));
  }, [showAllCards,baseBranches,frontier,selectedIds]);

  useEffect(() => {
    if (!paper || (!selectedIds.length && !selectedTerms.length)) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setEnriching(true);
        const focused = await focusSources(paper, selectedBranches, selectedTerms);
        if (focused.length) setSources((current) => dedupeSources([...focused,...current]).slice(0,90));
        const story = buildStory(paper, dedupeSources([...focused,...sources]), focus, selectedBranches.map((branch) => branch.body));
        const moreImages = await collectImages(paper, story, focus);
        if (moreImages.length) setImages((current) => { const seen = new Set<string>(); return [...moreImages,...current].filter((image) => !seen.has(image.url) && seen.add(image.url)).slice(0,120); });
        setEnriching(false);
      })();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [paper, selectedIds.join("|"), selectedTerms.join("|")]);

  useEffect(() => {
    if (!paper) return;
    const state: SelectionState = { branches: [], branchIds: selectedIds, branchBodies: selectedBranches.map((branch) => branch.body), terms: selectedTerms, imageUrls: selectedImages, noteImages, notes, updatedAt: new Date().toISOString() };
    secureSave(`${SELECTION_PREFIX}${paper.id}`, state);
    const timer = window.setTimeout(() => void secureSaveDurable(`${SELECTION_PREFIX}${paper.id}`, state).catch(() => undefined), 280);
    return () => window.clearTimeout(timer);
  }, [paper,selectedIds,selectedBranches,selectedTerms,selectedImages,noteImages,notes]);

  function toggleBranch(branch: Branch) { setSelectedIds((current) => current.includes(branch.id) ? current.filter((id) => id !== branch.id) : [...current,branch.id].slice(-12)); setShowAllCards(false); }
  function toggleTerm(term: string) { setSelectedTerms((current) => current.includes(term) ? current.filter((value) => value !== term) : [...current,term].slice(-28)); }
  function toggleImage(url: string) { setSelectedImages((current) => current.includes(url) ? current.filter((value) => value !== url) : [...current,url].slice(-60)); }
  function assignImage(noteId: string, url: string) { if (!url) return; setNoteImages((current) => ({ ...current, [noteId]: [...new Set([...(current[noteId] || []),url])].slice(0,4) })); }
  function autoAlign() {
    const pool = (selectedImages.length ? images.filter((image) => selectedImages.includes(image.url)) : images).slice(0,50);
    const used = new Set<string>(); const next: Record<string,string[]> = {};
    notes.forEach((note) => {
      const ranked = pool.map((image) => ({ image, score: overlap(image.title, `${note.title} ${note.body}`) })).sort((a,b) => b.score-a.score);
      const picks = ranked.filter((item) => !used.has(item.image.url)).slice(0,3).map((item) => item.image.url);
      picks.forEach((url) => used.add(url)); next[note.id] = picks;
    });
    setSelectedImages(pool.map((image) => image.url)); setNoteImages(next);
  }

  if (loading) return <main className={styles.loading}>Opening page two…</main>;
  if (error || !paper) return <main className={styles.error}><a href={appPath("phi")}><ArrowLeft size={18}/> Back</a><h1>Research package unavailable</h1><p>{error}</p></main>;

  const hero = selectedImages[0] || images[0]?.url || sources.find((source) => source.imageUrl)?.imageUrl;
  const magazineUrl = `${appPath("phi/magazine")}?id=${encodeURIComponent(paper.id)}`;
  const latestSelectedImage = selectedImages[selectedImages.length-1] || "";

  return <main className={styles.page}>
    <header className={styles.topbar}><a href={`${appPath("phi")}?id=${encodeURIComponent(paper.id)}`}><ArrowLeft size={20}/></a><div><b>Infinity Phi workbench</b><small>{enriching ? "Reshaping the story and finding the next useful branches…" : `${visibleBranches.length} live directions · ${notes.length} notes · ${images.length} distinct images`}</small></div><a className={styles.publishTop} href={magazineUrl}><Printer size={17}/> Page 3</a></header>

    <section className={styles.hero}>{hero && <img src={hero} alt=""/>}<div className={styles.heroShade}/><div className={styles.heroCopy}><small>PAGE TWO · WORKING RESEARCH</small><h1>{paper.title}</h1><p>{focus ? focusedStory.slice(0,2).join(" ") : paper.overview}</p></div></section>

    <div className={styles.layout}>
      <aside className={styles.meta}><span>Research package</span><b>{paper.id}</b><span>Identity</span><b>{paper.resolved}</b><span>Build scope</span><b>{selectedIds.length ? `${selectedIds.length} connected directions` : "Complete subject"}</b><span>Builder status</span><b>{enriching ? "Reshaping" : "Ready"}</b><span>Images available</span><b>{images.length}</b><span>Images chosen</span><b>{selectedImages.length}</b></aside>

      <div className={styles.work}>
        <section className={styles.storyboard}>
          <div className={styles.sectionHead}><div><BookOpen size={20}/><h2>The full working story</h2></div><p>{focus ? "Your orange choices have changed the story order. Only material that still connects strongly to the chosen direction is being promoted." : "This is the broad first read. The orange cards below are cut from this story so you can discover what deserves more attention."}</p></div>
          <div className={styles.storyFrames}>{focusedStory.slice(0,10).map((body,index) => <article key={`${hashText(body)}-${index}`}>{images[index]?.url && <img src={images[index].url} alt="" loading={index>1?"lazy":"eager"}/>}<div><small>STORY {String(index+1).padStart(2,"0")}</small><h3>{shortTitle(body,`Story section ${index+1}`)}</h3><p>{body}</p></div></article>)}</div>
        </section>

        <section>
          <div className={styles.sectionHead}><div><Layers3 size={20}/><h2>Orange research frontier</h2></div><p>Choose what matters. Unused cards recede while new cards are researched from what you chose. Nothing is deleted; View all cards restores the broad deck.</p></div>
          {selectedBranches.length > 0 && <div className={styles.selectionLine}>{selectedBranches.map((branch) => <button key={branch.id} onClick={() => toggleBranch(branch)}>✓ {branch.title} ×</button>)}</div>}
          <div style={{display:"flex",gap:10,margin:"0 0 18px",flexWrap:"wrap"}}><button type="button" onClick={() => setShowAllCards((value) => !value)} style={{border:0,borderRadius:999,padding:"10px 14px",fontWeight:900,cursor:"pointer",background:showAllCards?"#17202b":"#fff",color:showAllCards?"#fff":"#17202b",boxShadow:"0 6px 18px rgba(20,40,70,.10)"}}>{showAllCards ? "Return to live frontier" : `View all ${baseBranches.length} cards`}</button>{enriching && <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:13,color:"#6b2f85"}}><Sparkles size={15}/> New connecting cards are being researched…</span>}</div>
          <div className={styles.orangeGrid}>{visibleBranches.map((branch) => {
            const imageSelected = Boolean(branch.imageUrl && selectedImages.includes(branch.imageUrl));
            return <article key={branch.id} className={styles.orangeCard}>
              <button type="button" className={styles.imageButton} onClick={() => branch.imageUrl && toggleImage(branch.imageUrl)} aria-pressed={imageSelected}>{branch.imageUrl ? <img src={branch.imageUrl} alt={branch.title} loading="lazy"/> : <span><ImageIcon size={30}/></span>}<em>{imageSelected ? "Image selected" : "Tap image to keep it"}</em></button>
              <div className={styles.orangeBody}><button type="button" className={styles.branchToggle} onClick={() => toggleBranch(branch)}><small><Check size={14}/> ADD THIS DIRECTION</small><h3>{branch.title}</h3></button><InteractiveText text={branch.body} selectedTerms={selectedTerms} onTerm={toggleTerm}/>{branch.source?.url && <a href={branch.source.url} target="_blank" rel="noreferrer">Source <ExternalLink size={14}/></a>}</div>
            </article>;
          })}</div>
        </section>

        <section className={styles.purpleSection}>
          <div className={styles.sectionHead}><div><span className={styles.phi}>φ</span><h2>Purple research notes</h2></div><p>{selectedBranches.length ? "These notes are now the controlling brief for page three. Broad source material that does not support these notes will be stripped away." : "Broad notes are available now. Choosing orange directions makes these increasingly specific."}</p></div>
          <div className={styles.selectionLine}>{selectedTerms.length ? selectedTerms.map((term) => <button key={term} onClick={() => toggleTerm(term)}>{term} ×</button>) : <span>No colored words selected yet.</span>}</div>
          <div className={styles.purpleGrid}>{notes.map((note,index) => <article key={note.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); assignImage(note.id,event.dataTransfer.getData("text/plain")); }}>
            {(noteImages[note.id] || []).length > 0 && <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(3,(noteImages[note.id]||[]).length)},1fr)`,gap:5,marginBottom:12}}>{(noteImages[note.id]||[]).map((url) => <img key={url} src={url} alt="" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:10}}/>)}</div>}
            <small>NOTE {String(index+1).padStart(2,"0")}</small><h3>{note.title}</h3><p>{note.body}</p>{latestSelectedImage && <button type="button" onClick={() => assignImage(note.id,latestSelectedImage)} style={{marginTop:12,border:"1px solid rgba(255,255,255,.35)",borderRadius:999,padding:"7px 10px",background:"rgba(255,255,255,.12)",color:"white",fontWeight:800}}>Place last selected image here</button>}
          </article>)}</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}><button type="button" onClick={autoAlign} style={{border:0,borderRadius:16,padding:"13px 16px",background:"#75419a",color:"white",fontWeight:900,cursor:"pointer"}}>AI align the best 50 images to these notes</button></div>
          <a className={styles.printButton} href={magazineUrl}><span>φ</span><div><b>Print the clean website from the purple brief</b><small>Page three now treats these notes as the authority. Unrelated parent material is discarded instead of leaking back into the website.</small></div></a>
        </section>

        <section>
          <div className={styles.sectionHead}><div><ImageIcon size={20}/><h2>Visual library</h2></div><p>{images.length >= 50 ? `${images.length} distinct candidates are available. Tap to keep images, drag them onto purple notes on desktop, or use AI alignment.` : `Collecting toward a 50+ image working pool… ${images.length} found.`}</p></div>
          <div className={styles.visualGrid}>{images.slice(0,80).map((image) => { const selected = selectedImages.includes(image.url); return <button draggable type="button" key={image.url} className={selected?styles.visualSelected:""} onDragStart={(event) => event.dataTransfer.setData("text/plain",image.url)} onClick={() => toggleImage(image.url)}><img src={image.url} alt={image.title} loading="lazy"/><span>{selected?"Selected":image.title}</span></button>; })}</div>
        </section>

        <section className={styles.sources}><div className={styles.sectionHead}><div><h2>Green sources</h2></div><p>{sources.length} records are available to the workbench; page three will keep only those that support the purple brief.</p></div><div className={styles.sourceGrid}>{sources.slice(0,30).map((source,index) => <a key={`${source.url}-${index}`} href={source.url||"#"} target={source.url?"_blank":undefined} rel={source.url?"noreferrer":undefined}><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p></a>)}</div></section>
      </div>
    </div>
  </main>;
}
