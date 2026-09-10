export type PublicationSource = {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
};

export type PublicationSelection = {
  branchIds?: string[];
  branchBodies?: string[];
  terms?: string[];
  notes?: { id: string; title: string; body: string }[];
  deepNotes?: string[];
};

export type PublicationFocus = {
  root: string;
  label: string;
  text: string;
  anchors: string[];
  specificAnchors: string[];
  locked: boolean;
};

const STOP = new Set([
  "about", "after", "again", "against", "because", "before", "being", "between", "could", "every",
  "first", "from", "have", "into", "itself", "more", "other", "over", "same", "such", "than", "that",
  "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with",
  "would", "your", "also", "only", "some", "most", "many", "much", "there", "then", "them", "were", "been",
  "does", "each", "very", "will", "evidence", "research", "story", "article", "subject", "question", "explore",
  "further", "important", "information", "general", "system", "systems", "process", "processes",
]);

const BUILDER_LANGUAGE = /\b(guided reading path|pile of search results|follow the .* thread|question to carry forward|investigate:|supporting claims|surrounding claims|research this question|selected research path|questions worth pursuing)\b/i;

export const OMNI_PUBLICATION_SKILLS = Object.freeze([
  "context-resolver",
  "source-verifier",
  "visual-evaluator",
  "proofreader",
  "regression-gate",
]);

export const cleanPublicationText = (value: unknown) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function words(value: string) {
  return cleanPublicationText(value).toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)?/g) || [];
}

function meaningful(value: string) {
  return words(value).filter((word) => word.length > 3 && !STOP.has(word));
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function countTerms(value: string) {
  const counts = new Map<string, number>();
  meaningful(value).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]).map(([word]) => word);
}

function naturalLabel(root: string, focusText: string, title = "") {
  const lower = focusText.toLowerCase();
  if (/\bcorn smut\b|\bustilago maydis\b|\bmycosarcoma maydis\b/.test(lower)) return "Corn Smut";
  if (/\bhuitlacoche\b|\bcuitlacoche\b/.test(lower)) return "Huitlacoche";

  const binomial = focusText.match(/\b([A-Z][a-z]{2,}\s+[a-z][a-z-]{2,})\b/);
  if (binomial?.[1]) return binomial[1];

  const cleanedTitle = cleanPublicationText(title)
    .replace(/^(Who|What|When|Where|Why|How)\s+(?:is|are|was|were|did|does|do|can|could|has|have)?\s*/i, "")
    .replace(/[?!.]+$/g, "");
  if (cleanedTitle && cleanedTitle.length >= 4 && cleanedTitle.length <= 68 && !/^(this|that|it)\b/i.test(cleanedTitle)) {
    return titleCase(cleanedTitle);
  }

  const rootWords = new Set(meaningful(root));
  const detail = countTerms(focusText).filter((word) => !rootWords.has(word))[0];
  return detail ? `${titleCase(root)} · ${titleCase(detail)}` : titleCase(root);
}

export function resolvePublicationFocus(rootQuery: string, selection: PublicationSelection, selected?: { title?: string; body?: string; keyword?: string }) : PublicationFocus {
  const root = cleanPublicationText(rootQuery).replace(/[?.!]+$/g, "") || "Subject";
  const selectedText = [selected?.title, selected?.body, selected?.keyword].map(cleanPublicationText).filter(Boolean).join(" ");
  const selectionText = [
    ...(selection.branchBodies || []),
    ...(selection.notes || []).flatMap((note) => [note.title, note.body]),
    ...(selection.deepNotes || []),
    ...(selection.terms || []),
  ].map(cleanPublicationText).filter(Boolean).join(" ");
  const text = selectedText || selectionText;
  const locked = Boolean(text);
  const rootTerms = new Set(meaningful(root));
  const anchors = [...new Set(countTerms(`${selectedText} ${selectionText}`).slice(0, 28))];
  const specificAnchors = anchors.filter((word) => !rootTerms.has(word)).slice(0, 18);
  const label = naturalLabel(root, text || root, selected?.title || "");
  return { root, label, text: `${label} ${text}`.trim(), anchors, specificAnchors, locked };
}

function hits(text: string, terms: string[]) {
  const lower = cleanPublicationText(text).toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

export function publicationTextRelevant(text: string, focus: PublicationFocus, strict = false) {
  const candidate = cleanPublicationText(text);
  if (!candidate || BUILDER_LANGUAGE.test(candidate)) return false;
  if (!focus.locked) return true;
  const lower = candidate.toLowerCase();
  const exactLabel = focus.label.length > 3 && lower.includes(focus.label.toLowerCase());
  const specificHits = hits(candidate, focus.specificAnchors);
  const anchorHits = hits(candidate, focus.anchors);

  if (/\bcorn smut\b/i.test(focus.text)) {
    const smutSignal = /\b(corn smut|ustilago|maydis|mycosarcoma|huitlacoche|cuitlacoche|smut fungus|plant pathogen|fungal disease|gall|teliospore)\w*\b/i.test(candidate);
    if (!smutSignal) return false;
    if (/\b(corn snake|candy corn|sweet corn|popcorn)\b/i.test(candidate) && !/\b(smut|ustilago|maydis|fungus|fungal|pathogen)\b/i.test(candidate)) return false;
  }

  if (exactLabel) return true;
  if (strict) return specificHits >= 1 && anchorHits >= 1;
  return specificHits >= 1 || anchorHits >= 2;
}

export function verifyPublicationSource(source: PublicationSource, focus: PublicationFocus) {
  return publicationTextRelevant(`${source.title} ${source.excerpt}`, focus, true);
}

export function verifyPublicationParagraph(text: string, focus: PublicationFocus) {
  return publicationTextRelevant(text, focus, false) && cleanPublicationText(text).length >= 44;
}

export function verifyPublicationImage(imageTitle: string, focus: PublicationFocus) {
  if (!focus.locked) return hits(imageTitle, meaningful(focus.root)) >= 1;
  return publicationTextRelevant(imageTitle, focus, true);
}

export function magazineHeadline(focus: PublicationFocus, material: string[]) {
  const lower = `${focus.text} ${material.slice(0, 6).join(" ")}`.toLowerCase();
  if (/\bcorn smut\b|\bustilago maydis\b|\bmycosarcoma maydis\b/.test(lower)) {
    if (/\bgall|hypertroph|tumor|swelling\b/.test(lower)) return "Inside Corn Smut: How Ustilago maydis Reshapes a Corn Plant";
    return "Inside Corn Smut: The Biology of Ustilago maydis";
  }
  if (/\b(fungus|fungal|pathogen|plant disease)\b/.test(lower)) return `${focus.label}: Inside the Biology of Infection`;
  if (/\b(quarter|dime|nickel|cent|penny|dollar|coin|coinage|numismatic)\b/.test(lower)) return `${focus.label}: The Details That Define the Collector Story`;
  if (/\b(element|atomic|chemistry|oxide|isotope|compound)\b/.test(lower)) return `${focus.label}: Structure, Chemistry, and Real-World Use`;
  if (/\b(magnet|magnetic|field|coerciv)\b/.test(lower)) return `${focus.label}: Inside the Physics of the Field`;
  if (/\b(storage|memory|data)\b/.test(lower)) return `${focus.label}: From Physical Principle to Working Memory`;
  const terms = countTerms(material.join(" ")).filter((word) => !meaningful(focus.label).includes(word)).slice(0, 3);
  return terms.length ? `${focus.label}: ${titleCase(terms.join(", "))}` : focus.label;
}

export function magazineSectionTitle(body: string, focus: PublicationFocus, index: number) {
  const lower = body.toLowerCase();
  if (/\bcorn smut\b|\bustilago|\bmycosarcoma|\bmaydis\b/.test(`${focus.text} ${lower}`.toLowerCase())) {
    if (/\b(pathogen|fungus|fungal|disease|smut)\b/.test(lower)) return "Meet the Fungus Behind Corn Smut";
    if (/\b(gall|hypertroph|swelling|tumor|above-ground)\b/.test(lower)) return "How Infection Reshapes the Corn Plant";
    if (/\b(diploid|mitotic|mating|sexual|progeny|life cycle|teliospore)\b/.test(lower)) return "An Unusual Fungal Life Cycle";
    if (/\b(environment|signal|regulator|transcription|development)\b/.test(lower)) return "The Signals That Control Fungal Development";
    if (/\b(huitlacoche|cuitlacoche|edible|food|cuisine)\b/.test(lower)) return "When a Crop Disease Becomes Food";
    if (/\b(farmer|crop|field|control|management|yield)\b/.test(lower)) return "What Corn Smut Means in the Field";
  }
  if (/\b(discover|history|century|year|named)\b/.test(lower)) return `How ${focus.label} Entered the Record`;
  if (/\b(use|application|industry|device|technology)\b/.test(lower)) return `Where ${focus.label} Becomes Useful`;
  if (/\b(health|toxicity|exposure|safety|hazard)\b/.test(lower)) return `Health and Safety Around ${focus.label}`;
  if (/\b(structure|configuration|bond|reaction|oxidation)\b/.test(lower)) return `Inside the Structure of ${focus.label}`;
  const clause = cleanPublicationText(body).split(/[.;:—]/)[0];
  if (clause.length >= 18 && clause.length <= 82 && !BUILDER_LANGUAGE.test(clause)) return clause.replace(/[.]+$/g, "");
  const terms = countTerms(body).slice(0, 3);
  return terms.length ? titleCase(terms.join(" · ")) : `${focus.label} · ${index + 1}`;
}

export function magazineDeck(focus: PublicationFocus, material: string[]) {
  const verified = material.filter((line) => verifyPublicationParagraph(line, focus)).slice(0, 2);
  if (verified.length) return verified.join(" ");
  return `A focused look at ${focus.label}, assembled from sources that match the selected branch.`;
}

export function proofreadPublication<T extends { title: string; paragraphs: string[] }>(sections: T[], focus: PublicationFocus) {
  return sections.filter((section) => {
    if (!section.title || BUILDER_LANGUAGE.test(section.title)) return false;
    const valid = section.paragraphs.filter((paragraph) => verifyPublicationParagraph(paragraph, focus));
    return valid.length > 0;
  });
}
