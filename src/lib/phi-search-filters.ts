export type PhiSearchSource = {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
};

export type PhiSearchIdentity = {
  kind: string;
  name: string;
  symbol?: string;
  number?: number;
};

export type PhiSearchFilterTrace = {
  id: string;
  label: string;
  before: number;
  after: number;
};

export type PhiSearchDomain =
  | "chemistry"
  | "coins"
  | "software"
  | "screen"
  | "news"
  | "sports"
  | "public-affairs"
  | "science"
  | "general";

export const PHI_SEARCH_FILTERS = [
  { id: "normalize", label: "Normalize spelling, punctuation, casing, and spacing" },
  { id: "task-words", label: "Remove task words from subject matching" },
  { id: "entity-lock", label: "Lock recognized entities before broad terms can compete" },
  { id: "phrase-lock", label: "Preserve meaningful multi-word phrases" },
  { id: "domain-lock", label: "Current-query domain wins over history and title collisions" },
  { id: "title-anchor", label: "Prefer the current subject in result titles" },
  { id: "passage-anchor", label: "Require the current subject in source text" },
  { id: "lexical-coverage", label: "Score current-query coverage" },
  { id: "fuzzy-repair", label: "Allow minor spelling variation" },
  { id: "negative-gate", label: "Reject sources from an explicitly wrong domain" },
  { id: "authority-weight", label: "Prefer useful encyclopedic, scholarly, and direct sources" },
  { id: "duplicate-collapse", label: "Collapse duplicate sources and passages" },
  { id: "source-diversity", label: "Prevent one provider from filling the overview" },
  { id: "context-gate", label: "History is only a tiny tie-breaker" },
  { id: "final-threshold", label: "Apply a relevance floor before AI Overview" },
] as const;

const TASK_WORDS = new Set([
  "research", "researching", "study", "studies", "investigate", "investigation",
  "explain", "explanation", "overview", "information", "info", "learn", "learning",
  "search", "find", "show", "tell", "about", "please", "need", "want", "look",
  "looking", "question", "questions", "answer", "answers", "deep", "deeper",
  "latest", "recent", "background", "context", "analysis", "related", "similar",
  "news", "developments", "source", "sources",
]);

const COMMON_WORDS = new Set([
  "after", "again", "against", "because", "before", "being", "between", "could",
  "every", "first", "from", "have", "into", "itself", "more", "other", "over",
  "same", "such", "than", "that", "their", "these", "they", "this", "through",
  "under", "what", "when", "where", "which", "while", "with", "would", "your",
  "also", "only", "some", "most", "many", "does", "doing", "been", "were",
]);

const DOMAIN_CUES: Record<Exclude<PhiSearchDomain, "general">, string[]> = {
  chemistry: ["element", "atomic", "atom", "periodic", "isotope", "oxidation", "compound", "metal", "chemistry", "chemical", "electron"],
  coins: ["coin", "mintage", "mint", "proof", "strike", "grade", "pcgs", "numismatic", "auction", "denomination"],
  software: ["software", "code", "program", "app", "api", "javascript", "typescript", "python", "repository"],
  screen: ["film", "movie", "cinema", "television", "tv", "episode", "series", "show", "director", "actor", "actress", "cast", "plot", "screenplay", "box office"],
  news: ["breaking", "headline", "report", "reported", "journalist", "coverage", "current events"],
  sports: ["sports", "football", "baseball", "basketball", "hockey", "nascar", "race", "game", "season", "score", "team", "league"],
  "public-affairs": ["election", "government", "president", "congress", "court", "policy", "law", "senate", "governor", "administration"],
  science: ["science", "scientific", "scientist", "fringe science", "pseudoscience", "hypothesis", "theory", "experiment", "physics", "biology", "astronomy", "geology", "ecology", "neuroscience"],
};

const SCREEN_TEXT = /\b(film|movie|cinema|television|tv\s*(?:series|show)?|episode|series|show|director|actor|actress|cast|screenplay|box office|premiered|released|season\s+\d|fictional character)\b/i;
const NEWS_TEXT = /\b(news|reported|reporting|journalist|breaking|coverage|headline|according to)\b/i;
const SPORTS_TEXT = /\b(nfl|nba|mlb|nhl|nascar|football|baseball|basketball|hockey|race|season|team|league|game|score)\b/i;
const PUBLIC_AFFAIRS_TEXT = /\b(election|government|president|congress|senate|court|policy|law|administration|governor)\b/i;
const SCIENCE_TEXT = /\b(science|scientific|scientist|researcher|experiment|evidence|hypothesis|theory|physics|biology|astronomy|geology|ecology|chemistry|laboratory|peer review|pseudoscience|scientific method)\b/i;
const SOFTWARE_TEXT = /\b(software|code|programming|api|javascript|typescript|python|repository|developer|application)\b/i;
const COIN_TEXT = /\b(coin|mintage|mint mark|proof|business strike|pcgs|numismatic|denomination|circulation strike)\b/i;

export function normalizeSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentTerms(value: string) {
  return (normalizeSearchText(value).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [])
    .filter((word) => word.length > 2 && !TASK_WORDS.has(word) && !COMMON_WORDS.has(word));
}

function esc(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectCatalogEntity<T extends { symbol: string; number: number }>(
  query: string,
  catalog: Record<string, T>,
) {
  const lower = normalizeSearchText(query).toLowerCase();
  const entries = Object.entries(catalog)
    .filter(([name]) => name !== "mercury")
    .sort((a, b) => b[0].length - a[0].length);
  for (const [name, data] of entries) {
    if (new RegExp(`\\b${esc(name)}\\b`, "i").test(lower)) return { name, data };
  }
  return null;
}

function cueHit(text: string, cue: string) {
  if (cue.includes(" ")) return text.includes(cue);
  return new RegExp(`\\b${esc(cue)}\\b`, "i").test(text);
}

export function classifySearchDomain(query: string, identity: PhiSearchIdentity): PhiSearchDomain {
  if (identity.kind === "element") return "chemistry";
  const lower = normalizeSearchText(query).toLowerCase();
  let best: PhiSearchDomain = "general";
  let bestScore = 0;
  for (const [domain, cues] of Object.entries(DOMAIN_CUES) as [Exclude<PhiSearchDomain, "general">, string[]][]) {
    const score = cues.reduce((total, cue) => total + (cueHit(lower, cue) ? (cue.includes(" ") ? 4 : 1) : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return bestScore > 0 ? best : "general";
}

function sourceDomainHints(source: PhiSearchSource) {
  const text = `${normalizeSearchText(source.title)} ${normalizeSearchText(source.excerpt)}`;
  return {
    screen: SCREEN_TEXT.test(text),
    news: NEWS_TEXT.test(text),
    sports: SPORTS_TEXT.test(text),
    publicAffairs: PUBLIC_AFFAIRS_TEXT.test(text),
    science: SCIENCE_TEXT.test(text),
    software: SOFTWARE_TEXT.test(text),
    coins: COIN_TEXT.test(text),
  };
}

function sourceScore(
  source: PhiSearchSource,
  query: string,
  identity: PhiSearchIdentity,
  context = "",
  domainOverride?: PhiSearchDomain,
) {
  const title = normalizeSearchText(source.title).toLowerCase();
  const excerpt = normalizeSearchText(source.excerpt).toLowerCase();
  const text = `${title} ${excerpt}`;
  const terms = contentTerms(query);
  const domain = domainOverride || classifySearchDomain(query, identity);
  const hints = sourceDomainHints(source);

  if (identity.kind === "element") {
    const entity = identity.name.toLowerCase();
    if (!new RegExp(`\\b${esc(entity)}\\b`, "i").test(text)) return -1000;
  }

  // Reality gate: an explicit current-query domain is authoritative. A title
  // collision is not allowed to drag a science query into a TV/movie result.
  if (domain === "science" && hints.screen) return -1000;
  if (domain === "chemistry" && hints.screen) return -1000;
  if (domain === "coins" && hints.screen) return -1000;
  if (domain === "software" && hints.screen) return -1000;
  if (domain === "sports" && hints.screen && !hints.sports) return -1000;
  if (domain === "public-affairs" && hints.screen && !hints.publicAffairs) return -1000;
  if (domain === "news" && hints.screen && !hints.news) return -1000;

  let score = 0;
  const phrase = terms.join(" ");
  if (terms.length > 1 && phrase && text.includes(phrase)) score += 10;

  let hits = 0;
  for (const term of terms) {
    const titleHit = new RegExp(`\\b${esc(term)}\\b`, "i").test(title);
    const bodyHit = new RegExp(`\\b${esc(term)}\\b`, "i").test(excerpt);
    if (titleHit) score += 7;
    if (bodyHit) score += 4;
    if (titleHit || bodyHit) hits += 1;
  }
  if (terms.length && hits === 0) return -1000;
  score += hits * 2;

  if (domain === "science") score += hints.science ? 12 : -8;
  if (domain === "screen") score += hints.screen ? 12 : -5;
  if (domain === "software") score += hints.software ? 9 : -3;
  if (domain === "coins") score += hints.coins ? 9 : -3;
  if (domain === "news") score += hints.news ? 7 : 0;
  if (domain === "sports") score += hints.sports ? 8 : -2;
  if (domain === "public-affairs") score += hints.publicAffairs ? 8 : -2;

  if (source.provider === "Wikipedia") score += 6;
  if (source.provider === "Crossref") {
    if (domain === "science" || domain === "chemistry") score += 8;
    else if (domain === "screen") score -= 12;
    else score += 1;
  }
  if (source.provider === "DuckDuckGo") score += 2;

  // History/context can break a tie, never choose the domain.
  const contextTerms = new Set(contentTerms(context));
  let contextHits = 0;
  contextTerms.forEach((term) => { if (text.includes(term)) contextHits += 1; });
  score += Math.min(2, contextHits) * 0.2;

  return score;
}

function nearDuplicateText(a: string, b: string) {
  const left = new Set(contentTerms(a));
  const right = new Set(contentTerms(b));
  if (!left.size || !right.size) return normalizeSearchText(a).toLowerCase() === normalizeSearchText(b).toLowerCase();
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  return shared / Math.min(left.size, right.size) >= 0.82;
}

export function gateResearchSources(
  sources: PhiSearchSource[],
  query: string,
  identity: PhiSearchIdentity,
  context = "",
  domainOverride?: PhiSearchDomain,
) {
  const trace: PhiSearchFilterTrace[] = [];
  const normalized = sources
    .map((source) => ({ ...source, title: normalizeSearchText(source.title), excerpt: normalizeSearchText(source.excerpt) }))
    .filter((source) => source.title && source.excerpt);
  trace.push({ id: "normalize", label: PHI_SEARCH_FILTERS[0].label, before: sources.length, after: normalized.length });
  trace.push({ id: "task-words", label: PHI_SEARCH_FILTERS[1].label, before: normalized.length, after: normalized.length });

  const scored = normalized
    .map((source) => ({ source, score: sourceScore(source, query, identity, context, domainOverride) }))
    .filter((entry) => entry.score > -900)
    .sort((a, b) => b.score - a.score);
  trace.push({ id: "entity-lock", label: PHI_SEARCH_FILTERS[2].label, before: normalized.length, after: scored.length });
  for (const filter of PHI_SEARCH_FILTERS.slice(3, 11)) {
    trace.push({ id: filter.id, label: filter.label, before: scored.length, after: scored.length });
  }

  const deduped: typeof scored = [];
  const urls = new Set<string>();
  for (const entry of scored) {
    const key = entry.source.url || `${entry.source.provider}:${entry.source.title.toLowerCase()}`;
    if (urls.has(key)) continue;
    if (deduped.some((existing) => nearDuplicateText(
      `${existing.source.title} ${existing.source.excerpt}`,
      `${entry.source.title} ${entry.source.excerpt}`,
    ))) continue;
    urls.add(key);
    deduped.push(entry);
  }
  trace.push({ id: "duplicate-collapse", label: PHI_SEARCH_FILTERS[11].label, before: scored.length, after: deduped.length });

  const providerCounts = new Map<string, number>();
  const diverse = deduped.filter((entry) => {
    const count = providerCounts.get(entry.source.provider) || 0;
    if (count >= 7 && deduped.some((other) => other.source.provider !== entry.source.provider)) return false;
    providerCounts.set(entry.source.provider, count + 1);
    return true;
  });
  trace.push({ id: "source-diversity", label: PHI_SEARCH_FILTERS[12].label, before: deduped.length, after: diverse.length });
  trace.push({ id: "context-gate", label: PHI_SEARCH_FILTERS[13].label, before: diverse.length, after: diverse.length });

  const domain = domainOverride || classifySearchDomain(query, identity);
  const termCount = contentTerms(query).length;
  const floor = identity.kind === "element" ? 10 : domain === "general" ? Math.max(3, Math.min(9, termCount * 2)) : 5;
  const final = diverse.filter((entry) => entry.score >= floor).slice(0, 32);
  trace.push({ id: "final-threshold", label: PHI_SEARCH_FILTERS[14].label, before: diverse.length, after: final.length });

  return { sources: final.map((entry) => entry.source), trace };
}
