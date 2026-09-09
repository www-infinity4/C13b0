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

export const PHI_SEARCH_FILTERS = [
  { id: "normalize", label: "Normalize spelling, punctuation, casing, and spacing" },
  { id: "task-words", label: "Remove task words such as research, explain, find, and overview from subject matching" },
  { id: "entity-lock", label: "Lock recognized entities before broad retrieval terms can compete" },
  { id: "phrase-lock", label: "Preserve meaningful multi-word phrases as one search idea" },
  { id: "domain-lock", label: "Keep results in the detected subject domain" },
  { id: "title-anchor", label: "Require or strongly prefer the subject in result titles" },
  { id: "passage-anchor", label: "Require the subject inside the actual source passage" },
  { id: "lexical-coverage", label: "Score how much of the meaningful query the source actually covers" },
  { id: "fuzzy-repair", label: "Allow small spelling differences without letting unrelated words through" },
  { id: "negative-gate", label: "Reject sources dominated by unrelated subject vocabulary" },
  { id: "authority-weight", label: "Prefer direct encyclopedic and scholarly subject matches over incidental mentions" },
  { id: "duplicate-collapse", label: "Collapse duplicate titles, URLs, and near-identical passages" },
  { id: "source-diversity", label: "Prevent one provider from filling the whole overview when alternatives exist" },
  { id: "context-gate", label: "Use recent Phi context only as a tie-breaker, never as a replacement for the current query" },
  { id: "final-threshold", label: "Apply a final relevance floor before a source can enter AI Overview" },
] as const;

const TASK_WORDS = new Set([
  "research", "researching", "study", "studies", "investigate", "investigation",
  "explain", "explanation", "overview", "information", "info", "learn", "learning",
  "search", "find", "show", "tell", "about", "please", "need", "want", "look",
  "looking", "question", "questions", "answer", "answers", "deep", "deeper",
]);

const COMMON_WORDS = new Set([
  "after", "again", "against", "because", "before", "being", "between", "could",
  "every", "first", "from", "have", "into", "itself", "more", "other", "over",
  "same", "such", "than", "that", "their", "these", "they", "this", "through",
  "under", "what", "when", "where", "which", "while", "with", "would", "your",
  "also", "only", "some", "most", "many", "does", "doing", "been", "were",
]);

const DOMAIN_CUES: Record<string, string[]> = {
  chemistry: ["element", "atomic", "atom", "periodic", "isotope", "oxidation", "compound", "metal", "chemistry", "chemical", "electron"],
  coins: ["coin", "mintage", "mint", "proof", "strike", "grade", "pcgs", "numismatic", "auction", "denomination"],
  software: ["software", "code", "program", "app", "api", "javascript", "typescript", "python", "repository"],
};

const OUTLIER_CUES = [
  "methane", "livestock", "rainforest", "deforestation", "agriculture", "emissions",
  "football", "soccer", "recipe", "celebrity", "tourism", "weather forecast",
];

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

function detectedDomain(query: string, identity: PhiSearchIdentity) {
  if (identity.kind === "element") return "chemistry";
  const lower = normalizeSearchText(query).toLowerCase();
  let best = "general";
  let bestScore = 0;
  for (const [domain, cues] of Object.entries(DOMAIN_CUES)) {
    const score = cues.filter((cue) => lower.includes(cue)).length;
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }
  return best;
}

function tokenDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let left = i;
    let diagonal = i - 1;
    for (let j = 1; j <= b.length; j += 1) {
      const up = prev[j];
      const next = Math.min(left + 1, up + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = up;
      prev[j] = next;
      left = next;
    }
  }
  return prev[b.length];
}

function fuzzyHit(term: string, words: string[]) {
  if (words.includes(term)) return true;
  if (term.length < 6) return false;
  return words.some((word) => Math.abs(word.length - term.length) <= 1 && tokenDistance(term, word) <= 1);
}

function nearDuplicateText(a: string, b: string) {
  const left = new Set(contentTerms(a));
  const right = new Set(contentTerms(b));
  if (!left.size || !right.size) return normalizeSearchText(a).toLowerCase() === normalizeSearchText(b).toLowerCase();
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  return shared / Math.min(left.size, right.size) >= 0.82;
}

function sourceScore(source: PhiSearchSource, query: string, identity: PhiSearchIdentity, context = "") {
  const title = normalizeSearchText(source.title).toLowerCase();
  const excerpt = normalizeSearchText(source.excerpt).toLowerCase();
  const text = `${title} ${excerpt}`;
  const words = text.match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [];
  const terms = contentTerms(query);
  const domain = detectedDomain(query, identity);
  let score = 0;

  // 3. entity lock
  if (identity.kind === "element") {
    const entity = identity.name.toLowerCase();
    const exactTitle = new RegExp(`\\b${esc(entity)}\\b`, "i").test(title);
    const exactBody = new RegExp(`\\b${esc(entity)}\\b`, "i").test(excerpt);
    if (!exactTitle && !exactBody) return -1000;
    if (exactTitle) score += 18;
    if (exactBody) score += 12;
  }

  // 4. phrase lock
  const phrase = terms.join(" ");
  if (terms.length > 1 && phrase && text.includes(phrase)) score += 9;

  // 5. domain lock
  if (domain !== "general") {
    const cues = DOMAIN_CUES[domain] || [];
    const domainHits = cues.filter((cue) => text.includes(cue)).length;
    if (domainHits) score += Math.min(8, domainHits * 2);
    else if (identity.kind !== "element") score -= 3;
  }

  // 6-9. title, passage, lexical, fuzzy gates
  let exactHits = 0;
  let fuzzyHits = 0;
  for (const term of terms) {
    const inTitle = title.includes(term);
    const inBody = excerpt.includes(term);
    if (inTitle) score += 7;
    if (inBody) score += 4;
    if (inTitle || inBody) exactHits += 1;
    else if (fuzzyHit(term, words)) {
      score += 1;
      fuzzyHits += 1;
    }
  }
  if (terms.length && exactHits + fuzzyHits === 0) return -1000;
  score += exactHits * 2;

  // 10. negative/outlier gate
  const outliers = OUTLIER_CUES.filter((cue) => text.includes(cue)).length;
  if (outliers && identity.kind === "element" && !title.includes(identity.name.toLowerCase())) score -= 18 * outliers;
  else score -= 3 * outliers;

  // 11. authority weighting
  if (source.provider === "Wikipedia" && title.includes(identity.name.toLowerCase())) score += 7;
  if (source.provider === "Crossref" && exactHits > 0) score += 4;
  if (source.provider === "DuckDuckGo" && exactHits === 0) score -= 4;

  // 14. context only as tie-breaker
  const contextTerms = new Set(contentTerms(context));
  let contextHits = 0;
  contextTerms.forEach((term) => { if (text.includes(term)) contextHits += 1; });
  score += Math.min(2, contextHits) * 0.5;

  return score;
}

export function gateResearchSources(
  sources: PhiSearchSource[],
  query: string,
  identity: PhiSearchIdentity,
  context = "",
) {
  const trace: PhiSearchFilterTrace[] = [];
  let current = sources
    .map((source) => ({ ...source, title: normalizeSearchText(source.title), excerpt: normalizeSearchText(source.excerpt) }))
    .filter((source) => source.title && source.excerpt);
  trace.push({ id: "normalize", label: PHI_SEARCH_FILTERS[0].label, before: sources.length, after: current.length });

  // Task words are removed by contentTerms before relevance scoring.
  trace.push({ id: "task-words", label: PHI_SEARCH_FILTERS[1].label, before: current.length, after: current.length });

  const scored = current
    .map((source) => ({ source, score: sourceScore(source, query, identity, context) }))
    .filter((entry) => entry.score > -900)
    .sort((a, b) => b.score - a.score);
  trace.push({ id: "entity-lock", label: PHI_SEARCH_FILTERS[2].label, before: current.length, after: scored.length });

  // Stages 4-11 are represented in sourceScore; report their surviving population.
  for (const filter of PHI_SEARCH_FILTERS.slice(3, 11)) {
    trace.push({ id: filter.id, label: filter.label, before: scored.length, after: scored.length });
  }

  const deduped: typeof scored = [];
  const urls = new Set<string>();
  for (const entry of scored) {
    const urlKey = entry.source.url || `${entry.source.provider}:${entry.source.title.toLowerCase()}`;
    if (urls.has(urlKey)) continue;
    if (deduped.some((existing) => nearDuplicateText(`${existing.source.title} ${existing.source.excerpt}`, `${entry.source.title} ${entry.source.excerpt}`))) continue;
    urls.add(urlKey);
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

  const floor = identity.kind === "element" ? 10 : Math.max(3, contentTerms(query).length * 2);
  const final = diverse.filter((entry) => entry.score >= floor).slice(0, 32);
  trace.push({ id: "final-threshold", label: PHI_SEARCH_FILTERS[14].label, before: diverse.length, after: final.length });

  return { sources: final.map((entry) => entry.source), trace };
}
