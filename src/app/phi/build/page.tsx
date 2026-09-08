"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, LayoutTemplate, Save, Share2, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSaveDurable } from "@/lib/secure-storage";

type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Paper = { id: string; query: string; resolved: string; title: string; overview: string; findings: string[]; sources: Source[]; created: number };
type SavedSite = { id: string; researchId: string; title: string; subject: string; seed: number; updatedAt: string; kind: "phi-publication" };

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SITES = "infinity_phi_sites_v2";
const PAGES = "c13b0_infinity_puck_pages_v1";

const THEMES = [
  { name: "Midnight", ink: "#f5f1e8", paper: "#071a2e", accent: "#ed4339", soft: "#0d2944", body: "#c7d5e2", serif: "Georgia,serif" },
  { name: "Journal", ink: "#17202b", paper: "#f6f3eb", accent: "#245fa8", soft: "#e8edf2", body: "#3e4b58", serif: "Georgia,serif" },
  { name: "Signal", ink: "#10251f", paper: "#edf4ef", accent: "#ce312d", soft: "#dbe9df", body: "#355148", serif: "Arial,Helvetica,sans-serif" },
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

async function expandResearch(paper: Paper): Promise<Source[]> {
  const compactDevice = isPhone();
  const queries = compactDevice
    ? [paper.resolved, `${paper.query} applications`]
    : [paper.resolved, `${paper.query} history`, `${paper.query} applications`];
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

  function enrichAfterFirstPaint(value: Paper) {
    if (isPhone()) {
      setEnriching(false);
      return;
    }
    setEnriching(true);
    window.setTimeout(() => {
      void expandResearch(value).then(setExpanded).finally(() => setEnriching(false));
    }, 650);
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "";
    const query = clean(params.get("q"));
    const resolved = clean(params.get("resolved")) || query;
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
      setPaper(immediate);
      enrichAfterFirstPaint(immediate);
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
      setPaper(fallback);
      enrichAfterFirstPaint(fallback);
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
      setPaper(exact);
      enrichAfterFirstPaint(exact);
    })();
  }, []);

  const theme = THEMES[seed % THEMES.length];
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
    };
    const sites = await secureLoadDurable<SavedSite[]>(SITES, []);
    await secureSaveDurable(SITES, [...sites.filter((item) => item.id !== site.id), site].slice(-40));
    const pages = await secureLoadDurable<Record<string, SavedSite>>(PAGES, {});
    await secureSaveDurable(PAGES, { ...pages, [site.id]: site });
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
    <main className="phi-publication" style={{ "--pub-ink": theme.ink, "--pub-paper": theme.paper, "--pub-accent": theme.accent, "--pub-soft": theme.soft, "--pub-body": theme.body, "--pub-serif": theme.serif } as React.CSSProperties}>
      <header className="phi-builder-bar">
        <a href={`${appPath("phi")}?id=${encodeURIComponent(paper.id)}`} aria-label="Back to research"><ArrowLeft size={20} /></a>
        <div><b>Infinity Builder</b><small>{enriching ? "Expanding research and visuals…" : `${theme.name} · ${allSources.length} sources · ${visualSources.length} visuals`}</small></div>
        <nav>
          <button onClick={() => setSeed((value) => value + 1)}><LayoutTemplate size={18} /><span>Design</span></button>
          <button onClick={() => void share()}><Share2 size={18} /><span>Share</span></button>
          <button className="primary" onClick={() => void save()}>{saved ? <Check size={18} /> : <Save size={18} />}<span>{saved ? "Saved" : "Save"}</span></button>
        </nav>
      </header>

      <article>
        <section className={heroImage ? "phi-pub-hero with-image" : "phi-pub-hero"}>
          {heroImage && <img src={heroImage} alt={visualSources[0]?.title || paper.query} className="phi-pub-hero-image" decoding="async" />}
          <div className="phi-pub-hero-shade" />
          <div className="phi-pub-hero-copy">
            <small>{paper.query.toUpperCase()} · INFINITY RESEARCH PUBLICATION</small>
            <h1>{paper.query}</h1>
            <p>{paper.overview}</p>
            <div><span>{allSources.length} research sources</span><span>{visualSources.length} live visuals</span><span>Exact subject retained</span></div>
          </div>
        </section>

        <section className="phi-pub-body">
          <aside>
            <span>Research package</span><b>{paper.id}</b>
            <span>Identity</span><b>{paper.resolved}</b>
            <span>Published</span><b>{new Date(paper.created).toLocaleDateString()}</b>
            <span>Builder status</span><b>{enriching ? "Adding research" : "Expanded"}</b>
          </aside>

          <div className="phi-pub-story">
            <p className="phi-pub-kicker">Overview</p>
            <h2>What the evidence shows</h2>
            {story.slice(0, 4).map((item, index) => <p key={index} className={index === 0 ? "lead" : ""}>{item}<sup>{allSources.length ? Math.min(index + 1, allSources.length) : ""}</sup></p>)}

            {visualSources.length > 1 && <section style={{margin:"42px 0"}}>
              <p className="phi-pub-kicker">Visual field guide</p>
              <h2>Images drawn directly from the research</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,marginTop:18}}>
                {visualSources.slice(1, 7).map((source, index) => <a key={`${source.imageUrl}-${index}`} href={source.url} target="_blank" rel="noreferrer" style={{display:"block",overflow:"hidden",borderRadius:18,background:"var(--pub-soft)",color:"inherit",textDecoration:"none"}}>
                  <img src={source.imageUrl} alt={source.title} loading="lazy" decoding="async" style={{display:"block",width:"100%",height:180,objectFit:"cover"}} />
                  <div style={{padding:13}}><small style={{opacity:.7}}>{source.provider}</small><b style={{display:"block",marginTop:5,lineHeight:1.25}}>{source.title}</b></div>
                </a>)}
              </div>
            </section>}

            {story[4] && <section className="phi-pub-callout"><small>KEY FINDING</small><blockquote>{story[4]}</blockquote></section>}

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
