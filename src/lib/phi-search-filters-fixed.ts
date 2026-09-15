export * from "./phi-search-filters";

import {
  contentTerms,
  gateResearchSources as baseGateResearchSources,
  normalizeSearchText,
  type PhiSearchDomain,
  type PhiSearchIdentity,
  type PhiSearchSource,
} from "./phi-search-filters";

type IntentLock = {
  id: string;
  query: RegExp;
  evidence: RegExp;
  label: string;
};

const INTENT_LOCKS: IntentLock[] = [
  {
    id: "schedule",
    query: /\b(schedule|schedules|fixture|fixtures|calendar|matchups?)\b/i,
    evidence: /\b(schedule|schedules|fixture|fixtures|matchups?|game\s+(?:date|dates|time|times)|kickoff(?:s|\s+time)?|calendar|week\s+\d{1,2})\b/i,
    label: "schedule / fixtures",
  },
  {
    id: "scores",
    query: /\b(scores?|results?|finals?)\b/i,
    evidence: /\b(scores?|scored|results?|finals?|box\s+score|final\s+score)\b/i,
    label: "scores / results",
  },
  {
    id: "standings",
    query: /\b(standings?|rankings?|table)\b/i,
    evidence: /\b(standings?|rankings?|division\s+leaders?|conference\s+leaders?|win-loss|record|league\s+table)\b/i,
    label: "standings / rankings",
  },
  {
    id: "roster",
    query: /\b(roster|lineup|depth\s+chart|squad)\b/i,
    evidence: /\b(roster|lineup|depth\s+chart|squad|active\s+roster|players?)\b/i,
    label: "roster / lineup",
  },
  {
    id: "stats",
    query: /\b(stats?|statistics|leaders?|leaderboard)\b/i,
    evidence: /\b(stats?|statistics|leaders?|leaderboard|yards?|touchdowns?|goals?|assists?|averages?|percentage)\b/i,
    label: "statistics / leaders",
  },
  {
    id: "highlights",
    query: /\b(highlights?|videos?|clips?|replays?|reels?)\b/i,
    evidence: /\b(highlights?|videos?|clips?|replays?|reels?|watch|youtube|youtu\.be)\b/i,
    label: "video / highlights",
  },
  {
    id: "tickets",
    query: /\b(tickets?|ticketing|prices?|seats?)\b/i,
    evidence: /\b(tickets?|ticketing|prices?|seats?|box\s+office|admission)\b/i,
    label: "tickets / prices",
  },
  {
    id: "weather",
    query: /\b(weather|forecast|temperature|rain|snow|wind)\b/i,
    evidence: /\b(weather|forecast|temperature|rain|snow|wind|conditions?)\b/i,
    label: "weather / forecast",
  },
];

const INTENT_TERMS = new Set([
  "schedule", "schedules", "fixture", "fixtures", "calendar", "matchup", "matchups",
  "score", "scores", "result", "results", "final", "finals",
  "standing", "standings", "ranking", "rankings", "table",
  "roster", "lineup", "depth", "chart", "squad",
  "stat", "stats", "statistics", "leader", "leaders", "leaderboard",
  "highlight", "highlights", "video", "videos", "clip", "clips", "replay", "replays", "reel", "reels",
  "ticket", "tickets", "ticketing", "price", "prices", "seat", "seats",
  "weather", "forecast", "temperature", "rain", "snow", "wind",
]);

function activeLocks(query: string) {
  return INTENT_LOCKS.filter((lock) => lock.query.test(query));
}

function sourceText(source: PhiSearchSource) {
  return normalizeSearchText(`${source.title} ${source.excerpt} ${source.url || ""}`);
}

function subjectTerms(query: string) {
  return contentTerms(query).filter((term) => !INTENT_TERMS.has(term) && !/^\d{4}$/.test(term));
}

function subjectAnchored(source: PhiSearchSource, query: string) {
  const terms = subjectTerms(query);
  if (!terms.length) return true;
  const text = sourceText(source).toLowerCase();
  const hits = terms.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)).length;
  const needed = terms.length <= 2 ? 1 : Math.min(2, terms.length);
  return hits >= needed;
}

function yearAnchored(source: PhiSearchSource, query: string) {
  const years = [...new Set(normalizeSearchText(query).match(/\b(?:19|20)\d{2}\b/g) || [])];
  if (!years.length) return true;
  const text = sourceText(source);
  return years.some((year) => new RegExp(`\\b${year}\\b`).test(text));
}

/**
 * The base gate still performs entity/domain/authority scoring. This final pass
 * protects the user's current intent so a broad subject hit cannot replace the
 * requested thing (for example, a Patriots feature cannot answer "football schedule").
 */
export function gateResearchSources(
  sources: PhiSearchSource[],
  query: string,
  identity: PhiSearchIdentity,
  context = "",
  domainOverride?: PhiSearchDomain,
) {
  const base = baseGateResearchSources(sources, query, identity, context, domainOverride);
  const locks = activeLocks(query);
  const before = base.sources.length;
  const filtered = base.sources.filter((source) => {
    if (!subjectAnchored(source, query) || !yearAnchored(source, query)) return false;
    const text = sourceText(source);
    return locks.every((lock) => lock.evidence.test(text));
  });

  const requirements = [
    locks.map((lock) => lock.label).join(" + "),
    (normalizeSearchText(query).match(/\b(?:19|20)\d{2}\b/g) || []).length ? "query year" : "",
    subjectTerms(query).length ? "subject anchor" : "",
  ].filter(Boolean).join(" + ");

  return {
    sources: filtered,
    trace: [
      ...base.trace,
      {
        id: "current-intent-lock",
        label: requirements ? `Require current-query ${requirements}` : "Require current-query subject anchor",
        before,
        after: filtered.length,
      },
    ],
  };
}
