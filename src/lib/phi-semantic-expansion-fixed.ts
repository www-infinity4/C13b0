export * from "./phi-semantic-expansion";

import {
  normalizeSemanticSubject,
  semanticSectors,
  semanticTerms,
  semanticallyRepeats,
  type SemanticCard,
  type SemanticSource,
} from "./phi-semantic-expansion";

const clean = (value: unknown, max = 4000) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function stableToken(prefix: string, value: string) {
  let hash = 2166136261;
  const input = `${prefix}:${value}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function sentenceList(value: string) {
  const text = clean(value, 5000);
  const sentences = text.split(/(?<=[.!?])\s+/).map((sentence) => clean(sentence, 900)).filter((sentence) => sentence.length >= 28);
  return sentences.length ? sentences : text ? [text] : [];
}

function overlapCount(text: string, terms: string[]) {
  const lower = clean(text).toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase())).length;
}

function intentFor(query: string, text: string) {
  const combined = `${query} ${text}`.toLowerCase();
  if (/\b(schedule|schedules|fixture|fixtures|calendar|matchups?)\b/.test(query.toLowerCase())) return "schedule";
  if (/\b(scores?|results?|finals?)\b/.test(query.toLowerCase())) return "scores";
  if (/\b(standings?|rankings?|table)\b/.test(query.toLowerCase())) return "standings";
  if (/\b(roster|lineup|depth\s+chart|squad)\b/.test(query.toLowerCase())) return "roster";
  if (/\b(stats?|statistics|leaders?|leaderboard)\b/.test(query.toLowerCase())) return "stats";
  if (/\b(highlights?|videos?|clips?|replays?|reels?)\b/.test(query.toLowerCase()) || /\b(youtube|youtu\.be|video|watch)\b/.test(combined)) return "video";
  if (/\b(breaking|news|headline|reported|coverage|latest|recent)\b/.test(query.toLowerCase())) return "news";
  return "source";
}

function sourceScore(source: SemanticSource, query: string, focus: string) {
  const queryTerms = semanticTerms(query);
  const focusTerms = semanticTerms(focus);
  const title = clean(source.title, 240);
  const body = clean(source.excerpt, 4000);
  let score = overlapCount(title, queryTerms) * 7 + overlapCount(body, queryTerms) * 3;
  if (focusTerms.length) score += overlapCount(`${title} ${body}`, focusTerms) * 4;
  if (source.imageUrl) score += 0.25;
  return score;
}

function bestBody(source: SemanticSource, query: string, focus: string, overview: string) {
  const queryTerms = semanticTerms(query);
  const focusTerms = semanticTerms(focus);
  const ranked = sentenceList(source.excerpt)
    .map((sentence, index) => ({
      sentence,
      score: overlapCount(sentence, queryTerms) * 5 + overlapCount(sentence, focusTerms) * 4 + (index === 0 ? 0.3 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const chosen: string[] = [];
  for (const item of ranked) {
    if (semanticallyRepeats(item.sentence, [overview, ...chosen])) continue;
    chosen.push(item.sentence);
    if (chosen.length >= 2 || chosen.join(" ").length >= 620) break;
  }
  return clean(chosen.join(" ") || ranked[0]?.sentence || source.excerpt, 900);
}

function keywordFor(query: string, title: string, body: string, intent: string) {
  const queryTerms = new Set(semanticTerms(query));
  const extras = semanticTerms(`${title} ${body}`).filter((term) => !queryTerms.has(term));
  return [...new Set([intent, ...extras.slice(0, 5)])].filter(Boolean).join(" ");
}

function cardFromSource(source: SemanticSource, query: string, focus: string, overview: string): SemanticCard | undefined {
  const title = clean(source.title, 180).replace(/\s*[|·]\s*[^|·]{0,35}$/g, (match) => match.length > 24 ? "" : match);
  if (!title) return undefined;
  const body = bestBody(source, query, focus, overview);
  if (!body) return undefined;
  const intent = intentFor(query, `${title} ${body} ${source.url}`);
  return {
    key: stableToken("source", `${source.url || title}:${body}`),
    title,
    body,
    keyword: keywordFor(query, title, body, intent),
    intent,
    source,
  };
}

function sourceForFinding(body: string, sources: SemanticSource[], query: string) {
  const terms = [...new Set([...semanticTerms(query), ...semanticTerms(body).slice(0, 8)])];
  return sources
    .map((source) => ({ source, score: overlapCount(`${source.title} ${source.excerpt}`, terms) }))
    .sort((a, b) => b.score - a.score)[0]?.source;
}

function findingTitle(body: string, source?: SemanticSource) {
  const sourceTitle = clean(source?.title, 180);
  if (sourceTitle) return sourceTitle;
  const sentence = sentenceList(body)[0] || clean(body, 180);
  const clause = clean(sentence.split(/[;:—]/)[0], 150).replace(/[.!?]+$/, "");
  return clause.length >= 12 ? clause : "Source evidence";
}

/**
 * Infinity Phi cards are source-backed result cards, not generated quiz prompts.
 * Preserve the publisher/story/video title, then let the body explain why that
 * source is relevant. This keeps the visible card and the shared card identical.
 */
export function buildSemanticExpansionCards(
  subject: string,
  overview: string,
  sources: SemanticSource[],
  findings: string[] = [],
  focus = "",
  exclude: SemanticCard[] = [],
  limit = 12,
): SemanticCard[] {
  const query = normalizeSemanticSubject(subject);
  const target = focus ? Math.max(1, limit) : Math.max(limit, 15);
  const excludedTitles = exclude.map((card) => clean(card.title).toLowerCase());
  const cards: SemanticCard[] = [];
  const usedBodies: string[] = [];
  const usedTitles = new Set(excludedTitles);

  const rankedSources = sources
    .map((source, index) => ({ source, index, score: sourceScore(source, query, focus) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const item of rankedSources) {
    if (cards.length >= target) break;
    const card = cardFromSource(item.source, query, focus, overview);
    if (!card) continue;
    const titleKey = clean(card.title).toLowerCase();
    if (usedTitles.has(titleKey) || semanticallyRepeats(card.body, usedBodies)) continue;
    usedTitles.add(titleKey);
    usedBodies.push(card.body);
    cards.push(card);
  }

  for (const finding of findings.map((item) => clean(item, 900)).filter(Boolean)) {
    if (cards.length >= target) break;
    if (semanticallyRepeats(finding, [overview, ...usedBodies])) continue;
    const source = sourceForFinding(finding, sources, query);
    let title = findingTitle(finding, source);
    let titleKey = title.toLowerCase();
    if (usedTitles.has(titleKey)) {
      const clause = clean(sentenceList(finding)[0]?.split(/[;:—]/)[0] || "", 96).replace(/[.!?]+$/, "");
      if (clause && !usedTitles.has(clause.toLowerCase())) {
        title = clause;
        titleKey = title.toLowerCase();
      }
    }
    if (!title || usedTitles.has(titleKey)) continue;
    const intent = intentFor(query, `${title} ${finding} ${source?.url || ""}`);
    usedTitles.add(titleKey);
    usedBodies.push(finding);
    cards.push({
      key: stableToken("finding", `${title}:${finding}`),
      title,
      body: finding,
      keyword: keywordFor(query, title, finding, intent),
      intent,
      source,
    });
  }

  return cards.slice(0, target).map((card, index) => {
    const sectors = semanticSectors(`${card.title} ${card.body}`);
    return {
      ...card,
      depth: 1,
      hashPath: `#${index + 1}`,
      answerHash: stableToken("answer", card.body),
      sectors,
      keyword: [...new Set([...semanticTerms(card.keyword), ...sectors])].join(" "),
    };
  });
}
