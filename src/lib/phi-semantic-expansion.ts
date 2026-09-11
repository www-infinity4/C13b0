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
  const { past } = semanticSubjectAgreement(subject);
  if (/\bdiscover\w*\b/i.test(body)) return `How ${past} ${subject} discovered?`;
  if (/\binvent\w*\b/i.test(body)) return `How ${past} ${subject} invented?`;
  return `Where did ${subject} originate?`;
}

const PLURAL_PRONOUNS = new Set(["they", "these", "those", "we", "you"]);
const PLURAL_IRREGULARS = new Set(["children", "data", "feet", "geese", "men", "mice", "people", "teeth", "women"]);
const SINGULAR_S_ENDINGS = new Set([
  "analysis", "apparatus", "basis", "business", "census", "class", "focus", "gas", "glass", "headquarters",
  "mathematics", "means", "news", "physics", "process", "series", "species", "status", "thesis", "virus",
]);

/** Infer the grammatical number of the subject heading used in generated cards. */
export function semanticSubjectIsPlural(value: string) {
  const subject = normalizeSemanticSubject(value).toLowerCase();
  if (/\b(?:and|&)\b/.test(subject)) return true;
  const headPhrase = subject.split(/\b(?:of|in|for|with|from|about)\b/)[0];
  const words = headPhrase.match(/[a-z]+(?:-[a-z]+)?/g) || [];
  const head = words.at(-1) || "";
  if (PLURAL_PRONOUNS.has(head) || PLURAL_IRREGULARS.has(head)) return true;
  if (SINGULAR_S_ENDINGS.has(head) || /(?:ss|us|is|ics)$/.test(head)) return false;
  return /s$/.test(head);
}

function semanticSubjectAgreement(subject: string) {
  const plural = semanticSubjectIsPlural(subject);
  return { present: plural ? "are" : "is", past: plural ? "were" : "was", auxiliary: plural ? "do" : "does" } as const;
}

function titleFor(subject: string, intent: string, body: string) {
  const subjectName = normalizeSemanticSubject(subject);
  const { present, past, auxiliary } = semanticSubjectAgreement(subjectName);
  const lower = body.toLowerCase();
  if (intent === "definition") return `What ${present} ${subjectName}?`;
  if (intent === "who") {
    if (/\bdiscover\w*\b/.test(lower)) return `Who discovered ${subjectName}?`;
    if (/\binvent\w*\b/.test(lower)) return `Who invented ${subjectName}?`;
    return `Who played a major role in ${subjectName}?`;
  }
  if (intent === "when") {
    if (/\bdiscover\w*\b/.test(lower)) return `When ${past} ${subjectName} discovered?`;
    if (/\b(first|early)\b.*\b(use|used|application)\w*\b|\b(use|used)\w*\b.*\b(first|early)\b/.test(lower)) return `When ${past} ${subjectName} first put to major use?`;
    if (/\binvent\w*\b/.test(lower)) return `When ${past} ${subjectName} invented?`;
    return `When did ${subjectName} become important?`;
  }
  if (intent === "where") {
    if (/\b(grown|crop|cultivat)\w*\b/.test(lower)) return `Where ${present} ${subjectName} grown?`;
    if (/\b(produc|manufactur|refin)\w*\b/.test(lower)) return `Where ${present} ${subjectName} produced?`;
    if (/\b(found|occurs|mine|mineral|deposit|native|reserve)\w*\b/.test(lower)) return `Where ${present} ${subjectName} found?`;
    return `Where ${present} ${subjectName} most important?`;
  }
  if (intent === "origin") return discoveryQuestion(subjectName, body);
  if (intent === "used") return `What ${present} ${subjectName} used for?`;
  if (intent === "made") return `How ${present} ${subjectName} produced?`;
  if (intent === "why") {
    if (/\brare|scarce|abundan|supply\w*\b/.test(lower)) return `Why ${present} ${subjectName} rare or difficult to supply?`;
    return `Why ${present} ${subjectName} important?`;
  }
  if (intent === "mechanism") {
    if (/\b(alloy|strength|creep|resistance|temperature|material)\w*\b/.test(lower)) return `How ${auxiliary} ${subjectName} affect material performance?`;
    if (/\b(react|reaction|bond|electron|oxidation|chemical)\w*\b/.test(lower)) return `How ${auxiliary} ${subjectName} behave chemically?`;
    return `How ${auxiliary} ${subjectName} work in this context?`;
  }
  if (intent === "types") return `What types or forms of ${subjectName} are there?`;
  if (intent === "comparison") return `What ${present} ${subjectName} most useful to compare with?`;
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
  const present = title.match(/^(?:What|Where|Why|How)\s+(is|are)\s+(.+?)\?$/i);
  if (present) {
    const subject = present[2].replace(/\s+(?:grown|produced|found|most important|used for|rare or difficult to supply|important|most useful to compare with)$/i, "");
    if (present[1].toLowerCase() !== semanticSubjectAgreement(subject).present) return false;
  }
  const past = title.match(/^(?:When|How)\s+(was|were)\s+(.+?)\s+(?:discovered|invented|first put to major use)\?$/i);
  if (past && past[1].toLowerCase() !== semanticSubjectAgreement(past[2]).past) return false;
  const auxiliary = title.match(/^How\s+(does|do)\s+(.+?)\s+(?:affect|behave|work)\b/i);
  if (auxiliary && auxiliary[1].toLowerCase() !== semanticSubjectAgreement(auxiliary[2]).auxiliary) return false;
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

function detailQuestion(subject: string, body: string) {
  const subjectTerms = new Set(semanticTerms(subject));
  const detail = semanticTerms(body)
    .filter((term) => !subjectTerms.has(term) && !/^(who|what|when|where|why|how)$/.test(term))
    .slice(0, 4)
    .join(" ");
  return detail
    ? `What does the evidence show about ${subject} and ${detail}?`
    : `What additional evidence is available about ${subject}?`;
}

function cardFromVisualSource(subject: string, source: SemanticSource, overview: string, usedTitles: string[]) {
  const lines = sentenceList(source.excerpt);
  const ranked = lines.flatMap((line) => INTENTS.map((spec) => ({ line, spec, score: intentScore(line, subject, spec) })))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    const body = paragraphFor(item.line, lines, overview);
    if (!body || INTERNAL.test(body)) continue;
    const title = titleFor(subject, item.spec.id, body);
    if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, usedTitles)) continue;
    return {
      key: stableKey(item.spec.id, `${title}:${body}`),
      title,
      body,
      keyword: [...new Set([...semanticTerms(title), ...semanticTerms(body).slice(0, 10)])].join(" "),
      intent: item.spec.id,
      source,
    } as SemanticCard;
  }

  const body = lines[0];
  if (!body) return undefined;
  const title = detailQuestion(subject, body);
  if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, usedTitles)) return undefined;
  return {
    key: stableKey("evidence", `${title}:${body}`),
    title,
    body,
    keyword: [...new Set([...semanticTerms(title), ...semanticTerms(body).slice(0, 10)])].join(" "),
    intent: "evidence",
    source,
  } as SemanticCard;
}

/**
 * Jeopardy-style generation: collect answer sentences first, classify them, then
 * turn only supported classifications into clean questions. The visible orange
 * layer is intentionally fixed at 15 cards. Hash depth remains in the data, not
 * as extra orange-card rows on the research page.
 */
export function buildSemanticExpansionCards(subject: string, overview: string, sources: SemanticSource[], findings: string[] = [], focus = "", exclude: SemanticCard[] = [], limit = 12): SemanticCard[] {
  const stableSubject = normalizeSemanticSubject(subject);
  const targetLimit = focus ? limit : Math.max(limit, 15);
  const records = sourceSentences(sources);
  const findingRecords = findings.map((body, index) => ({ body: clean(body), source: undefined as SemanticSource | undefined, sourceIndex: sources.length + index, sentenceIndex: 0 })).filter((record) => record.body && !INTERNAL.test(record.body));
  const candidates = [...records, ...findingRecords];
  const all = dedupeSemantic([...findings, ...records.map((record) => record.body)], [overview], 120);
  const excludedTitles = exclude.map((card) => card.title);
  const cards: SemanticCard[] = [];
  const usedAnswers: string[] = [];

  // The page assigns images in source order. Build the first cards from those
  // exact image-bearing sources so image N belongs to orange card N.
  const seenImages = new Set<string>();
  const visualSources = sources.filter((source) => {
    if (!source.imageUrl || seenImages.has(source.imageUrl)) return false;
    seenImages.add(source.imageUrl);
    return true;
  });
  for (const source of visualSources) {
    if (cards.length >= targetLimit) break;
    const card = cardFromVisualSource(stableSubject, source, overview, [...excludedTitles, ...cards.map((item) => item.title)]);
    if (!card || semanticallyRepeats(card.body, usedAnswers)) continue;
    cards.push(card);
    usedAnswers.push(card.body);
  }

  for (const spec of INTENTS) {
    if (cards.length >= targetLimit) break;
    const best = candidates
      .map((record) => ({ ...record, score: intentScore(record.body, stableSubject, spec, focus) }))
      .filter((record) => record.score > 0 && !semanticallyRepeats(record.body, usedAnswers))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    const body = paragraphFor(best.body, all, overview);
    if (!body || INTERNAL.test(body) || semanticallyRepeats(body, usedAnswers)) continue;
    const title = titleFor(stableSubject, spec.id, body);
    if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, [...excludedTitles, ...cards.map((card) => card.title)])) continue;
    const keywords = [...semanticTerms(title), ...semanticTerms(body).slice(0, 10)];
    cards.push({ key: stableKey(spec.id, `${title}:${body}`), title, body, keyword: [...new Set(keywords)].join(" "), intent: spec.id, source: best.source });
    usedAnswers.push(body);
  }

  if (cards.length < targetLimit) {
    const fallback = all
      .filter((body) => !semanticallyRepeats(body, usedAnswers))
      .sort((a, b) => subjectHit(b, stableSubject) - subjectHit(a, stableSubject));
    for (const body of fallback) {
      if (cards.length >= targetLimit) break;
      const source = records.find((record) => record.body === body)?.source;
      const paragraph = paragraphFor(body, all, overview);
      if (!paragraph || INTERNAL.test(paragraph) || semanticallyRepeats(paragraph, usedAnswers)) continue;
      const inferred = INTENTS.find((spec) => spec.cues.test(paragraph))?.id || "evidence";
      let title = titleFor(stableSubject, inferred, paragraph);
      if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, [...excludedTitles, ...cards.map((card) => card.title)])) {
        title = detailQuestion(stableSubject, paragraph);
      }
      if (!isValidSemanticQuestion(title) || semanticallyRepeats(title, [...excludedTitles, ...cards.map((card) => card.title)])) continue;
      cards.push({ key: stableKey(inferred, `${title}:${paragraph}`), title, body: paragraph, keyword: [...semanticTerms(paragraph).slice(0, 10)].join(" "), intent: inferred, source });
      usedAnswers.push(paragraph);
    }
  }

  return cards.slice(0, targetLimit).map((card, index) => indexedCard(card, index, 1));
}

/**
 * Orange cards no longer spawn more orange cards on click. A click deepens the
 * selected answer through the existing research/purple-storyboard flow instead.
 */
export function spawnSemanticExpansionCards(_subject: string, _overview: string, _seed: SemanticCard, _sources: SemanticSource[], _findings: string[], _existing: SemanticCard[]) {
  return [] as SemanticCard[];
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
