export type SemanticColor = "yellow" | "blue" | "green" | "pink" | "red" | "purple" | "orange";

export type SemanticTerm = {
  term: string;
  color: SemanticColor;
  score: number;
  reason: string;
  action: "search" | "contribute" | "engineer" | "priority-search" | "route" | "connect" | "decide";
};

type SourceSignal = { title?: string; excerpt?: string };
type HistorySignal = { query?: string; resolved?: string };

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "among", "because", "before", "being", "between",
  "both", "could", "does", "each", "from", "have", "into", "more", "most", "other", "over", "such",
  "than", "that", "their", "there", "these", "they", "this", "those", "through", "under", "using",
  "very", "were", "what", "when", "where", "which", "while", "with", "would", "your", "been", "will",
  "forms", "include", "includes", "including", "often", "many", "some", "only", "same", "well", "however",
]);

const NON_NOUNS = new Set([
  "able", "available", "common", "different", "directly", "early", "especially", "high", "important", "large",
  "likely", "main", "much", "new", "possible", "quickly", "related", "similar", "small", "strong", "widely",
]);

const SHORT_NOUNS = new Set(["gas", "ion", "oil", "air", "use", "web", "cell", "fuel", "heat", "data"]);
const DECISION_TERMS = new Set([
  "gas", "liquid", "solid", "plasma", "fuel", "storage", "scale", "method", "process", "path", "route",
  "option", "choice", "application", "applications", "source", "sources", "form", "state", "states",
]);
const ENGINEERING_TERMS = new Set([
  "engine", "engineering", "system", "systems", "device", "devices", "machine", "machines", "tool", "tools",
  "material", "materials", "alloy", "alloys", "catalyst", "catalysts", "reactor", "battery", "batteries",
  "sensor", "sensors", "motor", "motors", "generator", "generators", "chamber", "valve", "circuit", "circuits",
  "structure", "structures", "design", "designs", "energy", "pressure", "temperature", "conversion", "production",
]);

const NOUN_SUFFIX = /(tion|sion|ment|ness|ity|ism|ist|ance|ence|ship|age|ery|ics|ology|graphy|meter|scope|ware|ium|ide|ate|ite|ene|ogen|atom|ion)$/;
const WORD = /[A-Za-z][A-Za-z0-9'-]*/g;

export function normalizeSemanticTerm(value: string): string {
  const lower = value.toLowerCase().replace(/^['-]+|['-]+$/g, "");
  if (lower.length > 4 && lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.length > 4 && lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

function words(value: string): string[] {
  return (value.match(WORD) || []).map(normalizeSemanticTerm).filter(Boolean);
}

function counts(values: string[]): Map<string, number> {
  const output = new Map<string, number>();
  for (const value of values) output.set(value, (output.get(value) || 0) + 1);
  return output;
}

function looksLikeNoun(term: string, total: number, titleCount: number): boolean {
  if (STOP_WORDS.has(term) || NON_NOUNS.has(term) || /^\d+$/.test(term)) return false;
  if (SHORT_NOUNS.has(term)) return true;
  if (term.length < 4) return false;
  return titleCount > 0 || total > 1 || NOUN_SUFFIX.test(term) || ENGINEERING_TERMS.has(term) || DECISION_TERMS.has(term);
}

export function createSemanticIndex(input: {
  query: string;
  findings: string[];
  sources: SourceSignal[];
  history: HistorySignal[];
}): SemanticTerm[] {
  const queryWords = new Set(words(input.query));
  const findingCounts = counts(input.findings.flatMap(words));
  const sourceWords = input.sources.flatMap((source) => words(`${source.title || ""} ${source.excerpt || ""}`));
  const sourceCounts = counts(sourceWords);
  const titleCounts = counts(input.sources.flatMap((source) => words(source.title || "")));
  const historyCounts = counts(input.history.flatMap((item) => words(`${item.query || ""} ${item.resolved || ""}`)));
  const candidates = new Set([...findingCounts.keys(), ...queryWords, ...historyCounts.keys()]);
  const indexed: SemanticTerm[] = [];

  for (const term of candidates) {
    const findingCount = findingCounts.get(term) || 0;
    const sourceCount = sourceCounts.get(term) || 0;
    const titleCount = titleCounts.get(term) || 0;
    const historyCount = historyCounts.get(term) || 0;
    const total = findingCount + sourceCount + historyCount;
    if (!looksLikeNoun(term, total, titleCount)) continue;

    let color: SemanticColor = "yellow";
    let action: SemanticTerm["action"] = "search";
    let reason = "Fresh noun ready for a focused search";

    if (queryWords.has(term) || (historyCount > 0 && sourceCount > 0)) {
      color = "purple";
      action = "connect";
      reason = "Already connected to this token or prior imported research";
    } else if (DECISION_TERMS.has(term)) {
      color = "orange";
      action = "decide";
      reason = "Decision term that changes the website script";
    } else if (ENGINEERING_TERMS.has(term)) {
      color = "green";
      action = "engineer";
      reason = "Usable in an engineering or build direction";
    } else if (historyCount > 0) {
      color = "red";
      action = "route";
      reason = "Previously indexed and ready to route into this subject";
    } else if (titleCount > 0 || sourceCount >= 3) {
      color = "blue";
      action = "contribute";
      reason = "Open contribution point for expert detail or better search directives";
    } else if (findingCount >= 2 || (findingCount > 0 && sourceCount >= 2)) {
      color = "pink";
      action = "priority-search";
      reason = "High-value next research direction";
    }

    indexed.push({
      term,
      color,
      action,
      reason,
      score: findingCount * 7 + titleCount * 6 + Math.min(sourceCount, 8) * 2 + Math.min(historyCount, 4) * 3,
    });
  }

  const priority: Record<SemanticColor, number> = { pink: 0, yellow: 1, blue: 2, green: 3, orange: 4, red: 5, purple: 6 };
  return indexed.sort((left, right) => priority[left.color] - priority[right.color] || right.score - left.score || left.term.localeCompare(right.term));
}
