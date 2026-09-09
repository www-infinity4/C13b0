import { PLUGIN_ROLES, selectPluginRoutes } from "./plugin-index";

export type SiteUpgrade =
  | "business"
  | "storefront"
  | "illustration"
  | "tools"
  | "advertising"
  | "real-world-assets";

export type BuildHistorySignal = {
  query: string;
  action?: string;
  selectedAim?: string;
  occurredAt?: string;
};

export type VariationPlan = {
  version: "infinity/site-variation/v1";
  fingerprint: string;
  variationAttempt: number;
  layout: string;
  palette: string;
  typography: string;
  narrative: string;
  interaction: string;
  illustration: string;
  historyTerms: string[];
  plugins: string[];
  upgrades: SiteUpgrade[];
  similarityToClosestPrior: number;
};

export const BUILDER_PLUGIN_SLOTS = PLUGIN_ROLES;

const AXES = {
  layout: ["editorial-spine", "visual-atlas", "modular-laboratory", "guided-timeline", "radial-field-guide", "split-documentary", "catalog-workbench", "layered-notebook"],
  palette: ["hydrogen-spectrum", "oxide-and-cobalt", "carbon-and-copper", "midnight-signal", "paper-and-ultraviolet", "mineral-and-cyan", "solarized-research", "monochrome-with-spectral-data"],
  typography: ["humanist-sans-with-mono", "editorial-serif-with-grotesk", "technical-grotesk", "wide-display-with-readable-serif", "condensed-headings-with-humanist-body", "rounded-science-sans", "monospace-led-lab-notes", "classic-book-with-interface-sans"],
  narrative: ["question-to-evidence", "object-to-system", "history-to-future", "claim-counterclaim-resolution", "visual-glossary", "experiment-observation-application", "market-need-to-proof", "map-of-related-ideas"],
  interaction: ["expandable-evidence-cards", "guided-chapter-steps", "zoomable-topic-map", "comparison-workbench", "annotated-image-path", "filterable-research-deck", "interactive-timeline", "section-level-phi-workspaces"],
  illustration: ["macro-material-photography", "annotated-scientific-plates", "isometric-process-scenes", "archival-to-modern-pairs", "diagram-led-explanations", "object-cutaway-series", "field-observation-gallery", "cinematic-concept-sequences"],
} as const;

function hash(value: string): number {
  let output = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    output ^= value.charCodeAt(index);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function pick<T>(values: readonly T[], seed: string, offset: number): T {
  return values[(hash(`${seed}:${offset}`) + offset * 17) % values.length];
}

function normalizeTerms(history: BuildHistorySignal[], currentQuery: string): string[] {
  const current = new Set(currentQuery.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  const counts = new Map<string, number>();
  for (const signal of history.slice(-80)) {
    const text = `${signal.query} ${signal.selectedAim || ""}`.toLowerCase();
    for (const term of text.match(/[a-z0-9]{3,}/g) || []) {
      if (current.has(term)) continue;
      counts.set(term, (counts.get(term) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([term]) => term);
}

export function fingerprintSimilarity(left: string, right: string): number {
  const a = new Set(left.split("|"));
  const b = new Set(right.split("|"));
  const overlap = [...a].filter((value) => b.has(value)).length;
  const total = new Set([...a, ...b]).size;
  return total ? overlap / total : 0;
}

export function createVariationPlan(input: {
  userId: string;
  tokenId: string;
  query: string;
  aims?: string[];
  history?: BuildHistorySignal[];
  priorFingerprints?: string[];
  upgrades?: SiteUpgrade[];
}): VariationPlan {
  const history = input.history || [];
  const prior = input.priorFingerprints || [];
  const upgrades = [...new Set(input.upgrades || [])];
  const historyTerms = normalizeTerms(history, input.query);
  const base = [input.userId, input.tokenId, input.query, ...(input.aims || []), ...historyTerms, ...upgrades].join("|");
  let closest = 0;

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const seed = `${base}:variation:${prior.length}:${attempt}`;
    const values = [
      pick(AXES.layout, seed, 1),
      pick(AXES.palette, seed, 2),
      pick(AXES.typography, seed, 3),
      pick(AXES.narrative, seed, 4),
      pick(AXES.interaction, seed, 5),
      pick(AXES.illustration, seed, 6),
    ];
    const fingerprint = values.join("|");
    closest = prior.reduce((score, candidate) => Math.max(score, fingerprintSimilarity(fingerprint, candidate)), 0);
    if (closest <= 0.2 || attempt === 47) {
      const plugins = selectPluginRoutes({ query: input.query, aims: input.aims, upgrades }).map((item) => item.role);
      return {
        version: "infinity/site-variation/v1",
        fingerprint,
        variationAttempt: attempt,
        layout: values[0],
        palette: values[1],
        typography: values[2],
        narrative: values[3],
        interaction: values[4],
        illustration: values[5],
        historyTerms,
        plugins,
        upgrades,
        similarityToClosestPrior: Number(closest.toFixed(3)),
      };
    }
  }
  throw new Error("Unable to create a distinct site plan");
}
