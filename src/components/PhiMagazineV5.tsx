"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import { buildSemanticExpansionCards, dedupeSemantic, type SemanticCard } from "@/lib/phi-semantic-expansion";
import {
  magazineDeck,
  magazineHeadline,
  magazineSectionTitle,
  resolvePublicationFocus,
  verifyPublicationImage,
  verifyPublicationParagraph,
  verifyPublicationSource,
  type PublicationFocus,
  type PublicationSelection,
  type PublicationSource,
} from "@/lib/phi-publication-omni";
import PhiPublicationMenu from "@/components/PhiPublicationMenu";
import base from "./PhiMagazineV4.module.css";
import styles from "./PhiMagazineV5.module.css";

type Source = PublicationSource;
type Identity = { kind?: string; name?: string; symbol?: string; number?: number };
type Paper = { id: string; query: string; resolved: string; identity?: Identity; title: string; overview: string; findings: string[]; sources: Source[]; created: number };
type Note = { id: string; title: string; body: string };
type SelectionState = PublicationSelection & {
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
type CommonsImage = { url: string; title: string; pageUrl: string };
type StorySection = { id: string; title: string; paragraphs: string[]; images: CommonsImage[]; source?: Source };

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SELECTION_PREFIX = "infinity_phi_selection_v2_";
const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((line) => line.length > 42);
const words = (value: string) => clean(value).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [];
const STOP = new Set(["about", "after", "again", "because", "before", "being", "between", "could", "every", "first", "from", "have", "into", "itself", "more", "other", "over", "same", "such", "than", "that", "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with", "would", "your", "also", "only", "some", "most", "many", "there", "then", "were", "been", "does", "each", "very", "will", "research", "story", "article"]);
const keys = (value: string) => words(value).filter((word) => word.length > 3 && !STOP.has(word));

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

function overlap(leftText: string, rightText: string) {
  const left = new Set(keys(leftText));
  const right = new Set(keys(rightText));
  let score = 0;
  left.forEach((word) => { if (right.has(word)) score += 1; });
  return score;
}

function topTerms(value: string, limit = 5) {
  const counts = new Map<string, number>();
  keys(value).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]).map(([word]) => word).slice(0, limit);
}

function dedupeSources(items: Source[]) {
  const seen = new Set<string>();
  return items.filter((source) => {
    const key = source.url || `${source.provider}:${source.title}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeLines(items: string[], limit = 48) {
  const output: string[] = [];
  for (const raw of items) {
    const line = clean(raw);
    if (!line) continue;
    if (output.some((old) => overlap(old, line) >= Math.min(6, Math.max(3, Math.floor(Math.min(keys(old).length, keys(line).length) * 0.68))))) continue;
    output.push(line);
    if (output.length >= limit) break;
  }
  return output;
}

function findSelectedCard(cards: SemanticCard[], selection: SelectionState) {
  const ids = new Set(selection.branchIds || []);
  const byId = [...cards].reverse().find((card) => ids.has(card.key));
  if (byId) return byId;
  const bodies = selection.branchBodies || [];
  const byBody = [...cards].reverse().find((card) => bodies.some((body) => overlap(body, card.body) >= 4));
  if (byBody) return byBody;
  const terms = new Set((selection.terms || []).map((term) => term.toLowerCase()));
  return [...cards].reverse().find((card) => terms.has(card.keyword.toLowerCase()));
}

function bestSource(text: string, sources: Source[]) {
  return [...sources].sort((left, right) => overlap(`${right.title} ${right.excerpt}`, text) - overlap(`${left.title} ${left.excerpt}`, text))[0];
}

async function wiki(query: string): Promise<Source[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4800);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=14&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=900&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const title = clean(page.title);
      const excerpt = clean(page.extract);
      if (!title || !excerpt) return [];
      return [{ title, excerpt, url: page.fullurl || "", provider: "Wikipedia", imageUrl: page.thumbnail?.source }];
    });
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

async function commonsSearch(query: string, limit = 20): Promise<CommonsImage[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5200);
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const info = page.imageinfo?.[0];
      const mime = String(info?.mime || "");
      if (!info?.thumburl || !mime.startsWith("image/") || /svg/i.test(mime)) return [];
      return [{ url: info.thumburl, title: clean(page.title).replace(/^File:/, ""), pageUrl: `https://commons.wikimedia.org/?curid=${page.pageid}` }];
    });
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

async function collectSources(paper: Paper, focus: PublicationFocus, selected?: SemanticCard) {
  const prompts = [
    focus.label,
    selected?.title || "",
    selected?.body ? `${focus.label} ${topTerms(selected.body, 6).join(" ")}` : "",
    `${focus.label} biology history uses`,
    `${focus.label} mechanism`,
  ].map(clean).filter(Boolean);
  const settled = await Promise.allSettled(prompts.map(wiki));
  const fresh = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const all = dedupeSources([...(selected?.source ? [selected.source] : []), ...fresh, ...paper.sources]);
  return focus.locked ? all.filter((source) => verifyPublicationSource(source, focus)).slice(0, 54) : all.slice(0, 54);
}

function buildMaterial(paper: Paper, selection: SelectionState, sources: Source[], focus: PublicationFocus, selected?: SemanticCard) {
  const sourceLines = sources.flatMap((source) => sentences(source.excerpt));
  const candidates = [
    selected?.body || "",
    ...(selection.branchBodies || []),
    ...(selection.notes || []).flatMap((note) => [note.body]),
    ...(selection.deepNotes || []),
    ...sourceLines,
    ...paper.findings,
  ].map(clean).filter(Boolean);
  const verified = candidates.filter((line) => verifyPublicationParagraph(line, focus));
  return dedupeSemantic(dedupeLines(verified, 44), [], 34);
}

function seedImages(sources: Source[], focus: PublicationFocus, selected?: SemanticCard) {
  const candidates = [
    ...(selected?.source?.imageUrl && verifyPublicationSource(selected.source, focus) ? [{ url: selected.source.imageUrl, title: selected.source.title, pageUrl: selected.source.url }] : []),
    ...sources.flatMap((source) => source.imageUrl && verifyPublicationSource(source, focus) ? [{ url: source.imageUrl, title: source.title, pageUrl: source.url }] : []),
  ];
  const seen = new Set<string>();
  return candidates.filter((image) => image.url && !seen.has(image.url) && seen.add(image.url)).slice(0, 18);
}

function mergeImages(current: CommonsImage[], incoming: CommonsImage[], focus: PublicationFocus, limit = 72) {
  const seen = new Set<string>();
  return [...current, ...incoming]
    .filter((image) => image.url && verifyPublicationImage(image.title, focus) && !seen.has(image.url) && seen.add(image.url))
    .slice(0, limit);
}

function matchImages(text: string, images: CommonsImage[], used: Set<string>, focus: PublicationFocus, count = 1) {
  const ranked = images
    .filter((image) => !used.has(image.url) && verifyPublicationImage(image.title, focus))
    .map((image) => ({ image, score: overlap(image.title, `${focus.label} ${text}`) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
  const chosen = ranked.slice(0, count).map((item) => item.image);
  chosen.forEach((image) => used.add(image.url));
  return chosen;
}

function makeSections(material: string[], sources: Source[], images: CommonsImage[], paper: Paper, focus: PublicationFocus) {
  const unique = dedupeSemantic(material, [], 26).filter((line) => verifyPublicationParagraph(line, focus));
  const groups: string[][] = [];
  for (let index = 0; index < unique.length; index += 2) groups.push(unique.slice(index, index + 2));
  const usedImages = new Set<string>();
  const usedTitles = new Set<string>();
  return groups.flatMap((paragraphs, index): StorySection[] => {
    const valid = paragraphs.filter((paragraph) => verifyPublicationParagraph(paragraph, focus));
    if (!valid.length) return [];
    const text = valid.join(" ");
    let title = magazineSectionTitle(text, focus, index);
    if (usedTitles.has(title.toLowerCase())) {
      const clause = clean(valid[0]).split(/[.;:—]/)[0];
      title = clause.length >= 18 && clause.length <= 82 ? clause : `${focus.label} · ${index + 1}`;
    }
    usedTitles.add(title.toLowerCase());
    return [{ id: `section-${hashText(text)}`, title, paragraphs: valid, images: matchImages(text, images, usedImages, focus, index < 4 ? 1 : 2), source: bestSource(text, sources) }];
  }).slice(0, 10);
}

async function savePaper(paper: Paper) {
  secureSave(`${PAPER_PREFIX}${paper.id}`, paper, "session");
  secureSave(`${PAPER_PREFIX}${paper.id}`, paper);
  try {
    const existing = await secureLoadDurable<Paper[]>(PAPERS, []);
    await secureSaveDurable(`${PAPER_PREFIX}${paper.id}`, paper);
    await secureSaveDurable(PAPERS, [...existing.filter((item) => item.id !== paper.id), paper].slice(-12));
  } catch {}
}

export default function PhiMagazineV5() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [selection, setSelection] = useState<SelectionState>({ branches: [], branchIds: [], branchBodies: [], terms: [], imageUrls: [], noteImages: {}, notes: [], deepNotes: [], updatedAt: "" });
  const [sources, setSources] = useState<Source[]>([]);
  const [images, setImages] = useState<CommonsImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [visualLoading, setVisualLoading] = useState(false);
  const [building, setBuilding] = useState<string | null>(null);
  const [openStory, setOpenStory] = useState(false);

  const rootCards = useMemo(() => paper ? buildSemanticExpansionCards(paper.query, paper.overview, paper.sources, paper.findings, "", [], 15) : [], [paper]);
  const selectedCard = useMemo(() => findSelectedCard(rootCards, selection), [rootCards, selection]);
  const focus = useMemo(() => paper ? resolvePublicationFocus(paper.query, selection, selectedCard) : null, [paper, selection, selectedCard]);
  const material = useMemo(() => paper && focus ? buildMaterial(paper, selection, sources, focus, selectedCard) : [], [paper, selection, sources, focus, selectedCard]);
  const sections = useMemo(() => paper && focus ? makeSections(material, sources, images, paper, focus) : [], [material, sources, images, paper, focus]);
  const magazineCards = useMemo(() => paper && focus ? buildSemanticExpansionCards(focus.label, magazineDeck(focus, material), sources, material, "", [], 15) : [], [paper, focus, material, sources]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "";
    if (!id) { setLoading(false); return; }
    void (async () => {
      let exact = secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null, "session") || secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null);
      if (!exact) try { exact = await secureLoadDurable<Paper | null>(`${PAPER_PREFIX}${id}`, null); } catch {}
      if (!exact) try { exact = (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === id) || null; } catch {}
      if (!exact) { setLoading(false); return; }
      const saved = secureLoad<SelectionState | null>(`${SELECTION_PREFIX}${exact.id}`, null) || await secureLoadDurable<SelectionState | null>(`${SELECTION_PREFIX}${exact.id}`, null).catch(() => null);
      const next = saved || { branches: [], branchIds: [], branchBodies: [], terms: [], imageUrls: [], noteImages: {}, notes: [], deepNotes: [], updatedAt: "" };
      const cards = buildSemanticExpansionCards(exact.query, exact.overview, exact.sources, exact.findings, "", [], 15);
      const selected = findSelectedCard(cards, next);
      const lockedFocus = resolvePublicationFocus(exact.query, next, selected);
      setPaper(exact);
      setSelection(next);
      const focusedSources = await collectSources(exact, lockedFocus, selected);
      setSources(focusedSources);
      setImages(seedImages(focusedSources, lockedFocus, selected));
      setLoading(false);
      const firstMaterial = buildMaterial(exact, next, focusedSources, lockedFocus, selected);
      setVisualLoading(true);
      const prompts = [
        lockedFocus.label,
        `${lockedFocus.label} ${lockedFocus.specificAnchors.slice(0, 4).join(" ")}`,
        ...firstMaterial.slice(0, 6).map((line) => `${lockedFocus.label} ${topTerms(line, 5).join(" ")}`),
      ].map(clean).filter(Boolean).slice(0, 8);
      const settled = await Promise.allSettled(prompts.map((prompt) => commonsSearch(prompt, 18)));
      const found = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      setImages((current) => mergeImages(current, found, lockedFocus, 72));
      setVisualLoading(false);
    })();
  }, []);

  async function buildFocused(card: SemanticCard) {
    if (!paper || building) return;
    setBuilding(card.key);
    const childSelection: SelectionState = {
      branches: [], branchIds: [card.key], branchBodies: [card.body], terms: topTerms(`${card.title} ${card.keyword} ${card.body}`, 10), imageUrls: card.source?.imageUrl ? [card.source.imageUrl] : [], noteImages: {},
      notes: [{ id: `card-${card.key}`, title: card.title, body: card.body }], deepNotes: [], updatedAt: new Date().toISOString(),
    };
    const childFocus = resolvePublicationFocus(focus?.label || paper.query, childSelection, card);
    const queries = [childFocus.label, `${childFocus.label} ${topTerms(card.body, 7).join(" ")}`, `${childFocus.label} mechanism`, `${childFocus.label} history`, `${childFocus.label} applications`];
    const settled = await Promise.allSettled(queries.map(wiki));
    const found = dedupeSources(settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])).filter((source) => verifyPublicationSource(source, childFocus)).slice(0, 42);
    const lines = dedupeLines(found.flatMap((source) => sentences(source.excerpt)).filter((line) => verifyPublicationParagraph(line, childFocus)), 24);
    const childId = `phi-card-${Date.now()}-${hashText(`${card.title}:${card.body}`).slice(0, 6)}`;
    const childOverview = dedupeSemantic([card.body, ...lines], [], 2).join(" ");
    const child: Paper = { id: childId, query: childFocus.label, resolved: `${childFocus.label} ${childFocus.specificAnchors.slice(0, 6).join(" ")}`, identity: { kind: "focused", name: childFocus.label }, title: childFocus.label, overview: childOverview, findings: dedupeSemantic(lines, [childOverview], 18), sources: found, created: Date.now() };
    await savePaper(child);
    secureSave(`${SELECTION_PREFIX}${child.id}`, childSelection);
    try { await secureSaveDurable(`${SELECTION_PREFIX}${child.id}`, childSelection); } catch {}
    location.assign(`${appPath("phi/magazine")}?id=${encodeURIComponent(child.id)}&from=${encodeURIComponent(paper.id)}`);
  }

  if (loading) return <main className={base.loading}>Preparing the publication…</main>;
  if (!paper || !focus) return <main className={base.loading}><a href={appPath("phi")}>Return to Infinity Phi</a></main>;

  const headline = magazineHeadline(focus, material);
  const deck = magazineDeck(focus, material);
  const verifiedSourceImage = sources.find((source) => source.imageUrl && verifyPublicationSource(source, focus));
  const hero = selectedCard?.source?.imageUrl && selectedCard.source && verifyPublicationSource(selectedCard.source, focus)
    ? selectedCard.source.imageUrl
    : verifiedSourceImage?.imageUrl || images[0]?.url;
  const visibleSections = openStory ? sections : sections.slice(0, 5);

  return <main className={base.site}>
    <PhiPublicationMenu />
    <header className={base.header}><a className={base.brand} href={appPath("")}>Infinity</a><nav><a href="#story">Story</a><a href="#index">Index</a><a href="#sources">Sources</a></nav></header>
    <section className={base.hero}>
      {hero ? <img src={hero} alt={focus.label} fetchPriority="high" /> : <div className={styles.emptyMedia} />}
      <div className={base.heroShade} />
      <div className={base.heroCopy}>
        <div className={styles.focusBadge}>{focus.label}</div>
        <h1>{headline}</h1>
        <p>{deck}</p>
      </div>
    </section>

    <article className={base.article}>
      <section id="story" className={base.story}>
        <div className={base.eyebrow}>The story</div>
        <h2>{focus.label} in detail</h2>
        <div className={base.sections}>
          {visibleSections.map((section, index) => <section key={section.id} className={base.storySection}>
            {section.images[0] && <img className={base.sectionImage} src={section.images[0].url} alt={section.images[0].title} loading={index < 2 ? "eager" : "lazy"} decoding="async" />}
            <div className={base.sectionCopy}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph, paragraphIndex) => <p key={`${hashText(paragraph)}-${paragraphIndex}`}>{paragraph}</p>)}
              <div className={base.sectionActions}>{section.source?.url && <a href={section.source.url} target="_blank" rel="noreferrer">Source <ExternalLink size={14} /></a>}</div>
            </div>
            {section.images[1] && <img className={base.secondaryImage} src={section.images[1].url} alt={section.images[1].title} loading="lazy" decoding="async" />}
          </section>)}
        </div>
        {sections.length > 5 && <button className={base.readMore} onClick={() => setOpenStory((value) => !value)}>{openStory ? "Show the shorter edition" : "Continue the full story"}<ChevronDown size={17} className={openStory ? base.rotate : ""} /></button>}
      </section>

      <section id="index" className={styles.indexSection}>
        <div className={base.eyebrow}>Infinity Phi index</div>
        <h2 className={styles.indexHeading}>Explore the next questions around {focus.label}</h2>
        <p className={styles.indexIntro}>These orange cards use the same answer-first index as the research page, but they are rebuilt from this publication’s verified branch instead of drifting back to the broader search.</p>
        <div className={styles.indexGrid}>
          {magazineCards.slice(0, 15).map((card, index) => <article className={styles.indexCard} key={card.key}>
            <button type="button" disabled={Boolean(building)} onClick={() => void buildFocused(card)}>
              {card.source?.imageUrl && (!focus.locked || verifyPublicationSource(card.source, focus)) ? <img src={card.source.imageUrl} alt="" loading="lazy" /> : <div className={styles.imageFallback}>φ</div>}
              <div className={styles.indexCopy}><small>{card.hashPath || `#${index + 1}`} · {card.intent}</small><h3>{card.title}</h3><p>{card.body}</p></div>
            </button>
          </article>)}
        </div>
      </section>

      <details id="sources" className={base.sources}>
        <summary><span><span className={base.eyebrow}>Sources</span><b>Sources for {focus.label}</b></span><small>{sources.length} verified sources · tap to expand</small><ChevronDown size={18} /></summary>
        <div className={base.sourceGrid}>{sources.slice(0, 36).map((source, index) => <a key={`${source.url}-${index}`} href={source.url || "#"} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined}><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p><ExternalLink size={15} /></a>)}</div>
      </details>
    </article>

    <footer className={base.footer}><b>Infinity</b><span>{visualLoading ? "Matching verified visuals to the selected branch…" : `${sources.length} branch-matched sources · ${images.length} branch-matched visual candidates`}</span></footer>
  </main>;
}
