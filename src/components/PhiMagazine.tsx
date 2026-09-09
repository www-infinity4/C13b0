"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import styles from "./PhiMagazine.module.css";

type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Identity = { kind?: string; name?: string; symbol?: string; number?: number };
type Paper = { id: string; query: string; resolved: string; identity?: Identity; title: string; overview: string; findings: string[]; sources: Source[]; created: number };
type Note = { id: string; title: string; body: string };
type SelectionState = { branches: number[]; terms: string[]; imageUrls: string[]; notes: Note[]; deepNotes?: string[]; updatedAt: string };
type CommonsImage = { url: string; title: string; pageUrl: string };
type Section = { id: string; title: string; body: string; images: CommonsImage[]; source?: Source };

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SELECTION_PREFIX = "infinity_phi_selection_v2_";
const STOP = new Set(["about","after","again","against","because","before","being","between","could","every","first","from","have","into","itself","more","other","over","same","such","than","that","their","these","they","this","through","under","what","when","where","which","while","with","would","your","also","only","some","most","many","much"]);

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item) => item.length > 45);
const words = (value: string) => clean(value).toLowerCase().match(/[a-z0-9]+/g) || [];
function wordSet(value: string) { return new Set(words(value).filter((word) => word.length > 4 && !STOP.has(word))); }
function overlap(a: string, b: string) { const left = wordSet(a); const right = wordSet(b); let score = 0; left.forEach((word) => { if (right.has(word)) score += 1; }); return score; }
function shortTitle(text: string, fallback: string) {
  const clause = clean(text).split(/[.;:—]/)[0].replace(/^[^a-z0-9]+/i, "");
  if (clause.length >= 12 && clause.length <= 76) return clause;
  const key = words(text).filter((word) => word.length > 4 && !STOP.has(word)).slice(0, 6).join(" ");
  return key ? key.replace(/\b\w/g, (char) => char.toUpperCase()) : fallback;
}
function bestSource(text: string, sources: Source[]) { return [...sources].sort((a, b) => overlap(text, `${b.title} ${b.excerpt}`) - overlap(text, `${a.title} ${a.excerpt}`))[0]; }

async function wiki(query: string): Promise<Source[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=1000&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const title = clean(page.title); const excerpt = clean(page.extract);
      if (!title || !excerpt) return [];
      return [{ title, excerpt, url: page.fullurl || "", provider: "Wikipedia", imageUrl: page.thumbnail?.source }];
    });
  } catch { return []; }
  finally { window.clearTimeout(timer); }
}

async function commonsSearch(query: string): Promise<CommonsImage[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6500);
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=40&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1200&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const info = page.imageinfo?.[0];
      const mime = String(info?.mime || "");
      if (!info?.thumburl || !mime.startsWith("image/") || /svg/i.test(mime)) return [];
      return [{ url: info.thumburl, title: clean(page.title).replace(/^File:/, ""), pageUrl: `https://commons.wikimedia.org/?curid=${page.pageid}` }];
    });
  } catch { return []; }
  finally { window.clearTimeout(timer); }
}

function editionTitle(paper: Paper, selection: SelectionState) {
  const subject = clean(paper.identity?.name || paper.query).replace(/[?.!]+$/, "");
  const deep = (selection.deepNotes || []).filter(Boolean);
  if (deep.length) return `${subject}: ${shortTitle(deep[0], "A Closer Reading")}`;
  if (selection.notes?.length >= 2) return `${subject}: Connecting ${shortTitle(selection.notes[0].title, "the evidence")} and ${shortTitle(selection.notes[1].title, "the wider story")}`;
  if (selection.notes?.length === 1) return `${subject}: ${shortTitle(selection.notes[0].title, "The Story in Focus")}`;
  return paper.title || `${subject}: A Complete Guide`;
}

function buildStoryMaterial(paper: Paper, selection: SelectionState, sources: Source[]) {
  const deep = (selection.deepNotes || []).map(clean).filter(Boolean);
  const selectedNotes = (selection.notes || []).map((note) => clean(note.body)).filter(Boolean);
  const focusText = [...deep, ...selectedNotes, ...selection.terms].join(" ");
  const sourceLines = sources.flatMap((source) => sentences(source.excerpt));
  const ranked = focusText ? [...sourceLines].sort((a, b) => overlap(b, focusText) - overlap(a, focusText)) : sourceLines;
  const material = deep.length
    ? [...deep, ...ranked, ...selectedNotes, ...paper.findings]
    : [...sentences(paper.overview), ...selectedNotes, ...paper.findings, ...ranked];
  const seen = new Set<string>();
  return material.map(clean).filter((line) => {
    const key = line.slice(0, 150).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, deep.length ? 18 : 30);
}

async function collectSources(paper: Paper, selection: SelectionState) {
  const prompts = [paper.resolved, paper.query, ...selection.terms.slice(0, 6).map((term) => `${paper.query} ${term}`), ...(selection.notes || []).slice(0, 5).map((note) => `${paper.query} ${note.title}`)];
  const settled = await Promise.allSettled(prompts.slice(0, 10).map(wiki));
  const seen = new Set<string>();
  return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((source) => {
    const key = source.url || source.title.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 55);
}

async function collectImages(paper: Paper, selection: SelectionState, material: string[]) {
  const prompts = [
    paper.query,
    paper.resolved,
    ...selection.terms.slice(0, 6).map((term) => `${paper.query} ${term}`),
    ...material.slice(0, 8).map((line) => `${paper.query} ${shortTitle(line, "")}`),
  ].filter(Boolean).slice(0, 15);
  const settled = await Promise.allSettled(prompts.map(commonsSearch));
  const preferred = (selection.imageUrls || []).map((url, index) => ({ url, title: `Selected image ${index + 1}`, pageUrl: "" }));
  const seen = new Set<string>();
  return [...preferred, ...settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])].filter((image) => {
    if (!image.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  }).slice(0, 84);
}

function makeSections(material: string[], sources: Source[], images: CommonsImage[]) {
  const count = Math.min(30, material.length);
  const imageTarget = Math.min(images.length, Math.max(50, count * 2));
  const perSection = count ? Math.max(2, Math.min(6, Math.ceil(imageTarget / count))) : 2;
  let cursor = 1;
  return material.slice(0, count).map((body, index): Section => {
    const source = bestSource(body, sources);
    const sectionImages = images.slice(cursor, cursor + perSection);
    cursor += perSection;
    return { id: `section-${index}`, title: shortTitle(body, `A closer look ${index + 1}`), body, images: sectionImages, source };
  });
}

export default function PhiMagazine() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [selection, setSelection] = useState<SelectionState>({ branches: [], terms: [], imageUrls: [], notes: [], deepNotes: [], updatedAt: "" });
  const [extraSources, setExtraSources] = useState<Source[]>([]);
  const [images, setImages] = useState<CommonsImage[]>([]);
  const [openStory, setOpenStory] = useState(false);
  const [chosenCards, setChosenCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "";
    if (!id) { setLoading(false); return; }
    void (async () => {
      let exact = secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null, "session") || secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null);
      if (!exact) { try { exact = await secureLoadDurable<Paper | null>(`${PAPER_PREFIX}${id}`, null); } catch {} }
      if (!exact) { try { exact = (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === id) || null; } catch {} }
      if (!exact) { setLoading(false); return; }
      const saved = secureLoad<SelectionState | null>(`${SELECTION_PREFIX}${exact.id}`, null) || await secureLoadDurable<SelectionState | null>(`${SELECTION_PREFIX}${exact.id}`, null).catch(() => null);
      const nextSelection = saved || { branches: [], terms: [], imageUrls: [], notes: [], deepNotes: [], updatedAt: "" };
      setPaper(exact);
      setSelection(nextSelection);
      setChosenCards(nextSelection.deepNotes || []);
      const sources = await collectSources(exact, nextSelection);
      setExtraSources(sources);
      const material = buildStoryMaterial(exact, nextSelection, [...exact.sources, ...sources]);
      const visualPool = await collectImages(exact, nextSelection, material);
      setImages(visualPool);
      setLoading(false);
    })();
  }, []);

  const allSources = useMemo(() => paper ? [...paper.sources, ...extraSources] : [], [paper, extraSources]);
  const material = useMemo(() => paper ? buildStoryMaterial(paper, selection, allSources) : [], [paper, selection, allSources]);
  const sections = useMemo(() => makeSections(material, allSources, images), [material, allSources, images]);

  function toggleCard(body: string) {
    setChosenCards((current) => current.includes(body) ? current.filter((item) => item !== body) : [...current, body].slice(-12));
  }

  async function printDeeperEdition() {
    if (!paper || !chosenCards.length) return;
    const next: SelectionState = { ...selection, deepNotes: chosenCards, notes: chosenCards.map((body, index) => ({ id: `deep-${index}`, title: shortTitle(body, `Selected idea ${index + 1}`), body })), updatedAt: new Date().toISOString() };
    setSelection(next);
    secureSave(`${SELECTION_PREFIX}${paper.id}`, next);
    try { await secureSaveDurable(`${SELECTION_PREFIX}${paper.id}`, next); } catch {}
    location.assign(`${appPath("phi/magazine")}?id=${encodeURIComponent(paper.id)}&edition=${Date.now()}`);
  }

  if (loading) return <main className={styles.loading}>Preparing the publication…</main>;
  if (!paper) return <main className={styles.loading}><a href={appPath("phi")}>Return to Infinity Phi</a></main>;

  const title = editionTitle(paper, selection);
  const hero = images[0]?.url || selection.imageUrls?.[0] || allSources.find((source) => source.imageUrl)?.imageUrl;
  const storyParagraphs = material.slice(0, openStory ? 14 : 4);

  return <main className={styles.site}>
    <header className={styles.header}>
      <a className={styles.brand} href={appPath("")}>Infinity</a>
      <nav><a href="#story">Story</a><a href="#explore">Explore</a><a href="#sources">Sources</a></nav>
    </header>

    <section className={styles.hero}>
      {hero && <img src={hero} alt="" />}
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}>
        <small>{paper.query}</small>
        <h1>{title}</h1>
        <p>{selection.deepNotes?.length ? `A closer edition shaped around ${selection.deepNotes.length} selected ideas.` : paper.overview}</p>
      </div>
    </section>

    <article className={styles.article}>
      <section id="story" className={styles.fullStory}>
        <div className={styles.eyebrow}>The full story</div>
        <h2>{selection.deepNotes?.length ? "A narrower path through the evidence" : "The subject, connected from beginning to end"}</h2>
        <div className={styles.storyText}>{storyParagraphs.map((paragraph, index) => <p key={index} className={index === 0 ? styles.lead : ""}>{paragraph}</p>)}</div>
        {material.length > 4 && <button type="button" className={styles.readMore} onClick={() => setOpenStory((value) => !value)}>{openStory ? "Show less" : "Read more"} <ChevronDown size={17} className={openStory ? styles.rotate : ""} /></button>}
      </section>

      <section id="explore" className={styles.explore}>
        <div className={styles.eyebrow}>Explore the ideas</div>
        <h2>See each part on its own, then decide what deserves a deeper edition.</h2>
        <div className={styles.cards}>{sections.map((section, index) => {
          const chosen = chosenCards.includes(section.body);
          return <article key={section.id} className={`${styles.card} ${chosen ? styles.cardChosen : ""}`} onClick={() => toggleCard(section.body)}>
            <div className={styles.cardMedia}>
              {section.images.length ? <div className={styles.imageMosaic}>{section.images.map((image, imageIndex) => <img key={image.url} src={image.url} alt={image.title} loading={index < 2 && imageIndex === 0 ? "eager" : "lazy"} />)}</div> : <div className={styles.imageFallback}>φ</div>}
              <button type="button" className={styles.cardPhi} aria-label={`Add ${section.title} to the next edition`} onClick={(event) => { event.stopPropagation(); toggleCard(section.body); }}>φ</button>
            </div>
            <div className={styles.cardCopy}><small>{String(index + 1).padStart(2,"0")}</small><h3>{section.title}</h3><p>{section.body}</p>{section.source?.url && <a href={section.source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Read source <ExternalLink size={14} /></a>}</div>
          </article>;
        })}</div>
      </section>

      <section className={styles.noteSection}>
        <div className={styles.noteHead}><span>φ</span><div><div className={styles.eyebrow}>Your selected reading path</div><h2>{chosenCards.length ? `${chosenCards.length} ideas are ready for a deeper edition.` : "Tap article cards to collect the ideas you want to connect."}</h2></div></div>
        {chosenCards.length > 0 && <div className={styles.noteGrid}>{chosenCards.map((body, index) => <button type="button" key={`${body}-${index}`} onClick={() => toggleCard(body)}><small>SELECTED {String(index + 1).padStart(2,"0")}</small><b>{shortTitle(body, `Idea ${index + 1}`)}</b><p>{body}</p></button>)}</div>}
        <button type="button" className={styles.deepButton} disabled={!chosenCards.length} onClick={() => void printDeeperEdition()}><span>φ</span><div><b>Create a deeper magazine from these selected ideas</b><small>For example, choose 5 points from a 30-part article and the next edition will go much further into those 5.</small></div></button>
      </section>

      <section id="sources" className={styles.sources}>
        <div className={styles.eyebrow}>Sources</div>
        <h2>Where the information came from</h2>
        <div className={styles.sourceGrid}>{allSources.slice(0, 30).map((source, index) => <a key={`${source.url}-${index}`} href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined}><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p><ExternalLink size={15} /></a>)}</div>
      </section>
    </article>

    <footer className={styles.footer}><b>Infinity</b><span>{images.length >= 50 ? `${Math.min(images.length,84)} distinct images available across this edition.` : "Additional distinct images continue to load when available from the visual sources."}</span></footer>
  </main>;
}
