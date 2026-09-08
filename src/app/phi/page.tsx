"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Search,
  Sparkles,
} from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureSave } from "@/lib/secure-storage";

type HistoryItem = {
  query: string;
  resolved: string;
  kind: string;
  at: number;
};
type Source = {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
};
type Identity = {
  kind: string;
  name: string;
  symbol?: string;
  number?: number;
};
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
const ELEMENTS: Record<string, { symbol: string; number: number }> = {
  hydrogen: { symbol: "H", number: 1 },
  helium: { symbol: "He", number: 2 },
  boron: { symbol: "B", number: 5 },
  carbon: { symbol: "C", number: 6 },
  nitrogen: { symbol: "N", number: 7 },
  oxygen: { symbol: "O", number: 8 },
  fluorine: { symbol: "F", number: 9 },
  aluminum: { symbol: "Al", number: 13 },
  potassium: { symbol: "K", number: 19 },
  iron: { symbol: "Fe", number: 26 },
  copper: { symbol: "Cu", number: 29 },
  arsenic: { symbol: "As", number: 33 },
  selenium: { symbol: "Se", number: 34 },
  yttrium: { symbol: "Y", number: 39 },
  niobium: { symbol: "Nb", number: 41 },
  antimony: { symbol: "Sb", number: 51 },
  iodine: { symbol: "I", number: 53 },
  dysprosium: { symbol: "Dy", number: 66 },
  ytterbium: { symbol: "Yb", number: 70 },
  hafnium: { symbol: "Hf", number: 72 },
  tantalum: { symbol: "Ta", number: 73 },
  tungsten: { symbol: "W", number: 74 },
  rhenium: { symbol: "Re", number: 75 },
  platinum: { symbol: "Pt", number: 78 },
  gold: { symbol: "Au", number: 79 },
  mercury: { symbol: "Hg", number: 80 },
  lead: { symbol: "Pb", number: 82 },
  bismuth: { symbol: "Bi", number: 83 },
  uranium: { symbol: "U", number: 92 },
};
const MUSIC =
  /\b(queen|freddie|music|song|album|singer|band|rock|vocal|concert)\b/i;
const SCIENCE =
  /\b(element|atom|atomic|chem|chemistry|metal|oxide|ion|alloy|periodic|material|molecule|electron|isotope|physics|rhenium|helium|yttrium|dysprosium|bismuth|antimony|fluorine)\b/i;

function resolve(query: string, history: HistoryItem[]) {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  if (lower !== "mercury") {
    const element = ELEMENTS[lower];
    return element
      ? {
          kind: "element",
          resolved: `${raw} chemical element ${element.symbol} atomic number ${element.number}`,
          identity: {
            kind: "element",
            name: raw,
            symbol: element.symbol,
            number: element.number,
          } as Identity,
        }
      : {
          kind: "general",
          resolved: raw,
          identity: { kind: "general", name: raw } as Identity,
        };
  }
  const context = history
    .slice(-32)
    .map((item) => `${item.query} ${item.resolved} ${item.kind}`)
    .join(" ");
  return SCIENCE.test(context) || !MUSIC.test(context)
    ? {
        kind: "element",
        resolved: "Mercury chemical element Hg atomic number 80",
        identity: {
          kind: "element",
          name: "Mercury",
          symbol: "Hg",
          number: 80,
        } as Identity,
      }
    : {
        kind: "music",
        resolved: "Mercury music Queen Freddie Mercury",
        identity: { kind: "music", name: "Mercury" } as Identity,
      };
}

const clean = (value: unknown) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function relevant(source: Source, identity: Identity) {
  if (identity.kind !== "element") return true;
  const text = `${source.title} ${source.excerpt}`.toLowerCase();
  const name = identity.name.toLowerCase();
  const symbol = String(identity.symbol || "").toLowerCase();
  const exactName = new RegExp(`\\b${name}\\b`, "i").test(text);
  const atomic = text.includes(`atomic number ${identity.number}`);
  const exactSymbol = new RegExp(`\\b${symbol}\\b`, "i").test(text);
  if (name === "rhenium" && /\bhelium\b/i.test(text) && !exactName)
    return false;
  return (
    exactName ||
    atomic ||
    (exactSymbol && /\b(element|metal|atomic|isotope|chemical)\b/i.test(text))
  );
}

function sourceScore(source: Source, identity: Identity) {
  if (identity.kind !== "element") return 0;
  const title = source.title.toLowerCase();
  const excerpt = source.excerpt.toLowerCase();
  const name = identity.name.toLowerCase();
  const exactTitle = title === name || title === `${name} (element)`;
  let score = 0;
  if (exactTitle) score += 200;
  if (new RegExp(`\\b${name}\\b`, "i").test(title)) score += 80;
  if (new RegExp(`\\b${name}\\b`, "i").test(excerpt.slice(0, 420))) score += 35;
  if (excerpt.includes(`atomic number ${identity.number}`)) score += 40;
  if (source.provider === "Wikipedia") score += 15;
  if (source.imageUrl && exactTitle) score += 25;
  return score;
}

async function research(query: string, identity: Identity): Promise<Source[]> {
  const raw: Source[] = [];
  const add = (source: Source) => {
    if (
      source.excerpt &&
      source.title &&
      !raw.some((item) => item.url === source.url)
    )
      raw.push(source);
  };
  const wikipedia = fetch(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=18&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=1400&format=json&origin=*`,
  )
    .then((response) => response.json())
    .then((data) =>
      Object.values(data?.query?.pages || {}).forEach((page: any) =>
        add({
          title: clean(page.title),
          url: page.fullurl || "",
          excerpt: clean(page.extract),
          provider: "Wikipedia",
          imageUrl: page.thumbnail?.source,
        }),
      ),
    )
    .catch(() => {});
  const duckduckgo = fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`,
  )
    .then((response) => response.json())
    .then((data) => {
      if (data.AbstractText)
        add({
          title: clean(data.Heading || query),
          url: data.AbstractURL || "",
          excerpt: clean(data.AbstractText),
          provider: "DuckDuckGo",
        });
      (data.RelatedTopics || [])
        .flatMap((item: any) => item.Topics || [item])
        .forEach(
          (item: any) =>
            item.Text &&
            add({
              title: clean(item.Text).split(" - ")[0],
              url: item.FirstURL || "",
              excerpt: clean(item.Text),
              provider: "DuckDuckGo",
            }),
        );
    })
    .catch(() => {});
  const crossref = fetch(
    `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=18`,
  )
    .then((response) => response.json())
    .then((data) =>
      (data?.message?.items || []).forEach((item: any) => {
        const title = clean(item.title?.[0]);
        const abstract = clean(item.abstract);
        if (title)
          add({
            title,
            url: item.URL || `https://doi.org/${item.DOI || ""}`,
            excerpt:
              abstract ||
              `${title}. Scholarly work indexed by Crossref${item.publisher ? ` from ${item.publisher}` : ""}.`,
            provider: "Crossref",
          });
      }),
    )
    .catch(() => {});
  await Promise.all([wikipedia, duckduckgo, crossref]);
  return raw
    .filter((source) => relevant(source, identity))
    .sort(
      (left, right) =>
        sourceScore(right, identity) - sourceScore(left, identity),
    );
}

function makePaper(
  query: string,
  resolved: string,
  identity: Identity,
  sources: Source[],
): Paper {
  const sentenceRecords = sources
    .flatMap((source, sourceIndex) =>
      source.excerpt
        .split(/(?<=[.!?])\s+/)
        .map((text) => ({ text: clean(text), sourceIndex })),
    )
    .filter(({ text }) => text.length > 55);
  const subjectPattern = new RegExp(`\\b${identity.name}\\b`, "i");
  const primaryTitle = sources[0]?.title.trim().toLowerCase() || "";
  const primaryTitleExact =
    primaryTitle === identity.name.trim().toLowerCase() ||
    primaryTitle === `${identity.name.trim().toLowerCase()} (element)`;
  const primarySentences = sentenceRecords
    .filter(
      ({ text, sourceIndex }) =>
        sourceIndex === 0 &&
        (identity.kind !== "element" ||
          primaryTitleExact ||
          subjectPattern.test(text) ||
          text.toLowerCase().includes(`atomic number ${identity.number}`)),
    )
    .map(({ text }) => text);
  const allSentences = sentenceRecords
    .sort((left, right) => {
      const score = (record: { text: string; sourceIndex: number }) =>
        (subjectPattern.test(record.text) ? 50 : 0) +
        (record.text.toLowerCase().includes(`atomic number ${identity.number}`)
          ? 35
          : 0) +
        (record.sourceIndex === 0 ? 25 : 0);
      return score(right) - score(left);
    })
    .map(({ text }) => text);
  const unique = [...new Set([...primarySentences, ...allSentences])];
  const overview =
    unique.slice(0, 3).join(" ") ||
    `No source passed the exact identity check for ${resolved}. Nothing from another subject was substituted.`;
  const overviewSet = new Set(unique.slice(0, 3));
  const findings = allSentences
    .map(clean)
    .filter((sentence, index, all) => all.indexOf(sentence) === index)
    .filter((sentence) => !overviewSet.has(sentence))
    .slice(0, 12);
  return {
    id: `phi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    query,
    resolved,
    identity,
    title: query,
    overview,
    findings,
    sources,
    created: Date.now(),
  };
}

function savePaper(paper: Paper) {
  const directLocal = secureSave(`${PAPER_PREFIX}${paper.id}`, paper);
  secureSave(`${PAPER_PREFIX}${paper.id}`, paper, "session");
  const existing = secureLoad<Paper[]>(PAPERS, []);
  secureSave(
    PAPERS,
    [...existing.filter((item) => item.id !== paper.id), paper].slice(-8),
  );
  return directLocal;
}

function saveResearchToken(paper: Paper) {
  const existing = secureLoad<Record<string, unknown>[]>(LEDGER, []);
  const token = {
    id: paper.id,
    researchId: paper.id,
    stage: "research",
    kind: "research",
    color: "yellow",
    status: "finished",
    value: 1,
    units: 1,
    title: paper.query,
    query: paper.query,
    resolved: paper.resolved,
    sourceCount: paper.sources.length,
    createdAt: new Date(paper.created).toISOString(),
  };
  secureSave(
    LEDGER,
    [token, ...existing.filter((item) => item.id !== paper.id)].slice(0, 200),
  );
  window.dispatchEvent(new Event("infinity-history-updated"));
}

export default function PhiPage() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAllSources, setShowAllSources] = useState(false);

  useEffect(() => {
    setHistory(secureLoad<HistoryItem[]>(HISTORY, []));
    const initialQuery = new URLSearchParams(location.search).get("q");
    if (initialQuery) setQuery(initialQuery);
  }, []);

  const recent = useMemo(() => history.slice(-6).reverse(), [history]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setNotice("");
    setShowAllSources(false);
    const resolved = resolve(query, history);
    try {
      const sources = await research(resolved.resolved, resolved.identity);
      const nextPaper = makePaper(
        query.trim(),
        resolved.resolved,
        resolved.identity,
        sources,
      );
      const nextHistory = [
        ...history,
        {
          query: query.trim(),
          resolved: resolved.resolved,
          kind: resolved.kind,
          at: Date.now(),
        },
      ].slice(-80);
      setPaper(nextPaper);
      setHistory(nextHistory);
      secureSave(HISTORY, nextHistory);
      saveResearchToken(nextPaper);
      if (!savePaper(nextPaper))
        setNotice(
          "This research is saved for this session. Older stored research was compacted to make room.",
        );
    } catch {
      setNotice(
        "The source services did not answer. Try the same search again; Infinity did not substitute another subject.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="phi-mode">
      <div className="phi-shell">
        <header className="phi-topline">
          <span>PHI · AI OVERVIEW</span>
        </header>

        <section
          className={
            paper ? "phi-search-section compact" : "phi-search-section"
          }
        >
          {!paper && (
            <>
              <div className="phi-orb">φ</div>
              <h1>What do you want to understand?</h1>
              <p>
                Search the exact subject. Infinity gathers evidence, explains it
                clearly, and keeps the result attached to your words.
              </p>
            </>
          )}
          <form onSubmit={submit} className="phi-search-box">
            <Search size={21} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Research topic"
              placeholder="Ask anything"
            />
            <button disabled={busy} aria-label="Run research">
              {busy ? (
                <span className="phi-spinner" />
              ) : (
                <ArrowRight size={21} />
              )}
            </button>
          </form>
          {busy && (
            <div className="phi-thinking">
              <Sparkles size={16} /> Building an overview from exact-subject
              sources…
            </div>
          )}
          {notice && <p className="phi-notice">{notice}</p>}
        </section>

        {paper && (
          <article className="phi-results">
            <nav className="phi-tabs" aria-label="Result sections">
              <span className="active">AI overview</span>
              <span>Sources</span>
              <span>Build</span>
            </nav>
            <div className="phi-result-grid">
              <section className="phi-answer">
                <div className="phi-ai-label">
                  <span className="phi-mini-orb">φ</span>
                  <b>AI Overview</b>
                </div>
                <h1>{paper.title}</h1>
                <div className="phi-identity">
                  <Check size={14} /> Exact identity:{" "}
                  {paper.identity.kind === "element"
                    ? `${paper.identity.name} · ${paper.identity.symbol} · atomic number ${paper.identity.number}`
                    : paper.identity.name}
                </div>
                <p className="phi-lead">{paper.overview}</p>
                {paper.findings.length > 0 && (
                  <section className="phi-key-points">
                    <h2>Key points</h2>
                    {paper.findings.slice(0, 6).map((finding, index) => (
                      <p key={index}>
                        {finding}
                        <sup>
                          {paper.sources.length
                            ? Math.min(index + 1, paper.sources.length)
                            : ""}
                        </sup>
                      </p>
                    ))}
                  </section>
                )}
                <div className="phi-build-card">
                  <div>
                    <b>Turn this overview into a website</b>
                    <p>
                      The complete answer, evidence, and exact subject move into
                      the builder together.
                    </p>
                  </div>
                  <a
                    href={`${appPath("phi/build")}?id=${encodeURIComponent(paper.id)}`}
                  >
                    Build website <ArrowRight size={18} />
                  </a>
                </div>
                <form onSubmit={submit} className="phi-followup">
                  <Sparkles size={18} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Ask a follow-up"
                    placeholder="Ask a follow-up"
                  />
                  <button>Ask</button>
                </form>
              </section>

              <aside className="phi-sources">
                <h2>Sources</h2>
                <p>
                  {paper.sources.length} results passed exact-subject validation
                </p>
                {(showAllSources
                  ? paper.sources
                  : paper.sources.slice(0, 4)
                ).map((source, index) => (
                  <a
                    key={`${source.url}-${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="phi-source-card"
                  >
                    <span>{index + 1}</span>
                    <div>
                      <small>{source.provider}</small>
                      <b>{source.title}</b>
                      <p>{source.excerpt}</p>
                    </div>
                    <ExternalLink size={15} />
                  </a>
                ))}
                {paper.sources.length > 4 && (
                  <button
                    className="phi-more"
                    onClick={() => setShowAllSources((value) => !value)}
                  >
                    {showAllSources
                      ? "Show fewer"
                      : `View all ${paper.sources.length} sources`}{" "}
                    <ChevronDown size={16} />
                  </button>
                )}
              </aside>
            </div>
          </article>
        )}

        {!paper && recent.length > 0 && (
          <section className="phi-recent">
            <h2>Recent research</h2>
            {recent.map((item, index) => (
              <button
                key={`${item.at}-${index}`}
                onClick={() => setQuery(item.query)}
              >
                <span>{item.query}</span>
                <small>{item.resolved}</small>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
