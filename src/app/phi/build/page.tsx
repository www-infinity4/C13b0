"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, LayoutTemplate, Save, Share2, Sparkles, Store } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { cloudflareBuilderConfigured, requestCloudflareBuild } from "@/lib/cloudflare-builder";
import { secureLoad, secureLoadDurable, secureSaveDurable } from "@/lib/secure-storage";
import { createVariationPlan, type VariationPlan } from "@/lib/site-variation";
import { loadLocalWallet } from "@/lib/wallet";

type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Paper = { id: string; query: string; resolved: string; title: string; overview: string; findings: string[]; sources: Source[]; created: number };
type SavedSite = { id: string; researchId: string; title: string; subject: string; seed: number; updatedAt: string; kind: "phi-publication"; variation?: VariationPlan };
type HistoryItem = { query: string; resolved?: string; kind?: string; at?: number };

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SITES = "infinity_phi_sites_v2";
const PAGES = "c13b0_infinity_puck_pages_v1";
const SECTION_WORK = "infinity_phi_section_work_v1";
const TOKEN_AMENDMENTS = "c13b0_infinity_token_amendments_v1";
const HISTORY = "infinity_phi_context_v1";

type SectionWork = { prompt: string; sources: Source[]; updatedAt: string };
type SectionWorkStore = Record<string, Record<string, SectionWork>>;
type TokenRevision = {
  id: string;
  action: "DETAILS_UPDATED" | "MATERIAL_ADDED";
  at: string;
  materialId?: string;
  previous?: { title: string; description: string };
  next?: { title: string; description: string };
};
type TokenAmendmentStore = Record<string, {
  tokenId: string;
  title?: string;
  description?: string;
  materials: { id: string; title: string; url?: string; note?: string; addedAt: string }[];
  revisions: TokenRevision[];
  updatedAt?: string;
}>;

const THEMES = [
  { name: "Midnight", ink: "#f5f1e8", paper: "#071a2e", accent: "#ed4339", soft: "#0d2944", body: "#c7d5e2", serif: "Georgia,serif" },
  { name: "Journal", ink: "#17202b", paper: "#f6f3eb", accent: "#245fa8", soft: "#e8edf2", body: "#3e4b58", serif: "Georgia,serif" },
  { name: "Signal", ink: "#10251f", paper: "#edf4ef", accent: "#ce312d", soft: "#dbe9df", body: "#355148", serif: "Arial,Helvetica,sans-serif" },
  { name: "Cobalt", ink: "#f7fbff", paper: "#07152f", accent: "#39a7ff", soft: "#102a51", body: "#c8dcf2", serif: "'Trebuchet MS',Arial,sans-serif" },
  { name: "Copper", ink: "#2c1711", paper: "#fff7ec", accent: "#a83f16", soft: "#f0d5bf", body: "#5f4035", serif: "Georgia,serif" },
  { name: "Ultraviolet", ink: "#f8f2ff", paper: "#180b2a", accent: "#c968ff", soft: "#32164f", body: "#e0c9f0", serif: "Arial,Helvetica,sans-serif" },
  { name: "Mineral", ink: "#09252a", paper: "#edfafa", accent: "#007d8b", soft: "#cfe9e7", body: "#31585b", serif: "Georgia,serif" },
  { name: "Solar", ink: "#fff8dc", paper: "#282108", accent: "#f4b72b", soft: "#4a3c0c", body: "#e8d89d", serif: "'Trebuchet MS',Arial,sans-serif" },
];

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentences = (text: string) => clean(text).split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter((item) => item.length > 45);
const isPhone = () => typeof window !== "undefined" && (
  new URLSearchParams(window.location.search).get("phone") === "1" ||
  window.matchMedia("(max-width: 900px)").matches ||
  /Android|Mobile/i.test(navigator.userAgent)
);

async function wikiExpansion(query: string): Promise<Source[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=8&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=900&format=json&origin=*`;
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
      const title = clean(page.title);
      const excerpt = clean(page.extract);
      if (!title || !excerpt) return [];
      return [{ title, excerpt, url: page.fullurl || "", provider: "Wikipedia · expanded research", imageUrl: page.thumbnail?.source }];
    });
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

async function expandResearch(paper: Paper, focus: string | null): Promise<Source[]> {
  const compactDevice = isPhone();
  const aims = focus ? [focus] : paper.findings.slice(0, compactDevice ? 4 : 7);
  const queries = focus
    ? [`${paper.query} ${focus}`, `${focus} explained`, `${focus} applications`]
    : [paper.resolved, ...aims.map((aim) => `${paper.query} ${aim}`), `${paper.query} applications`]
        .slice(0, compactDevice ? 5 : 10);
  const settled = await Promise.allSettled(queries.map((query) => wikiExpansion(query)));
  const existing = new Set(paper.sources.map((source) => source.url || source.title.toLowerCase()));
  const seen = new Set<string>();
  return settled
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((source) => {
      const key = source.url || source.title.toLowerCase();
      if (!key || existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, compactDevice ? 8 : 18);
}

export default function Build() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [expanded, setExpanded] = useState<Source[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(0);
  const [saved, setSaved] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [sectionWork, setSectionWork] = useState<Record<string, SectionWork>>({});
  const [sectionPrompts, setSectionPrompts] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sectionBusy, setSectionBusy] = useState<string | null>(null);
  const [sectionNotice, setSectionNotice] = useState<Record<string, string>>({});
  const [variation, setVariation] = useState<VariationPlan | null>(null);
  const [cloudNotice, setCloudNotice] = useState("");

  function enrichAfterFirstPaint(value: Paper, selectedFocus: string | null) {
    setEnriching(true);
    window.setTimeout(() => {
      void expandResearch(value, selectedFocus).then(setExpanded).finally(() => setEnriching(false));
    }, 450);
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "";
    const query = clean(params.get("q"));
    const resolved = clean(params.get("resolved")) || query;
    const focusIndex = Number(params.get("focus"));
    if (!id) {
      setError("No research package was supplied.");
      return;
    }

    const key = `${PAPER_PREFIX}${id}`;
    const immediate =
      secureLoad<Paper | null>(key, null, "session") ||
      secureLoad<Paper | null>(key, null) ||
      secureLoad<Paper[]>(PAPERS, []).find((item) => item.id === id) ||
      null;
    if (immediate) {
      const selectedFocus = Number.isInteger(focusIndex) && focusIndex >= 0 ? immediate.findings[focusIndex] || null : null;
      setFocus(selectedFocus);
      setFocusIndex(selectedFocus ? focusIndex : null);
      setPaper(immediate);
      enrichAfterFirstPaint(immediate, selectedFocus);
      return;
    }

    if (query) {
      const fallback: Paper = {
        id,
        query,
        resolved,
        title: query,
        overview: `Infinity Phi is rebuilding the complete research publication for ${query}.`,
        findings: [],
        sources: [],
        created: Date.now(),
      };
      setFocus(null);
      setFocusIndex(null);
      setPaper(fallback);
      enrichAfterFirstPaint(fallback, null);
      return;
    }

    void (async () => {
      const timeout = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500));
      const durable = (async () => {
        let direct: Paper | null = null;
        let legacy: Paper | undefined;
        try { direct = await secureLoadDurable<Paper | null>(key, null); } catch {}
        if (!direct) {
          try { legacy = (await secureLoadDurable<Paper[]>(PAPERS, [])).find((item) => item.id === id); } catch {}
        }
        return direct || legacy || null;
      })();
      const exact = await Promise.race([durable, timeout]);
      if (!exact) {
        setError("The research package did not open in time. Return to the result and tap Build website again.");
        return;
      }
      const selectedFocus = Number.isInteger(focusIndex) && focusIndex >= 0 ? exact.findings[focusIndex] || null : null;
      setFocus(selectedFocus);
      setFocusIndex(selectedFocus ? focusIndex : null);
      setPaper(exact);
      enrichAfterFirstPaint(exact, selectedFocus);
    })();
  }, []);

  useEffect(() => {
    if (!paper?.id) return;
    void secureLoadDurable<SectionWorkStore>(SECTION_WORK, {}).then((store) => {
      const savedWork = store[paper.id] || {};
      setSectionWork(savedWork);
      setSectionPrompts(Object.fromEntries(Object.entries(savedWork).map(([key, value]) => [key, value.prompt])));
    });
  }, [paper?.id]);

  useEffect(() => {
    if (!paper) return;
    void Promise.all([
      secureLoadDurable<HistoryItem[]>(HISTORY, []),
      secureLoadDurable<SavedSite[]>(SITES, []),
    ]).then(([history, sites]) => {
      setVariation(createVariationPlan({
        userId: loadLocalWallet()?.walletId || "anonymous-device",
        tokenId: paper.id,
        query: paper.query,
        aims: focus ? [focus] : paper.findings,
        history: history.map((item) => ({ query: item.query, action: item.kind, occurredAt: item.at ? new Date(item.at).toISOString() : undefined })),
        priorFingerprints: sites.flatMap((site) => site.variation?.fingerprint ? [site.variation.fingerprint] : []),
        upgrades: ["illustration"],
      }));
    });
  }, [paper, focus]);

  const variationSeed = variation ? [...variation.fingerprint].reduce((total, character) => total + character.charCodeAt(0), 0) : 0;
  const theme = THEMES[(variationSeed + seed) % THEMES.length];
  const allSources = useMemo(() => paper ? [...paper.sources, ...expanded] : [], [paper, expanded]);
  const displayedSources = isPhone() ? allSources.slice(0, 10) : allSources;
  const visualSources = useMemo(() => {
    const compactDevice = isPhone();
    const seen = new Set<string>();
    return allSources.filter((source) => {
      if (!source.imageUrl || seen.has(source.imageUrl)) return false;
      seen.add(source.imageUrl);
      return true;
    }).slice(0, compactDevice ? 3 : 7);
  }, [allSources]);
  const heroImage = visualSources[0]?.imageUrl;
  const aims = useMemo(() => {
    if (!paper) return [];
    if (focus) return [focus];
    const findings = paper.findings.slice(0, 6).map(clean).filter(Boolean);
    return findings.length ? findings : sentences(paper.overview).slice(0, 4);
  }, [paper, focus]);
  const story = useMemo(() => {
    if (!paper) return [];
    const lines = [
      ...sentences(paper.overview),
      ...paper.findings,
      ...expanded.flatMap((source) => sentences(source.excerpt).slice(0, 2)),
    ].map(clean).filter(Boolean);
    const seen = new Set<string>();
    return lines.filter((line) => {
      const key = line.slice(0, 140).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 18);
  }, [paper, expanded]);
  const visualBeats = useMemo(() => aims.map((aim, index) => {
    const key = String(focus ? focusIndex ?? index : index);
    const custom = sectionWork[key];
    const source = custom?.sources[0] || expanded[index % Math.max(1, expanded.length)] || allSources[index % Math.max(1, allSources.length)];
    const visual = custom?.sources.find((item) => item.imageUrl) || visualSources[index % Math.max(1, visualSources.length)];
    const supportSources = custom?.sources.length ? custom.sources : source ? [source] : [];
    const support = supportSources.flatMap((item) => sentences(item.excerpt).slice(0, focus ? 4 : 2)).slice(0, focus ? 8 : 4);
    return { key, aim, source, visual, support, prompt: custom?.prompt || "" };
  }), [aims, expanded, allSources, visualSources, focus, focusIndex, sectionWork]);

  async function researchSection(key: string, aim: string) {
    if (!paper) return;
    const prompt = clean(sectionPrompts[key]) || aim;
    setSectionBusy(key);
    setSectionNotice((current) => ({ ...current, [key]: "Researching this exact section…" }));
    const found = await wikiExpansion(`${paper.query} ${aim} ${prompt}`);
    const work: SectionWork = { prompt, sources: found, updatedAt: new Date().toISOString() };
    const nextWork = { ...sectionWork, [key]: work };
    setSectionWork(nextWork);
    setExpanded((current) => {
      const seen = new Set<string>();
      return [...found, ...current].filter((source) => {
        const identity = source.url || `${source.provider}:${source.title}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
    });
    const store = await secureLoadDurable<SectionWorkStore>(SECTION_WORK, {});
    await secureSaveDurable(SECTION_WORK, { ...store, [paper.id]: nextWork });
    setSectionBusy(null);
    setSectionNotice((current) => ({ ...current, [key]: found.length ? `${found.length} focused research cards added` : "No matching source returned yet; refine the direction and try again" }));
  }

  async function attachSectionToToken(key: string, aim: string) {
    if (!paper) return;
    const work = sectionWork[key];
    const prompt = clean(sectionPrompts[key]) || work?.prompt || aim;
    const store = await secureLoadDurable<TokenAmendmentStore>(TOKEN_AMENDMENTS, {});
    const previous = store[paper.id] || { tokenId: paper.id, materials: [], revisions: [] };
    const now = new Date().toISOString();
    const materialId = crypto.randomUUID();
    const material = {
      id: materialId,
      title: `Phi section: ${aim}`,
      url: work?.sources[0]?.url || undefined,
      note: [prompt, ...((work?.sources || []).slice(0, 3).map((source) => sentences(source.excerpt)[0]).filter(Boolean))].join("\n\n"),
      addedAt: now,
    };
    const revision: TokenRevision = {
      id: crypto.randomUUID(),
      action: "MATERIAL_ADDED",
      at: now,
      materialId,
    };
    await secureSaveDurable(TOKEN_AMENDMENTS, {
      ...store,
      [paper.id]: {
        ...previous,
        materials: [...previous.materials, material],
        revisions: [...previous.revisions, revision],
        updatedAt: now,
      },
    });
    window.dispatchEvent(new Event("infinity-history-updated"));
    setSectionNotice((current) => ({ ...current, [key]: "This section and its research are attached to the token" }));
  }

  function focusWebsite(key: string) {
    if (!paper) return;
    const params = new URLSearchParams({ id: paper.id, q: paper.query, resolved: paper.resolved, phone: "1", focus: key });
    location.assign(`${appPath("phi/build")}?${params}`);
  }

  async function save() {
    if (!paper) return;
    const site: SavedSite = {
      id: `site-${paper.id}`,
      researchId: paper.id,
      title: paper.query,
      subject: paper.resolved,
      seed,
      updatedAt: new Date().toISOString(),
      kind: "phi-publication",
      variation: variation || undefined,
    };
    const sites = await secureLoadDurable<SavedSite[]>(SITES, []);
    await secureSaveDurable(SITES, [...sites.filter((item) => item.id !== site.id), site].slice(-40));
    const pages = await secureLoadDurable<Record<string, SavedSite>>(PAGES, {});
    await secureSaveDurable(PAGES, { ...pages, [site.id]: site });
    if (cloudflareBuilderConfigured()) {
      setCloudNotice("Saving the personalized build to Cloudflare…");
      try {
        const history = await secureLoadDurable<HistoryItem[]>(HISTORY, []);
        const cloud = await requestCloudflareBuild({
          tokenId: paper.id,
          query: paper.query,
          aims,
          history: history.map((item) => ({ query: item.query, action: item.kind, occurredAt: item.at ? new Date(item.at).toISOString() : undefined })),
          upgrades: ["illustration"],
        });
        setVariation(cloud.plan);
        setCloudNotice("Personalized build recorded in the Cloudflare history ledger");
      } catch (cloudError) {
        setCloudNotice(cloudError instanceof Error ? cloudError.message : "Cloudflare save is unavailable");
      }
    } else {
      setCloudNotice("Saved on this device. Cloudflare deployment is required for shared history.");
    }
    window.dispatchEvent(new Event("infinity-history-updated"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  async function share() {
    if (!paper) return;
    try {
      if (navigator.share) await navigator.share({ title: paper.query, text: paper.overview, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  }

  if (error) return (
    <main className="phi-build-error">
      <a href={appPath("phi")}><ArrowLeft size={18} /> Back to research</a>
      <section><div className="phi-mini-orb">φ</div><h1>Research package unavailable</h1><p>{error}</p><a href={appPath("phi")}>Return to Infinity Phi</a></section>
    </main>
  );

  if (!paper) return <main className="phi-build-loading">Opening exact research package…</main>;

  return (
    <main className="phi-publication" data-layout={variation?.layout || "editorial-spine"} style={{ "--pub-ink": theme.ink, "--pub-paper": theme.paper, "--pub-accent": theme.accent, "--pub-soft": theme.soft, "--pub-body": theme.body, "--pub-serif": theme.serif } as React.CSSProperties}>
      <header className="phi-builder-bar">
        <a href={`${appPath("phi")}?id=${encodeURIComponent(paper.id)}`} aria-label="Back to research"><ArrowLeft size={20} /></a>
        <div><b>Infinity Builder</b><small>{enriching ? "Expanding research and visuals…" : `${theme.name} · ${allSources.length} sources · ${visualSources.length} visuals`}</small></div>
        <nav>
          <button onClick={() => setSeed((value) => value + 1)}><LayoutTemplate size={18} /><span>Design</span></button>
          <a href={`${appPath("business")}?query=${encodeURIComponent(paper.query)}&token=${encodeURIComponent(paper.id)}`}><Store size={18} /><span>Business</span></a>
          <button onClick={() => void share()}><Share2 size={18} /><span>Share</span></button>
          <button className="primary" onClick={() => void save()}>{saved ? <Check size={18} /> : <Save size={18} />}<span>{saved ? "Saved" : "Save"}</span></button>
        </nav>
      </header>

      <article>
        <section className={heroImage ? "phi-pub-hero with-image" : "phi-pub-hero"}>
          {heroImage && <img src={heroImage} alt={visualSources[0]?.title || paper.query} className="phi-pub-hero-image" decoding="async" />}
          <div className="phi-pub-hero-shade" />
          <div className="phi-pub-hero-copy">
            <small>{paper.query.toUpperCase()} · {focus ? "FOCUSED VISUAL SCRIPT" : "COMPLETE VISUAL SCRIPT"}</small>
            <h1>{focus || paper.query}</h1>
            <p>{focus || paper.overview}</p>
            <div><span>{allSources.length} research sources</span><span>{visualSources.length} live visuals</span><span>{focus ? "One aim expanded deeply" : `${aims.length} aims developed`}</span></div>
          </div>
        </section>

        <section className="phi-pub-body">
          <aside>
            <span>Research package</span><b>{paper.id}</b>
            <span>Identity</span><b>{paper.resolved}</b>
            <span>Published</span><b>{new Date(paper.created).toLocaleDateString()}</b>
            <span>Build scope</span><b>{focus ? "Selected card only" : "Every research card"}</b>
            <span>Unique structure</span><b>{variation ? `${variation.layout} · ${Math.round((1 - variation.similarityToClosestPrior) * 100)}% distinct` : "Reading history"}</b>
            <span>Builder status</span><b>{enriching ? "Adding research and illustrations" : "Expanded"}</b>
          </aside>

          <div className="phi-pub-story">
            <p className="phi-pub-kicker">Illustrated learning script</p>
            <h2>{focus ? "One idea, opened all the way" : "Every idea becomes a visual path"}</h2>
            <p className="lead">{focus || paper.overview}</p>
            <section className="phi-visual-script">
              {visualBeats.map((beat, index) => <article key={`${beat.aim}-${index}`}>
                <div className="phi-visual-media">
                  {beat.visual?.imageUrl ? <img src={beat.visual.imageUrl} alt={beat.visual.title || beat.aim} loading={index ? "lazy" : "eager"} decoding="async" /> : <div className="phi-visual-pending"><Sparkles /><span>{enriching ? "Finding the matching illustration…" : "Visual research card"}</span></div>}
                  <button className="phi-inline-button on-visual" onClick={() => setActiveSection(activeSection === beat.key ? null : beat.key)} aria-label={`Open Phi tools for illustration ${index + 1}`}>φ</button>
                </div>
                <div>
                  <div className="phi-script-heading"><small>ILLUSTRATED AIM {String(index + 1).padStart(2, "0")}</small><button className="phi-inline-button" onClick={() => setActiveSection(activeSection === beat.key ? null : beat.key)} aria-label={`Open Phi tools for ${beat.aim}`}>φ</button></div>
                  <h3>{beat.aim}</h3>
                  <details open={Boolean(focus)}>
                    <summary>{focus ? "Expanded research for this aim" : "Open this aim’s research cards"}</summary>
                    {beat.support.length ? beat.support.map((line, lineIndex) => <div className="phi-script-line" key={lineIndex}><p>{line}</p><button className="phi-inline-button" onClick={() => setActiveSection(beat.key)} aria-label="Ask Phi about this explanation">φ</button></div>) : <div className="phi-script-line"><p>This concept remains attached to the complete research package and can receive additional sources, illustrations, tools, and token amendments.</p><button className="phi-inline-button" onClick={() => setActiveSection(beat.key)} aria-label="Ask Phi about this explanation">φ</button></div>}
                    {beat.source?.url && <a href={beat.source.url} target="_blank" rel="noreferrer">Open supporting source <ExternalLink size={15} /></a>}
                  </details>
                  {activeSection === beat.key && <section className="phi-inline-workspace">
                    <div><span className="phi-inline-orb">φ</span><div><b>Work inside this section</b><small>Research, add, change, or build from this exact point.</small></div></div>
                    <textarea value={sectionPrompts[beat.key] || ""} onChange={(event) => setSectionPrompts((current) => ({ ...current, [beat.key]: event.target.value }))} placeholder={`Example: expand ${beat.aim} with Canadian nickels, dates, metals, images, and collector context`} />
                    <div className="phi-inline-actions">
                      <button disabled={sectionBusy === beat.key} onClick={() => void researchSection(beat.key, beat.aim)}>{sectionBusy === beat.key ? "Researching…" : "Research this section"}</button>
                      <button onClick={() => void attachSectionToToken(beat.key, beat.aim)}>Add to token</button>
                      <button onClick={() => focusWebsite(beat.key)}>Build only this aim</button>
                    </div>
                    {sectionNotice[beat.key] && <p>{sectionNotice[beat.key]}</p>}
                  </section>}
                </div>
              </article>)}
            </section>

            {story[4] && <section className="phi-pub-callout"><small>KEY FINDING</small><blockquote>{story[4]}</blockquote></section>}
            {cloudNotice && <p className="phi-cloud-notice">{cloudNotice}</p>}

            {story.length > 5 && <section className="phi-pub-findings">
              <p className="phi-pub-kicker">Detailed findings</p>
              <h2>Research notes and implications</h2>
              {story.slice(5, 14).map((item, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></div>)}
            </section>}

            {(enriching || expanded.length > 0) && <section style={{margin:"48px 0"}}>
              <p className="phi-pub-kicker">Expanded research</p>
              <h2>{enriching ? "Gathering more context without blocking the page" : "Additional context discovered by the builder"}</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:18}}>
                {expanded.slice(0, 9).map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" style={{padding:18,borderRadius:18,background:"var(--pub-soft)",color:"inherit",textDecoration:"none"}}>
                  <small style={{opacity:.7}}>{source.provider}</small><b style={{display:"block",fontSize:"1.05rem",margin:"7px 0"}}>{source.title}</b><p style={{margin:0,lineHeight:1.55,opacity:.85}}>{sentences(source.excerpt)[0] || source.excerpt.slice(0,280)}</p>
                </a>)}
              </div>
              {enriching && <p style={{display:"flex",alignItems:"center",gap:8,marginTop:16}}><Sparkles size={17} /> The publication is already usable while enrichment finishes.</p>}
            </section>}

            <section className="phi-pub-sources">
              <p className="phi-pub-kicker">Evidence</p>
              <h2>Sources used in this publication</h2>
              {displayedSources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">
                <span>{index + 1}</span><div><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p></div><ExternalLink size={17} />
              </a>)}
              {displayedSources.length < allSources.length && <p>Showing the first {displayedSources.length} sources on this phone to keep the builder responsive.</p>}
            </section>
          </div>
        </section>
      </article>

      <footer className="phi-pub-footer"><b>Infinity</b><span>This full publication stays bound to {paper.id}; design changes never replace its research subject.</span></footer>
    </main>
  );
}
