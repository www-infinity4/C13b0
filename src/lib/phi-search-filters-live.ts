export * from "./phi-search-filters-fixed";

import {
  gateResearchSources as lockedGateResearchSources,
  type PhiSearchDomain,
  type PhiSearchIdentity,
  type PhiSearchSource,
} from "./phi-search-filters-fixed";

type AliasRule = {
  query: RegExp;
  evidence: RegExp;
  alias: string;
};

const SPORT_ALIASES: AliasRule[] = [
  { query: /\bfootball\b/i, evidence: /\b(nfl|national football league)\b/i, alias: "football" },
  { query: /\bnfl\b/i, evidence: /\bfootball\b/i, alias: "nfl" },
  { query: /\bbaseball\b/i, evidence: /\b(mlb|major league baseball)\b/i, alias: "baseball" },
  { query: /\bmlb\b/i, evidence: /\bbaseball\b/i, alias: "mlb" },
  { query: /\bbasketball\b/i, evidence: /\b(nba|wnba|national basketball association)\b/i, alias: "basketball" },
  { query: /\b(?:nba|wnba)\b/i, evidence: /\bbasketball\b/i, alias: "basketball" },
  { query: /\bhockey\b/i, evidence: /\b(nhl|national hockey league)\b/i, alias: "hockey" },
  { query: /\bnhl\b/i, evidence: /\bhockey\b/i, alias: "nhl" },
  { query: /\bsoccer\b/i, evidence: /\b(mls|fifa|uefa|premier league)\b/i, alias: "soccer" },
  { query: /\b(?:mls|fifa|uefa)\b/i, evidence: /\bsoccer\b/i, alias: "soccer" },
];

function bridgeSportsVocabulary(source: PhiSearchSource, query: string): PhiSearchSource {
  const text = `${source.title} ${source.excerpt} ${source.url || ""}`;
  const aliases = SPORT_ALIASES
    .filter((rule) => rule.query.test(query) && rule.evidence.test(text))
    .map((rule) => rule.alias);
  if (!aliases.length) return source;
  return { ...source, excerpt: `${source.excerpt} [sports alias: ${aliases.join(" ")}]` };
}

function sourceKey(source: PhiSearchSource) {
  return source.url || `${source.provider}:${source.title}`;
}

/**
 * Keep the strict current-query intent locks, but treat a league name as a real
 * synonym for its sport. This allows an NFL schedule page to answer "football
 * schedule" without weakening the schedule requirement itself.
 */
export function gateResearchSources(
  sources: PhiSearchSource[],
  query: string,
  identity: PhiSearchIdentity,
  context = "",
  domainOverride?: PhiSearchDomain,
) {
  const originals = new Map(sources.map((source) => [sourceKey(source), source]));
  const bridged = sources.map((source) => bridgeSportsVocabulary(source, query));
  const result = lockedGateResearchSources(bridged, query, identity, context, domainOverride);
  return {
    ...result,
    sources: result.sources.map((source) => originals.get(sourceKey(source)) || source),
    trace: [
      ...result.trace,
      {
        id: "sports-vocabulary-bridge",
        label: "Treat league names such as NFL/MLB/NBA/NHL as subject aliases without relaxing the requested intent",
        before: sources.length,
        after: result.sources.length,
      },
    ],
  };
}
