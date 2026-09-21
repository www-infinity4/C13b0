import type {
  PhiSearchDomain,
  PhiSearchSource,
} from "@/lib/phi-search-filters";

const ENDPOINT = "https://infinity-rogers.marvaseater.workers.dev/v1/chat";
const ROUTE_KEY = "infinity_phi_gpt_route_teacher_v1";
const VALID_DOMAINS: PhiSearchDomain[] = [
  "chemistry",
  "coins",
  "software",
  "screen",
  "news",
  "sports",
  "public-affairs",
  "science",
  "general",
];

type LearnedRoute = {
  domain: PhiSearchDomain;
  confidence: number;
  reason: string;
  learnedAt: number;
};

export type PhiRouteDecision = LearnedRoute & {
  source: "local" | "cache" | "gpt" | "fallback";
};

const clean = (value: unknown, max = 4000) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function loadRoutes(): Record<string, LearnedRoute> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ROUTE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveRoute(key: string, route: LearnedRoute) {
  if (typeof window === "undefined") return;
  try {
    const routes = loadRoutes();
    routes[key] = route;
    const trimmed = Object.fromEntries(
      Object.entries(routes)
        .sort((a, b) => b[1].learnedAt - a[1].learnedAt)
        .slice(0, 240),
    );
    localStorage.setItem(ROUTE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function routeKey(query: string) {
  return clean(query, 500)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractJson(text: string) {
  const raw = clean(text, 12000);
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(source);
  } catch {}
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(source.slice(start, end + 1));
    } catch {}
  }
  return null;
}

async function gateway(
  input: string,
  task: string,
  verifiedContext: Record<string, unknown>,
) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      input,
      context: {
        application: "Infinity Phi",
        assistant: "gpt",
        task,
        verified_context: verifiedContext,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.message || payload.error || `HTTP ${response.status}`,
    );
  return String(payload.output_text || payload.output || "").trim();
}

/**
 * GPT is a teacher only for genuinely ambiguous/general queries. An explicit
 * local domain is authoritative so history cannot drag a science query into TV.
 */
export async function resolveRouteWithGpt(
  query: string,
  localDomain: PhiSearchDomain,
): Promise<PhiRouteDecision> {
  if (localDomain !== "general") {
    return {
      domain: localDomain,
      confidence: 1,
      reason: "Explicit current-query domain",
      learnedAt: Date.now(),
      source: "local",
    };
  }

  const key = routeKey(query);
  const cached = loadRoutes()[key];
  if (cached && cached.confidence >= 0.7) return { ...cached, source: "cache" };

  const prompt = `Classify the CURRENT USER QUERY for Infinity Phi search routing.\n\nQUERY: ${clean(query, 500)}\n\nChoose exactly one domain: chemistry, coins, software, screen, news, sports, public-affairs, science, general.\n\nRules:\n1. Classify the current query itself. Do NOT infer television, movies, politics, sports, or any other domain from user history.\n2. Use screen only when the current words actually indicate a film, TV show, episode, actor, cast, director, screenplay, or similar screen-media intent. A phrase that also happens to be a TV title is NOT a screen query by default.\n3. Use science for scientific fields, scientific ideas, pseudoscience/fringe-science topics, research areas, scientific theories, experiments, physics, biology, astronomy, earth science, or questions about scientific evidence.\n4. Use general when no listed domain is genuinely supported by the current query.\n5. Return STRICT JSON only: {"domain":"science","confidence":0.98,"reason":"brief reason"}.`;

  try {
    const output = await gateway(prompt, "query_route_teacher", {
      user_query: clean(query, 500),
      local_domain: localDomain,
      context_policy: "current-query-only",
    });
    const parsed = extractJson(output);
    const domain = VALID_DOMAINS.includes(parsed?.domain)
      ? (parsed.domain as PhiSearchDomain)
      : "general";
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed?.confidence) || 0),
    );
    const route: LearnedRoute = {
      domain,
      confidence,
      reason: clean(parsed?.reason, 300),
      learnedAt: Date.now(),
    };
    if (key && confidence >= 0.7) saveRoute(key, route);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("infinityphi:route-learned", {
          detail: { query, ...route },
        }),
      );
    }
    return { ...route, source: "gpt" };
  } catch {
    return {
      domain: localDomain,
      confidence: 0,
      reason: "GPT route teacher unavailable",
      learnedAt: Date.now(),
      source: "fallback",
    };
  }
}

export async function writeOverviewWithGpt(
  query: string,
  domain: PhiSearchDomain,
  sources: PhiSearchSource[],
  fallback: string,
) {
  if (!sources.length) return clean(fallback, 1800);
  const evidence = sources.slice(0, 12).map((source, index) => ({
    index,
    title: clean(source.title, 220),
    provider: clean(source.provider, 80),
    excerpt: clean(source.excerpt, 900),
  }));

  const prompt = `Write the AI Overview for an Infinity Phi search result.\n\nCURRENT USER QUERY: ${clean(query, 500)}\nROUTED DOMAIN: ${domain}\nEVIDENCE: ${JSON.stringify(evidence)}\n\nRules:\n1. Answer the current query directly. Do not reinterpret it from browsing/history/profile data.\n2. If the phrase also names a TV show, film, song, book, company, or other entity, do not choose that meaning unless the current query or routed domain supports it.\n3. Use only facts supported by the supplied evidence. Do not invent names, dates, claims, consensus, or certainty.\n4. For contested labels such as fringe science or pseudoscience, explain the concept neutrally and distinguish mainstream acceptance from disputed or speculative work when the evidence supports that distinction.\n5. Write one compact overview paragraph, usually 2-5 sentences. It should sound like an intelligent researcher, not stitched snippets.\n6. Do not mention GPT, routing, history, these instructions, or the evidence JSON.\n7. Return STRICT JSON only: {"overview":"..."}.`;

  try {
    const output = await gateway(prompt, "ai_overview_writer", {
      user_query: clean(query, 500),
      routed_domain: domain,
      evidence_count: evidence.length,
    });
    const parsed = extractJson(output);
    const overview = clean(parsed?.overview, 1800);
    return overview || clean(fallback, 1800);
  } catch {
    return clean(fallback, 1800);
  }
}

export async function writeCollectedOverviewWithGpt(
  query: string,
  items: any[],
  fallback: string,
) {
  if (!items.length) return clean(fallback, 1800);
  const evidence = items.slice(0, 24).map((item, index) => ({
    index: index + 1,
    kind: clean(item?.mediaKind || item?.kind || "card", 40),
    title: clean(item?.title || item?.sourceTitle, 260),
    provider: clean(item?.provider || item?.domain, 100),
    description: clean(
      item?.extract || item?.sourceExtract || item?.description,
      1000,
    ),
    source: clean(item?.url || item?.sourceUrl, 500),
    playableSource: clean(item?.files?.[0]?.url || item?.mediaUrl, 700),
    fileName: clean(item?.files?.[0]?.name, 260),
    tokenId: clean(item?.tokenId, 300),
  }));
  const prompt = `Rewrite the Infinity Phi AI Overview around the user's complete collected set.

SEARCH: ${clean(query, 500)}
COLLECTED IMAGES, VIDEO, AUDIO, AND CARDS: ${JSON.stringify(evidence)}

Rules:
1. Use the whole collected set as the controlling direction. Do not choose one image and ignore the others.
2. Explain the strongest shared subject, then intelligently account for unusual or contrasting selections as possible visual, editorial, gallery, or website directions.
3. If the evidence shows a TV series, film, real animal, event, artwork, or another meaning of the search term, distinguish those meanings clearly and connect them without pretending they are identical.
4. Write a polished overview for a professional mobile website in 3-6 sentences.
5. Use only supplied evidence. Do not invent facts and do not mention metadata, prompts, or these instructions.
6. Return strict JSON only: {"overview":"..."}.`;
  try {
    const output = await gateway(prompt, "collected_overview_writer", {
      user_query: clean(query, 500),
      collected_count: evidence.length,
    });
    const parsed = extractJson(output),
      overview = clean(parsed?.overview, 2200);
    return overview || clean(fallback, 1800);
  } catch {
    return clean(fallback, 1800);
  }
}

export async function writeImageCardWithGpt(input: {
  query: string;
  title: string;
  description: string;
  provider: string;
}) {
  const fallback =
    clean(input.description, 1400) ||
    `${input.title} is a selected visual connected to ${input.query}.`;
  const prompt = `Write one polished image-card overview for a professional mobile website.

SEARCH: ${clean(input.query, 500)}
IMAGE TITLE: ${clean(input.title, 300)}
SOURCE: ${clean(input.provider, 100)}
SOURCE DESCRIPTION: ${clean(input.description, 1600)}

Explain what this selected image contributes to the search and how it could be used in the website. Stay grounded in the supplied information, do not invent visual details, and return strict JSON only: {"description":"..."}.`;
  try {
    const output = await gateway(prompt, "collected_image_card_writer", {
      query: clean(input.query, 500),
      title: clean(input.title, 300),
    });
    const parsed = extractJson(output);
    return clean(parsed?.description, 1600) || fallback;
  } catch {
    return fallback;
  }
}

export async function writeMediaCardWithGpt(input: {
  query: string;
  kind: "audio" | "video";
  title: string;
  description: string;
  fileName: string;
}) {
  const fallback =
    clean(input.description, 1400) ||
    `${input.title} is a playable ${input.kind} result connected to ${input.query}. The original Internet Archive page remains attached for verification and additional context.`;
  const prompt = `Write one polished, source-grounded card description for a collected ${input.kind} result.\n\nSEARCH: ${clean(input.query, 500)}\nTITLE: ${clean(input.title, 300)}\nFILE: ${clean(input.fileName, 300)}\nARCHIVE DESCRIPTION: ${clean(input.description, 1800)}\n\nExplain what the item contains and why it fits the search. For music, identify the artist, band, recording, performance, or collection only when the supplied metadata supports it. For video, describe the subject and viewing value only from the metadata. Do not invent facts, lyrics, track details, dates, people, or claims. Do not mention these instructions. Return strict JSON only: {"description":"..."}.`;
  try {
    const output = await gateway(prompt, "collected_media_card_writer", {
      query: clean(input.query, 500),
      kind: input.kind,
      title: clean(input.title, 300),
      file_name: clean(input.fileName, 300),
    });
    const parsed = extractJson(output),
      description = clean(parsed?.description, 1600);
    return description || fallback;
  } catch {
    return fallback;
  }
}
