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
  /** Hierarchical Phi index depth: # = 1, ## = 2, through ####### = 7. */
  depth?: number;
  /** Human-readable branch address, for example #1/##2/###1. */
  hashPath?: string;
  /** Parent orange-card key when this card was spawned from another card. */
  parentKey?: string;
  /** Reusable answer-node id. Several questions may point to the same answer. */
  answerHash?: string;
  /** Cross-cutting sectors used as filters without duplicating the answer node. */
  sectors?: string[];
};

const TASK = new Set([
  "research", "researching", "study", "studies", "explain", "explanation", "overview",
  "find", "search", "show", "tell", "learn", "information", "info", "please", "about",
]);

const INTERNAL = /\b(orange card|orange cards|purple card|purple cards|magazine brief|storyboard draft|contextual keyword pass|research & add|open advanced workbench|create publication|phi keeps|the overview only answers|choose an orange direction)\b/i;
const QUESTION_WORD = /\b(who|what|when|where|why|how)\b/gi;
const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const sentenceList = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((line) => line.length > 42 && !INTERNAL.test(line));
const rawTokens = (value: string): string[] => Array.from(clean(value).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || []);

/**
 * Turn the user's request back into a stable subject before it becomes a card title.
 * This is the guard that prevents phrases such as "How is what is rhenium ...?".
 */
export function normalizeSemanticSubject(value: string) {
  let subject = clean(value).replace(/[?.!]+$/g, "");
  const wrappers = [
    /^(?:please\s+)?(?:tell me about|give me information about|give me an overview of|research|researching|study|explain|find|search for|show me)\s+/i,
    /^(?:what is|what are|who is|who was|where is|where are|when was|when is|why is|why are|how is|how are|how does|how do)\s+/i,
  ];
  for (let pass = 0; pass < 3; pass += 1) {
    const before = subject;
    for (const wrapper of wrappers) subject = subject.replace(wrapper, "");
    subject = clean(subject).replace(/^["'`]+|["'`]+$/g, "");
    if (subject === before) break;
  }
  return subject || clean(value) || "this subject";
}

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
  const terms = semanticTerms(normalizeSemanticSubject(subject));
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
  const stableSubject = normalizeSemanticSubject(subject);
  const ranked = sourceSentences(sources)
    .map((item) => ({ ...item, score: definitionScore(item.body, stableSubject) }))
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

type IntentSpec = { id: string; cues: RegExp; base: number };

/**
 * Answer classifiers. A card is created only when its answer actually contains
 * evidence for that intent; subject-name overlap alone is never enough.
 */
const INTENTS: IntentSpec[] = [
  { id: "definition", cues: /\b(is|are|means|refers to|defined as|known as|chemical element|material|organism|process|crop|food)\b/i, base: 5.8 },
  { id: "who", cues: /\b(discover(?:ed|y)\s+(?:it\s+)?(?:was\s+)?by|invent(?:ed|ion)\s+(?:it\s+)?(?:was\s+)?by|scientist|inventor|discoverer|researcher|chemist|engineer|founder|team|laboratory)\w*\b/i, base: 5.2 },
  { id: "when", cues: /\b(\d{3,4}|century|year|date|era|period|first|early|later|historical|discovered|invented|introduced)\b/i, base: 5.1 },
  { id: "where", cues: /\b(found|occurs|location|region|country|mine|mineral|deposit|source|grown|produced in|native|geographic|reserves?)\w*\b/i, base: 5.0 },
  { id: "origin", cues: /\b(origin|originate|discover|discovered|invent|invented|developed|named|introduced|history|ancient|traditional)\w*\b/i, base: 4.9 },
  { id: "used", cues: /\b(use|used|uses|application|applied|industry|device|tool|cooking|medicine|technology|purpose|superalloy|catalyst)\w*\b/i, base: 4.8 },
  { id: "made", cues: /\b(make|made|manufactur|produce|production|formed|formation|create|created|synthes|prepare|process|fabricat|extract|refin)\w*\b/i, base: 4.7 },
  { id: "why", cues: /\b(because|reason|therefore|so that|advantage|preferred|important|benefit|allows|enables|results in|valuable|rare)\b/i, base: 4.6 },
  { id: "mechanism", cues: /\b(mechanism|works|working|causes|react|reaction|resist|resistance|conduct|structure|bond|electron|pressure|temperature|creep|oxidation)\w*\b/i, base: 4.5 },
  { id: "types", cues: /\b(type|types|variety|varieties|category|categories|class|classes|form|forms|kind|kinds|grade|species)\w*\b/i, base: 4.3 },
  { id: "comparison", cues: /\b(compared|comparison|versus|vs|unlike|similar|similarity|higher|lower|more than|less than|alternative|homologue|group)\b/i, base: 4.2 },
  { id: "safety", cues: /\b(safety|hazard|risk|toxicity|toxic|exposure|danger|health|radioactive|handling)\w*\b/i, base: 4.0 },
  { id: "evidence", cues: /\b(measured|measurement|experiment|evidence|study|data|observed|tested|record|analysis|confirmed)\w*\b/i, base: 3.9 },
  { id: "future", cues: /\b(future|potential|emerging|researchers|investigat|unresolved|unknown|development|experimental|prototype|could)\w*\b/i, base: 3.8 },
];

function intentScore(body: string, subject: string, spec: IntentSpec, focus = "") {
  const lower = body.toLowerCase();
  if (!spec.cues.test(lower)) return 0;
  let score = spec.base;
  score += Math.min(3, subjectHit(body, subject)) * 0.8;
  if (focus) score += overlap(body, focus) * 1.4;
  if (/\d/.test(body) && ["when", "evidence"].includes(spec.id)) score += 1.5;
  if (body.length >= 90 && body.length <= 420) score += 0.6;
  return score;
}

function discoveryQuestion(subject: string, body: string) {
  if (/\bdiscover\w*\b/i.test(body)) return `How was ${subject} discovered?`;
  if (/\binvent\w*\b/i.test(body)) return `How was ${subject} invented?`;
  return `Where did ${subject} originate?`;
}

function titleFor(subject: string, intent: string, body: string) {
  const subjectName = normalizeSemanticSubject(subject);
  const lower = body.toLowerCase();
  if (intent === "definition") return `What is ${subjectName}?`;
  if (intent === "who") {
    if (/\bdiscover\w*\b/.test(lower)) return `Who discovered ${subjectName}?`;
    if (/\binvent\w*\b/.test(lower)) return `Who invented ${subjectName}?`;
    return `Who played a major role in ${subjectName}?`;
  }
  if (intent === "when") {
    if (/\bdiscover\w*\b/.test(lower)) return `When was ${subjectName} discovered?`;
    if (/\b(first|early)\b.*\b(use|used|application)\w*\b|\b(use|used)\w*\b.*\b(first|early)\b/.test(lower)) return `When was ${subjectName} first put to major use?`;
    if (/\binvent\w*\b/.test(lower)) return `When was ${subjectName} invented?`;
    return `When did ${subjectName} become important?`;
  }
  if (intent === "where") {
    if (/\b(grown|crop|cultivat)\w*\b/.test(lower)) return `Where is ${subjectName} grown?`;
    if (/\b(produc|manufactur|refin)\w*\b/.test(lower)) return `Where is ${subjectName} produced?`;
    if (/\b(found|occurs|mine|mineral|deposit|native|reserve)\w*\b/.test(lower)) return `Where is ${subjectName} found?`;
    return `Where is ${subjectName} most important?`;
  }
  if (intent === "origin") return discoveryQuestion(subjectName, body);
  if (intent === "used") return `What is ${subjectName} used for?`;
  if (intent === "made") return `How is ${subjectName} produced?`;
  if (intent === "why") {
    if (/\brare|scarce|abundan|supply\w*\b/.test(lower)) return `Why is ${subjectName} rare or difficult to supply?`;
    return `Why is ${subjectName} important?`;
  }
  if (intent === "mechanism") {
    if (/\b(alloy|strength|creep|resistance|temperature|material)\w*\b/.test(lower)) return `How does ${subjectName} affect material performance?`;
    if (/\b(react|reaction|bond|electron|oxidation|chemical)\w*\b/.test(lower)) return `How does ${subjectName} behave chemically?`;
    return `How does ${subjectName} work in this context?`;
  }
  if (intent === "types") return `What types or forms of ${subjectName} are there?`;
  if (intent === "comparison") return `What is ${subjectName} most useful to compare with?`;
  if (intent === "safety") return `What risks are associated with ${subjectName}?`;
  if (intent === "evidence") return `How strong is the evidence about ${subjectName}?`;
  if (intent === "future") return `How could ${subjectName} be used in the future?`;
  return `What should be investigated next about ${subjectName}?`;
}

export function isValidSemanticQuestion(value: string) {
  const title = clean(value);
  if (!/^(Who|What|When|Where|Why|How)\b/.test(title) || !title.endsWith("?")) return false;
  const words = title.match(QUESTION_WORD) || [];
  if (words.length !== 1) return false;
  if (/\b(how is what|how does what|what is what|who is who|when is when|where is where|why is why)\b/i.test(title)) return false;
  if (/\b(undefined|null|nan)\b/i.test(title)) return false;
  return title.length >= 8 && title.length <= 150;
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

function stableToken(prefix: string, value: string) {
  let hash = 0;
  const input = `${prefix}:${value}`;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

function stableKey(intent: string, body: string) { return stableToken(intent, body); }

const SECTOR_RULES: Record<string, RegExp> = {
  agriculture: /\b(farm|farming|crop|seed|soil|irrigat|livestock|grain|harvest|fertiliz|field)\w*\b/i,
  food: /\b(food|feed|meal|nutrition|cook|edible|kernel|starch|sweetener|oil)\w*\b/i,
  health: /\b(health|medical|medicine|disease|tox|nutrition|exposure|clinical|diet)\w*\b/i,
  energy: /\b(energy|fuel|ethanol|power|electric|furnace|boiler|heat|combust|battery)\w*\b/i,
  finance: /\b(finance|bank|credit|insurance|price|market|futures|cost|revenue|tax|subsid|grant|capital|investment)\w*\b/i,
  trade: /\b(trade|export|import|tariff|port|shipping|commodity|international)\w*\b/i,
  industry: /\b(industry|manufactur|factory|plant|refin|mill|material|alloy|fabricat|production)\w*\b/i,
  transportation: /\b(transport|rail|truck|barge|shipping|aviation|jet|vehicle|turbine)\w*\b/i,
  environment: /\b(environment|climate|water|emission|pollution|land|soil|waste|carbon)\w*\b/i,
  science: /\b(science|research|experiment|chemical|element|atom|biology|physics|electron|mineral)\w*\b/i,
  technology: /\b(technology|computer|ai|software|device|semiconductor|robot|data|digital)\w*\b/i,
  infrastructure: /\b(infrastructure|grid|warehouse|silo|pipeline|facility|network|refinery|plant)\w*\b/i,
  labor: /\b(labor|worker|employment|wage|job|workforce)\w*\b/i,
  regulation: /\b(regulat|law|standard|inspection|agency|policy|government|permit|rule)\w*\b/i,
  strategic: /\b(defense|military|strategic|critical mineral|reserve|security|supply risk|supply chain)\w*\b/i,
};

export function semanticSectors(value: string) {
  const text = clean(value);
  const sectors = Object.entries(SECTOR_RULES).filter(([, rule]) => rule.test(text)).map(([name]) => name);
  return sectors.length ? sectors : ["general"];
}

function indexedCard(card: SemanticCard, index: number, depth = 1, parent?: SemanticCard): SemanticCard {
  const safeDepth = Math.max(1, Math.min(7, depth));
  const marker = `${"#".repeat(safeDepth)}${index + 1}`;
  const path = parent?.hashPath ? `${parent.hashPath}/${marker}` : marker;
  const sectors = semanticSectors(`${card.title} ${card.body}`);
  return {
    ...card,
    depth: safeDepth,
    hashPath: path,
    parentKey: parent?.key,
    answerHash: stableToken("answer", card.body),
    sectors,
    keyword: [...new Set([...semanticTerms(card.keyword), ...sectors])].join(" "),
  };
}

/**
 * Jeopardy-style generation: collect answer sentences first, classify them, then
 * turn only supported classifications into clean questions. The answer is the
 * reusable node; the orange card is a navigational question pointing at it.
 */
export function buildSemanticExpansionCards(subject: string, overview: string, sources: SemanticSource[], findings: string[] = [], focus = "", exclude: SemanticCard[] = [], limit = 12): SemanticCard[] {
  const stableSubject = normalizeSemanticSubject(subject);
  const records = sourceSentences(sources);
  const findingRecords = findings.map((body, index) => ({ body: clean(body), source: undefined as SemanticSource | undefined, sourceIndex: sources.length + index, sentenceIndex: 0 })).filter((record) => record.body && !INTERNAL.test(record.body));
  const candidates = [...records, ...findingRecords];
  const all = dedupeSemantic([...findings, ...records.map((record) => record.body)], [overview], 100);
  const excludedTitles = exclude.map((card) => card.title);
  const cards: SemanticCard[] = [];

  for (const spec of INTENTS) {
    const best = candidates
      .map((record) => ({ ...record, score: intentScore(record.body, stableSubject, spec, focus) }))
      .filter((record) => record.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const body = paragraphFor(best.body, all, overview);
    if (!body || INTERNAL.test(body)) continue;
    const title = titleFor(stableSubject, spec.id, body);
    if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, [...excludedTitles, ...cards.map((card) => card.title)])) continue;
    const keywords = [...semanticTerms(title), ...semanticTerms(body).slice(0, 10)];
    cards.push({ key: stableKey(spec.id, `${title}:${body}`), title, body, keyword: [...new Set(keywords)].join(" "), intent: spec.id, source: best.source });
    if (cards.length >= limit) break;
  }

  if (cards.length < Math.min(6, limit)) {
    const usedAnswers = cards.map((card) => card.body);
    const fallback = all.filter((body) => !semanticallyRepeats(body, usedAnswers)).sort((a, b) => subjectHit(b, stableSubject) - subjectHit(a, stableSubject));
    for (const body of fallback) {
      const intent = INTENTS.find((spec) => spec.cues.test(body))?.id || "next";
      const source = records.find((record) => record.body === body)?.source;
      const paragraph = paragraphFor(body, all, overview);
      if (!paragraph || INTERNAL.test(paragraph)) continue;
      const title = titleFor(stableSubject, intent, paragraph);
      if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, [...excludedTitles, ...cards.map((card) => card.title)])) continue;
      cards.push({ key: stableKey(intent, `${title}:${paragraph}`), title, body: paragraph, keyword: [...semanticTerms(paragraph).slice(0, 10)].join(" "), intent, source });
      if (cards.length >= limit) break;
    }
  }

  return cards.map((card, index) => indexedCard(card, index, 1));
}

export function spawnSemanticExpansionCards(subject: string, overview: string, seed: SemanticCard, sources: SemanticSource[], findings: string[], existing: SemanticCard[]) {
  const stableSubject = normalizeSemanticSubject(subject);
  const focus = `${seed.title} ${seed.keyword} ${seed.body}`;
  const preferredByIntent: Record<string, string[]> = {
    definition: ["origin", "who", "when", "where", "used", "types"],
    who: ["when", "origin", "where", "evidence"],
    when: ["origin", "who", "evidence", "used"],
    where: ["made", "industry", "used", "why"],
    origin: ["when", "who", "where", "why"],
    mechanism: ["why", "comparison", "used", "evidence"],
    why: ["mechanism", "used", "comparison", "future"],
    made: ["mechanism", "why", "types", "where"],
    used: ["why", "mechanism", "comparison", "future"],
    types: ["comparison", "used", "made", "where"],
  };
  const generated = buildSemanticExpansionCards(stableSubject, overview, sources, findings, focus, existing, 12);
  const preferred = preferredByIntent[seed.intent] || [];
  const depth = Math.min((seed.depth || 1) + 1, 7);
  const chosen = generated
    .sort((a, b) => {
      const ai = preferred.indexOf(a.intent), bi = preferred.indexOf(b.intent);
      const preferredScore = (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      if (preferredScore) return preferredScore;
      return overlap(b.body, focus) - overlap(a.body, focus);
    })
    .filter((card) => card.key !== seed.key && !semanticallyRepeats(card.title, existing.map((item) => item.title)))
    .slice(0, 6);
  return chosen.map((card, index) => indexedCard(card, index, depth, seed));
}

export function buildSemanticStoryboard<T extends { title: string; body: string }>(subject: string, overview: string, chosenCards: SemanticCard[], notes: T[]) {
  const stableSubject = normalizeSemanticSubject(subject);
  const candidates = [
    ...chosenCards.map((card) => ({ title: card.title.replace(/\?$/, ""), body: card.body, intent: card.intent })),
    ...notes.map((note) => ({ title: clean(note.title), body: clean(note.body), intent: "note" })),
  ].filter((item) => item.body && !INTERNAL.test(item.body) && !semanticallyRepeats(item.body, [overview]));
  const out: { id: string; title: string; body: string }[] = [];
  for (const item of candidates) {
    if (semanticallyRepeats(item.body, out.map((old) => old.body))) continue;
    out.push({ id: stableKey(item.intent, item.body), title: item.title || `A section about ${stableSubject}`, body: item.body });
    if (out.length >= 10) break;
  }
  return out;
}
