"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  LayoutTemplate,
  Save,
  Share2,
} from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureSave } from "@/lib/secure-storage";

type Source = {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
};
type Paper = {
  id: string;
  query: string;
  resolved: string;
  title: string;
  overview: string;
  findings: string[];
  sources: Source[];
  created: number;
};
type SavedSite = {
  id: string;
  researchId: string;
  title: string;
  subject: string;
  seed: number;
  updatedAt: string;
  kind: "phi-publication";
};

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SITES = "infinity_phi_sites_v2";
const PAGES = "c13b0_infinity_puck_pages_v1";

const THEMES = [
  {
    name: "Midnight",
    ink: "#f5f1e8",
    paper: "#071a2e",
    accent: "#ed4339",
    soft: "#0d2944",
    body: "#c7d5e2",
    serif: "Georgia,serif",
  },
  {
    name: "Journal",
    ink: "#17202b",
    paper: "#f6f3eb",
    accent: "#245fa8",
    soft: "#e8edf2",
    body: "#3e4b58",
    serif: "Georgia,serif",
  },
  {
    name: "Signal",
    ink: "#10251f",
    paper: "#edf4ef",
    accent: "#ce312d",
    soft: "#dbe9df",
    body: "#355148",
    serif: "Arial,Helvetica,sans-serif",
  },
];

function paragraphs(text: string) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Build() {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("id") || "";
    const direct = id
      ? secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null)
      : null;
    const session = id
      ? secureLoad<Paper | null>(`${PAPER_PREFIX}${id}`, null, "session")
      : null;
    const legacy = secureLoad<Paper[]>(PAPERS, []).find(
      (item) => item.id === id,
    );
    const exact = direct || session || legacy;
    if (!id) setError("No research package was supplied.");
    else if (!exact)
      setError(
        "This research package is no longer available on this device. Run the research once more to rebuild it.",
      );
    else setPaper(exact);
  }, []);

  const theme = THEMES[seed % THEMES.length];
  const heroImage = useMemo(
    () =>
      paper?.sources.find(
        (source) =>
          source.imageUrl &&
          source.title.trim().toLowerCase() ===
            paper.query.trim().toLowerCase(),
      )?.imageUrl,
    [paper],
  );
  const story = useMemo(() => {
    if (!paper) return [];
    const lines = [...paragraphs(paper.overview), ...paper.findings];
    const unique = lines.filter(
      (line, index) =>
        lines.findIndex(
          (candidate) =>
            candidate.slice(0, 120).toLowerCase() ===
            line.slice(0, 120).toLowerCase(),
        ) === index,
    );
    return unique.slice(0, 10);
  }, [paper]);

  function save() {
    if (!paper) return;
    const updatedAt = new Date().toISOString();
    const site: SavedSite = {
      id: `site-${paper.id}`,
      researchId: paper.id,
      title: paper.query,
      subject: paper.resolved,
      seed,
      updatedAt,
      kind: "phi-publication",
    };
    const sites = secureLoad<SavedSite[]>(SITES, []);
    secureSave(
      SITES,
      [...sites.filter((item) => item.id !== site.id), site].slice(-40),
    );
    const pages = secureLoad<Record<string, SavedSite>>(PAGES, {});
    secureSave(PAGES, { ...pages, [site.id]: site });
    window.dispatchEvent(new Event("infinity-history-updated"));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  async function share() {
    if (!paper) return;
    try {
      if (navigator.share)
        await navigator.share({
          title: paper.query,
          text: paper.overview,
          url: location.href,
        });
      else await navigator.clipboard.writeText(location.href);
    } catch {
      // Closing the native share panel is not an error.
    }
  }

  if (error)
    return (
      <main className="phi-build-error">
        <Link href={appPath("phi")}>
          <ArrowLeft size={18} /> Back to research
        </Link>
        <section>
          <div className="phi-mini-orb">φ</div>
          <h1>Research package unavailable</h1>
          <p>{error}</p>
          <Link href={appPath("phi")}>Start the research again</Link>
        </section>
      </main>
    );

  if (!paper)
    return (
      <main className="phi-build-loading">Opening exact research package…</main>
    );

  return (
    <main
      className="phi-publication"
      style={
        {
          "--pub-ink": theme.ink,
          "--pub-paper": theme.paper,
          "--pub-accent": theme.accent,
          "--pub-soft": theme.soft,
          "--pub-body": theme.body,
          "--pub-serif": theme.serif,
        } as React.CSSProperties
      }
    >
      <header className="phi-builder-bar">
        <Link href={appPath("phi")} aria-label="Back to research">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <b>Infinity Builder</b>
          <small>{theme.name} design</small>
        </div>
        <nav>
          <button onClick={() => setSeed((value) => value + 1)}>
            <LayoutTemplate size={18} />
            <span>Design</span>
          </button>
          <button onClick={() => void share()}>
            <Share2 size={18} />
            <span>Share</span>
          </button>
          <button className="primary" onClick={save}>
            {saved ? <Check size={18} /> : <Save size={18} />}
            <span>{saved ? "Saved" : "Save"}</span>
          </button>
        </nav>
      </header>

      <article>
        <section
          className={heroImage ? "phi-pub-hero with-image" : "phi-pub-hero"}
        >
          {heroImage && (
            <img src={heroImage} alt="" className="phi-pub-hero-image" />
          )}
          <div className="phi-pub-hero-shade" />
          <div className="phi-pub-hero-copy">
            <small>{paper.query.toUpperCase()} · RESEARCH PUBLICATION</small>
            <h1>{paper.query}</h1>
            <p>{paper.overview}</p>
            <div>
              <span>{paper.sources.length} verified sources</span>
              <span>Exact subject retained</span>
            </div>
          </div>
        </section>

        <section className="phi-pub-body">
          <aside>
            <span>Research package</span>
            <b>{paper.id}</b>
            <span>Identity</span>
            <b>{paper.resolved}</b>
            <span>Published</span>
            <b>{new Date(paper.created).toLocaleDateString()}</b>
          </aside>

          <div className="phi-pub-story">
            <p className="phi-pub-kicker">Overview</p>
            <h2>What the evidence shows</h2>
            {story.slice(0, 3).map((item, index) => (
              <p key={index} className={index === 0 ? "lead" : ""}>
                {item}
                <sup>
                  {paper.sources.length
                    ? Math.min(index + 1, paper.sources.length)
                    : ""}
                </sup>
              </p>
            ))}

            {story.length > 3 && (
              <section className="phi-pub-callout">
                <small>KEY FINDING</small>
                <blockquote>{story[3]}</blockquote>
              </section>
            )}

            {story.length > 4 && (
              <section className="phi-pub-findings">
                <p className="phi-pub-kicker">Detailed findings</p>
                <h2>Research notes</h2>
                {story.slice(4).map((item, index) => (
                  <div key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="phi-pub-sources">
              <p className="phi-pub-kicker">Evidence</p>
              <h2>Sources used in this publication</h2>
              {paper.sources.map((source, index) => (
                <a
                  key={`${source.url}-${index}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{index + 1}</span>
                  <div>
                    <small>{source.provider}</small>
                    <b>{source.title}</b>
                    <p>{source.excerpt}</p>
                  </div>
                  <ExternalLink size={17} />
                </a>
              ))}
            </section>
          </div>
        </section>
      </article>
      <footer className="phi-pub-footer">
        <b>Infinity</b>
        <span>
          This page remains bound to {paper.id}. Design changes cannot change
          its subject.
        </span>
      </footer>
    </main>
  );
}
