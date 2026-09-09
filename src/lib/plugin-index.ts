export const PLUGIN_ROLES = [
  "source-scout",
  "claim-verifier",
  "history-context",
  "script-architect",
  "illustration-planner",
  "layout-composer",
  "typography-director",
  "color-director",
  "interaction-designer",
  "accessibility-auditor",
  "business-personalizer",
  "storefront-catalog",
  "token-provenance",
  "duplicate-detector",
  "deployment-review",
] as const;

export type PluginRole = typeof PLUGIN_ROLES[number];
export type PluginPhase = "discover" | "reason" | "compose" | "business" | "verify";

export type PluginCapability = {
  role: PluginRole;
  label: string;
  fork: string;
  upstream: string;
  phase: PluginPhase;
  purpose: string;
  accepts: string[];
  produces: string[];
  triggers: string[];
  defaultForWebsite: boolean;
};

export type PluginRoute = PluginCapability & {
  reason: string;
  matchedTerms: string[];
};

export type PluginRunStatus = "INDEXED_REFERENCE" | "EXECUTED" | "FAILED";
export type PluginReceipt = {
  role: PluginRole;
  label: string;
  phase: PluginPhase;
  status: PluginRunStatus;
  fork: string;
  forkUrl: string;
  upstream: string;
  endpointConfigured: boolean;
  purpose: string;
  produces: string[];
  result?: unknown;
  error?: string;
};

const capability = (
  role: PluginRole,
  label: string,
  fork: string,
  upstream: string,
  phase: PluginPhase,
  purpose: string,
  accepts: string[],
  produces: string[],
  triggers: string[] = [],
  defaultForWebsite = true,
): PluginCapability => ({ role, label, fork, upstream, phase, purpose, accepts, produces, triggers, defaultForWebsite });

export const PLUGIN_INDEX: readonly PluginCapability[] = [
  capability("source-scout", "Source scout", "www-infinity4/searxng", "searxng/searxng", "discover", "Find diverse source candidates for every research aim.", ["query", "aims", "history terms"], ["ranked sources", "source queries"]),
  capability("claim-verifier", "Claim verifier", "www-infinity4/deepeval", "confident-ai/deepeval", "reason", "Score whether generated claims are supported and relevant.", ["script", "sources"], ["claim scores", "repair list"]),
  capability("history-context", "History context", "www-infinity4/mem0", "mem0ai/mem0", "discover", "Retrieve useful user context without replacing the current subject.", ["query", "user history"], ["ranked context", "history terms"]),
  capability("script-architect", "Script architect", "www-infinity4/langgraph", "langchain-ai/langgraph", "reason", "Turn aims into a durable branching illustrated teaching script.", ["query", "aims", "sources"], ["section graph", "Phi prompts"]),
  capability("illustration-planner", "Illustration planner", "www-infinity4/ComfyUI", "Comfy-Org/ComfyUI", "compose", "Plan or render a distinct visual for each important line.", ["script lines", "visual style"], ["visual prompts", "render receipts"], ["image", "illustration", "visual", "render", "diagram", "graph"]),
  capability("layout-composer", "Layout composer", "www-infinity4/puck", "puckeditor/puck", "compose", "Compose cards and sections into an editable website.", ["section graph", "layout axis"], ["page component tree"]),
  capability("typography-director", "Typography director", "www-infinity4/fonttools", "fonttools/fonttools", "compose", "Choose and prepare a readable, distinct type system.", ["content", "typography axis"], ["font plan", "subset plan"]),
  capability("color-director", "Color director", "www-infinity4/color.js", "color-js/color.js", "compose", "Apply the semantic color language and accessible palette transformations.", ["semantic terms", "palette axis"], ["color tokens", "contrast pairs"]),
  capability("interaction-designer", "Interaction designer", "www-infinity4/xyflow", "xyflow/xyflow", "compose", "Connect cards, Phi workspaces and related ideas as a navigable graph.", ["section graph", "semantic routes"], ["interaction graph", "jump links"]),
  capability("accessibility-auditor", "Accessibility auditor", "www-infinity4/axe-core", "dequelabs/axe-core", "verify", "Check the composed experience for accessibility failures.", ["rendered page"], ["violations", "repair guidance"]),
  capability("business-personalizer", "Business personalizer", "www-infinity4/twenty", "twentyhq/twenty", "business", "Shape people, organization and customer context into a business site.", ["business profile", "history"], ["business sections", "relationship model"], ["business", "company", "brand", "customer", "service", "crm"], false),
  capability("storefront-catalog", "Storefront catalog", "www-infinity4/medusa", "medusajs/medusa", "business", "Structure products, collections and storefront actions.", ["catalog", "business profile"], ["product model", "storefront plan"], ["store", "shop", "sell", "product", "catalog", "commerce", "ebay", "etsy", "shopify"], false),
  capability("token-provenance", "Token provenance", "www-infinity4/c2pa-js", "contentauth/c2pa-js", "verify", "Bind media provenance and generation receipts to the token.", ["media", "token id", "build receipt"], ["provenance manifest"]),
  capability("duplicate-detector", "Duplicate detector", "www-infinity4/datasketch", "ekzhu/datasketch", "reason", "Detect repeated structures and force a more distinct path.", ["current fingerprint", "prior fingerprints"], ["similarity score", "collision candidates"]),
  capability("deployment-review", "Deployment review", "www-infinity4/lighthouse-ci", "GoogleChrome/lighthouse-ci", "verify", "Check performance and quality before a build is promoted.", ["deployed URL", "budgets"], ["quality report", "release gate"]),
] as const;

const ROLE_INDEX = new Map<PluginRole, PluginCapability>(PLUGIN_INDEX.map((item) => [item.role, item]));

export function pluginCapability(role: string): PluginCapability | undefined {
  return ROLE_INDEX.get(role as PluginRole);
}

export function selectPluginRoutes(input: { query: string; aims?: string[]; upgrades?: string[] }): PluginRoute[] {
  const upgrades = new Set(input.upgrades || []);
  const searchable = `${input.query} ${(input.aims || []).join(" ")}`.toLowerCase();
  const words = new Set(searchable.match(/[a-z0-9]+/g) || []);
  const commerceIntent = ["store", "shop", "sell", "product", "catalog", "commerce", "ebay", "etsy", "shopify"].some((term) => words.has(term));
  return PLUGIN_INDEX.flatMap((item): PluginRoute[] => {
    const matchedTerms = item.triggers.filter((term) => words.has(term));
    const upgradeMatch =
      (item.role === "business-personalizer" && (upgrades.has("business") || upgrades.has("advertising") || commerceIntent)) ||
      (item.role === "storefront-catalog" && upgrades.has("storefront")) ||
      (item.role === "illustration-planner" && upgrades.has("illustration"));
    if (!item.defaultForWebsite && !upgradeMatch && matchedTerms.length === 0) return [];
    const reason = upgradeMatch
      ? `Selected by ${item.role === "storefront-catalog" ? "storefront" : item.role === "business-personalizer" ? "business" : "illustration"} upgrade`
      : matchedTerms.length
        ? `Matched: ${matchedTerms.join(", ")}`
        : "Core website capability";
    return [{ ...item, reason, matchedTerms }];
  });
}

export function routesForRoles(roles: string[]): PluginRoute[] {
  const selected = new Set(roles);
  return PLUGIN_INDEX.filter((item) => selected.has(item.role)).map((item) => ({ ...item, reason: "Selected by variation plan", matchedTerms: [] }));
}
