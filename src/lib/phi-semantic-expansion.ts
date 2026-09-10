import nlp from "compromise";
import Fuse from "fuse.js";
import { eng, removeStopwords } from "stopword";

export type SemanticSource = {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
};

export type SemanticCard = {
  key: string;
  title: string;
  body: string;
  keyword: string;
  intent: string;
  source?: SemanticSource;
};

const TASK = new Set([
  "research", "researching", "study", "studies", "explain", "explanation", "overview",
  "find", "search", "show", "tell", "learn", "information", "info", "please", "about",
]);

const INTERNAL = /\b(orange card|orange cards|purple card|purple cards|magazine brief|storyboard draft|contextual keyword pass|research & add|open advanced workbench|create publication|phi keeps|the overview only answers|choose an orange direction)\b/i;
const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentenceList = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((line) => line.length > 42 && !INTERNAL.test(line));
const rawTokens = (value: string) => clean(value).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [];

export function semanticTerms(value: string) {
  const raw = rawTokens(value);
  let withoutCommon = raw;
  try { withoutCommon = removeStopwords(raw, eng); } catch { withoutCommon = raw; }
  return [...new Set(withoutCommon.filter((word) => word.length > 2 && !TASK.has(word)))];
}

function setOf(value: string) { return new Set(semanticTerms(value)); }
function overlap(a: string, b: string) {
  const left = setOf(a), right = setOf(b);
  let score = 0;
  left.forEach((word) => { if (right.has(word)) score += 1; });
  return score;
}

function similarity(a: string, b: string) {
  const left = setOf(a), right = setOf(b);
  if (!left.size || !right.size) return clean(a).toLowerCase() === clean(b).toLowerCase() ? 1 : 0;
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  const union = new Set([...left, ...right]).size;
  return { jaccard: union ? shared / union : 0, shared, left: left.size, right: right.size };
}

export function semanticallyRepeats(text: string, prior: string[]) {
  const candidate = clean(text);
  if (!candidate || INTERNAL.test(candidate)) return true;
  for (const oldRaw of prior) {
    const old = clean(oldRaw);
    if (!old) continue;
    const sim = similarity(candidate, old);
    if (typeof sim === "number") {
      if (sim >= 0.98) return true;
      continue;
    }
    if (sim.jaccard >= 0.82) return true;
    const lengthRatio = Math.min(candidate.length, old.length) / Math.max(candidate.length, old.length);
    if (sim.shared >= 5 && lengthRatio >= 0.72) {
      const fuse = new Fuse([{ body: old }], { keys: ["body"], includeScore: true, threshold: 0.12, ignoreLocation: true });
      const result = fuse.search(candidate, { limit: 1 })[0];
      if (result?.score !== undefined && result.score < 0.055) return true;
    }
  }
  return false;
}

export function dedupeSemantic(items: string[], against: string[] = [], limit = 40) {
  const out: string[] = [];
  const prior = against.map(clean).filter(Boolean);
  for (const raw of items) {
    const line = clean(raw);
    if (!line || INTERNAL.test(line) || semanticallyRepeats(line, [...prior, ...out])) continue;
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

function sourceSentences(sources: SemanticSource[]) {
  return sources.flatMap((source, sourceIndex) => sentenceList(source.excerpt).map((body, sentenceIndex) => ({
    body,
    source,
    sourceIndex,
    sentenceIndex,
  })));
}

function subjectHit(text: string, subject: string) {
  const terms = semanticTerms(subject);
  const lower = text.toLowerCase();
  return terms.filter((term) => lower.includes(term)).length;
}

function definitionScore(text: string, subject: string) {
  const lower = text.toLowerCase();
  let score = subjectHit(text, subject) * 4;
  if (/\b(is|are|refers to|means|describes|known as|defined as|category of|type of|chemical element|food|material|process|organism)\b/.test(lower)) score += 5;
  if (/\b(first|invented|discovered|history|used|application|manufactur|production|because|therefore)\b/.test(lower)) score -= 1.5;
  if (text.length >= 80 && text.length <= 330) score += 1;
  return score;
}

export function buildDefinitionOverview(subject: string, sources: SemanticSource[], fallback = "") {
  const ranked = sourceSentences(sources)
    .map((item) => ({ ...item, score: definitionScore(item.body, subject) }))
    .sort((a, b) => b.score - a.score);
  const chosen = dedupeSemantic(ranked.filter((item) => item.score >= 4).map((item) => item.body), [], 2);
  const concise: string[] = [];
  let length = 0;
  for (const line of chosen) {
    if (length + line.length > 520 && concise.length) break;
    concise.push(line);
    length += line.length;
  }
  return concise.join(" ") || clean(fallback);
}

function nouns(value: string) {
  try {
    return (nlp(value).nouns().toSingular().out("array") as string[]).map(clean).filter(Boolean);
  } catch { return []; }
}

function verbs(value: string) {
  try {
    return (nlp(value).verbs().toInfinitive().out("array") as string[]).map(clean).filter(Boolean);
  } catch { return []; }
}

type IntentSpec = { id: string; cues: RegExp; base: number };

const INTENTS: IntentSpec[] = [
  { id: "made", cues: /\b(make|made|manufactur|produce|production|formed|formation|create|created|synthes|prepare|process|ripen|culture|fabricat|extract|refin)\w*\b/i, base: 5 },
  { id: "used", cues: /\b(use|used|uses|application|applied|industry|device|tool|cooking|medicine|technology|purpose)\w*\b/i, base: 5 },
  { id: "mechanism", cues: /\b(mechanism|works|working|causes|because|react|reaction|resist|resistance|conduct|structure|bond|electron|pressure|temperature)\w*\b/i, base: 4.6 },
  { id: "usefulness", cues: /\b(useful|benefit|advantage|valuable|value|important|performance|durable|efficient|strength|resistance|preferred)\w*\b/i, base: 4.4 },
  { id: "origin", cues: /\b(origin|originate|discover|discovered|invent|invented|developed|named|introduced|history|ancient|traditional)\w*\b/i, base: 4.1 },
  { id: "when", cues: /\b(\d{3,4}|century|year|date|era|period|first|early|later|modern|historical)\b/i, base: 3.8 },
  { id: "who", cues: /\b(scientist|inventor|discoverer|researcher|chemist|engineer|company|founder|people|person|team|laboratory)\w*\b/i, base: 3.7 },
  { id: "where", cues: /\b(found|occurs|location|region|country|mine|mineral|deposit|source|grown|produced in|native|geographic)\w*\b/i, base: 3.7 },
  { id: "why", cues: /\b(because|reason|therefore|so that|advantage|preferred|important|benefit|allows|enables|results in)\b/i, base: 3.9 },
  { id: "types", cues: /\b(type|types|variety|varieties|category|categories|class|classes|form|forms|kind|kinds|grade|species)\w*\b/i, base: 3.7 },
  { id: "comparison", cues: /\b(compared|comparison|versus|vs|unlike|similar|similarity|higher|lower|more than|less than|alternative|instead)\b/i, base: 3.8 },
  { id: "safety", cues: /\b(safety|hazard|risk|toxicity|toxic|exposure|danger|health|radioactive|handling)\w*\b/i, base: 3.5 },
  { id: "evidence", cues: /\b(measured|measurement|experiment|evidence|study|data|observed|tested|record|population|mintage|auction|analysis)\w*\b/i, base: 3.4 },
  { id: "future", cues: /\b(future|potential|emerging|researchers|investigat|unresolved|unknown|development|experimental|prototype)\w*\b/i, base: 3.3 },
];

function intentScore(body: string, subject: string, spec: IntentSpec, focus = "") {
  const lower = body.toLowerCase();
  let score = spec.cues.test(lower) ? spec.base : 0;
  score += Math.min(3, subjectHit(body, subject)) * 0.8;
  if (focus) score += overlap(body, focus) * 1.4;
  if (/\d/.test(body) && ["when", "evidence"].includes(spec.id)) score += 1.5;
  if (body.length >= 90 && body.length <= 420) score += 0.6;
  return score;
}

function titleFor(subject: string, intent: string, body: string) {
  const subjectName = clean(subject).replace(/[?.!]+$/, "");
  const bodyNouns = nouns(body).filter((noun) => !semanticTerms(subjectName).some((term) => noun.toLowerCase().includes(term))).slice(0, 2);
  const bodyVerbs = verbs(body).slice(0, 2);
  const detail = bodyNouns[0] ? `: ${bodyNouns[0].replace(/^./, (c) => c.toUpperCase())}` : "";
  if (intent === "made") return `How is ${subjectName} made${detail}?`;
  if (intent === "used") return `How is ${subjectName} used${detail}?`;
  if (intent === "mechanism") return bodyVerbs[0] ? `How does ${subjectName} ${bodyVerbs[0]}?` : `How does ${subjectName} work?`;
  if (intent === "usefulness") return `What makes ${subjectName} useful${detail}?`;
  if (intent === "origin") return `Where did ${subjectName} come from?`;
  if (intent === "when") return `When did this part of the ${subjectName} story happen?`;
  if (intent === "who") return `Who shaped the ${subjectName} story?`;
  if (intent === "where") return `Where does ${subjectName} occur or matter?`;
  if (intent === "why") return `Why does this matter for ${subjectName}?`;
  if (intent === "types") return `What kinds of ${subjectName} are there${detail}?`;
  if (intent === "comparison") return `What should ${subjectName} be compared with${detail}?`;
  if (intent === "safety") return `What risks or limits come with ${subjectName}?`;
  if (intent === "evidence") return `What evidence tells us this about ${subjectName}?`;
  if (intent === "future") return `What could change next for ${subjectName}?`;
  return `What should we understand next about ${subjectName}?`;
}

function paragraphFor(seed: string, all: string[], overview: string) {
  const seedTerms = semanticTerms(seed);
  const ranked = all
    .filter((line) => line !== seed && !semanticallyRepeats(line, [overview, seed]))
    .map((line) => ({ line, score: seedTerms.filter((term) => line.toLowerCase().includes(term)).length + overlap(line, seed) }))
    .sort((a, b) => b.score - a.score);
  const extra = ranked.find((item) => item.score > 0)?.line;
  const body = dedupeSemantic([seed, extra || ""], [overview], 2).join(" ");
  return body || (!semanticallyRepeats(seed, [overview]) ? seed : "");
}

function stableKey(intent: string, body: string) {
  let hash = 0;
  const value = `${intent}:${body}`;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return `${intent}-${Math.abs(hash).toString(36)}`;
}

export function buildSemanticExpansionCards(subject: string, overview: string, sources: SemanticSource[], findings: string[] = [], focus = "", exclude: SemanticCard[] = [], limit = 12): SemanticCard[] {
  const records = sourceSentences(sources);
  const findingRecords = findings.map((body, index) => ({ body: clean(body), source: undefined as SemanticSource | undefined, sourceIndex: sources.length + index, sentenceIndex: 0 })).filter((record) => record.body && !INTERNAL.test(record.body));
  const candidates = [...records, ...findingRecords];
  const all = dedupeSemantic([...findings, ...records.map((record) => record.body)], [overview], 80);
  const usedBodies = [...exclude.map((card) => card.body), overview];
  const cards: SemanticCard[] = [];

  for (const spec of INTENTS) {
    const best = candidates
      .map((record) => ({ ...record, score: intentScore(record.body, subject, spec, focus) }))
      .filter((record) => record.score > 0 && !semanticallyRepeats(record.body, usedBodies))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const body = paragraphFor(best.body, all, overview);
    if (!body || INTERNAL.test(body) || semanticallyRepeats(body, usedBodies)) continue;
    const title = titleFor(subject, spec.id, body);
    const keywords = [...semanticTerms(title), ...semanticTerms(body).slice(0, 7)];
    cards.push({ key: stableKey(spec.id, body), title, body, keyword: [...new Set(keywords)].join(" "), intent: spec.id, source: best.source });
    usedBodies.push(body);
    if (cards.length >= limit) break;
  }

  if (cards.length < Math.min(6, limit)) {
    const fallback = all.filter((body) => !semanticallyRepeats(body, usedBodies)).sort((a, b) => subjectHit(b, subject) - subjectHit(a, subject));
    for (const body of fallback) {
      const intent = INTENTS.find((spec) => spec.cues.test(body))?.id || "next";
      const source = records.find((record) => record.body === body)?.source;
      const paragraph = paragraphFor(body, all, overview);
      if (!paragraph || INTERNAL.test(paragraph) || semanticallyRepeats(paragraph, usedBodies)) continue;
      cards.push({ key: stableKey(intent, paragraph), title: titleFor(subject, intent, paragraph), body: paragraph, keyword: [...semanticTerms(paragraph).slice(0, 8)].join(" "), intent, source });
      usedBodies.push(paragraph);
      if (cards.length >= limit) break;
    }
  }

  return cards;
}

export function spawnSemanticExpansionCards(subject: string, overview: string, seed: SemanticCard, sources: SemanticSource[], findings: string[], existing: SemanticCard[]) {
  const focus = `${seed.title} ${seed.keyword} ${seed.body}`;
  const preferredByIntent: Record<string, string[]> = {
    when: ["origin", "who", "evidence", "comparison"], origin: ["when", "who", "where", "why"],
    mechanism: ["why", "comparison", "usefulness", "evidence"], usefulness: ["used", "mechanism", "comparison", "why"],
    made: ["mechanism", "why", "types", "where"], used: ["usefulness", "comparison", "mechanism", "future"],
    types: ["comparison", "used", "made", "where"],
  };
  const generated = buildSemanticExpansionCards(subject, overview, sources, findings, focus, existing, 8);
  const preferred = preferredByIntent[seed.intent] || [];
  return generated
    .sort((a, b) => { const ai = preferred.indexOf(a.intent), bi = preferred.indexOf(b.intent); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); })
    .filter((card) => card.key !== seed.key && !semanticallyRepeats(card.body, existing.map((item) => item.body)))
    .slice(0, 4);
}

export function buildSemanticStoryboard<T extends { title: string; body: string }>(subject: string, overview: string, chosenCards: SemanticCard[], notes: T[]) {
  const candidates = [
    ...chosenCards.map((card) => ({ title: card.title.replace(/\?$/, ""), body: card.body, intent: card.intent })),
    ...notes.map((note) => ({ title: clean(note.title), body: clean(note.body), intent: "note" })),
  ].filter((item) => item.body && !INTERNAL.test(item.body) && !semanticallyRepeats(item.body, [overview]));
  const out: { id: string; title: string; body: string }[] = [];
  for (const item of candidates) {
    if (semanticallyRepeats(item.body, out.map((old) => old.body))) continue;
    out.push({ id: stableKey(item.intent, item.body), title: item.title || `A section about ${subject}`, body: item.body });
    if (out.length >= 10) break;
  }
  return out;
}
