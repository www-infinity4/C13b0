// @ts-nocheck
// Runtime source federation deliberately normalizes several public APIs with different JSON shapes.
type PlannedIntent = {
  canonicalSubject: string;
  searchQueries: string[];
  requiredConcepts: string[];
  exactTerms: string[];
  excludedMeanings: string[];
};

type SyntheticPage = {
  pageid: number;
  title: string;
  extract: string;
  fullurl: string;
  thumbnail?: { source: string };
};

const AI_ENDPOINT = "https://infinity-rogers.marvaseater.workers.dev/v1/chat";
const BRIDGE_FLAG = "__infinityPhiOmniSourceBridgeV1";
const STOP = new Set("the a an and or of in on for to from with about what which who how why when where is are was were be been being this that these those tell show find search look give me my please".split(" "));

const clean = (value: unknown, max = 3200) => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const tokens = (value: string) => clean(value, 600).toLowerCase().match(/[a-z0-9]+/g) || [];
const significant = (value: string) => [...new Set(tokens(value).filter((word) => word.length > 2 && !STOP.has(word)))];

function timeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}

function providerUrl(rawUrl: string, provider: string) {
  try {
    const url = new URL(rawUrl);
    url.hash = `phi-provider=${encodeURIComponent(provider)}`;
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function parseAiJson(text: string) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

async function planQuery(originalFetch: typeof window.fetch, query: string): Promise<PlannedIntent> {
  const fallback: PlannedIntent = {
    canonicalSubject: clean(query, 220),
    searchQueries: [clean(query, 240)],
    requiredConcepts: significant(query).slice(0, 8),
    exactTerms: [],
    excludedMeanings: [],
  };
  const instruction = [
    "You are the query-planning layer for Infinity Phi research cards.",
    `User query: ${query}`,
    "Resolve one canonical subject and preserve the user's actual question.",
    "Return 2 to 4 distinct public-web search queries anchored to that same subject.",
    "Do not mix homonyms or similarly named people, places, works, objects, or scientific terms.",
    "requiredConcepts are ideas the evidence should discuss; exactTerms are names/numbers/phrases that cannot be lost; excludedMeanings are competing interpretations to reject.",
    "Return JSON only using: {\"canonicalSubject\":\"...\",\"searchQueries\":[\"...\"],\"requiredConcepts\":[\"...\"],\"exactTerms\":[\"...\"],\"excludedMeanings\":[\"...\"]}",
  ].join("\n");
  const response = await timeout(originalFetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ input: instruction, context: { application: "Infinity Phi", task: "omni-source-planning" } }),
  }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) })), 9000);
  if (!response?.ok) return fallback;
  const parsed = parseAiJson(response.body?.output_text || response.body?.output || "");
  if (!parsed) return fallback;
  const canonicalSubject = clean(parsed.canonicalSubject || query, 220) || fallback.canonicalSubject;
  const searchQueries = [...new Set([
    canonicalSubject,
    ...(Array.isArray(parsed.searchQueries) ? parsed.searchQueries : []),
    query,
  ].map((item) => clean(item, 240)).filter(Boolean))].slice(0, 4);
  return {
    canonicalSubject,
    searchQueries,
    requiredConcepts: (Array.isArray(parsed.requiredConcepts) ? parsed.requiredConcepts : []).map((v: unknown) => clean(v, 120)).filter(Boolean).slice(0, 12),
    exactTerms: (Array.isArray(parsed.exactTerms) ? parsed.exactTerms : []).map((v: unknown) => clean(v, 140)).filter(Boolean).slice(0, 10),
    excludedMeanings: (Array.isArray(parsed.excludedMeanings) ? parsed.excludedMeanings : []).map((v: unknown) => clean(v, 160)).filter(Boolean).slice(0, 12),
  };
}

function textScore(text: string, intent: PlannedIntent) {
  const lower = clean(text, 5000).toLowerCase();
  const anchors = significant(intent.canonicalSubject);
  const hits = anchors.filter((word) => lower.includes(word)).length;
  let score = anchors.length ? hits / anchors.length : 0.5;
  for (const term of intent.exactTerms) if (term && lower.includes(term.toLowerCase())) score += 0.18;
  for (const concept of intent.requiredConcepts) {
    const words = significant(concept);
    if (words.length && words.some((word) => lower.includes(word))) score += 0.05;
  }
  for (const excluded of intent.excludedMeanings) if (excluded && lower.includes(excluded.toLowerCase())) score -= 0.35;
  return score;
}

async function fetchOpenAlex(originalFetch: typeof window.fetch, query: string): Promise<SyntheticPage[]> {
  const endpoint = new URL("https://api.openalex.org/works");
  endpoint.search = new URLSearchParams({ search: query, "per-page": "8" }).toString();
  const response = await timeout(originalFetch(endpoint, { cache: "no-store" }), 6000);
  if (!response?.ok) return [];
  const data = await response.json().catch(() => ({}));
  return (data.results || []).flatMap((work: any, index: number) => {
    const title = clean(work.display_name || work.title, 220);
    if (!title) return [];
    const inverted = work.abstract_inverted_index || {};
    const words: string[] = [];
    Object.entries(inverted).forEach(([word, positions]) => (Array.isArray(positions) ? positions : []).forEach((position: any) => {
      if (Number.isFinite(position) && position < 380) words[position] = word;
    }));
    const host = clean(work.primary_location?.source?.display_name || work.best_oa_location?.source?.display_name || "scholarly publication", 180);
    const year = work.publication_year ? ` Published ${work.publication_year}.` : "";
    const extract = clean(words.filter(Boolean).join(" "), 2800) || `${title}.${year} Scholarly work indexed by OpenAlex from ${host}.`;
    const rawUrl = work.primary_location?.landing_page_url || work.best_oa_location?.landing_page_url || work.doi || work.id || "";
    return [{ pageid: 210000 + index, title, extract, fullurl: providerUrl(rawUrl, host || "OpenAlex") }];
  });
}

async function fetchNasa(originalFetch: typeof window.fetch, query: string): Promise<SyntheticPage[]> {
  const endpoint = new URL("https://images-api.nasa.gov/search");
  endpoint.search = new URLSearchParams({ q: query, media_type: "image", page_size: "10" }).toString();
  const response = await timeout(originalFetch(endpoint, { cache: "no-store" }), 6000);
  if (!response?.ok) return [];
  const data = await response.json().catch(() => ({}));
  return (data.collection?.items || []).flatMap((item: any, index: number) => {
    const meta = item.data?.[0] || {};
    const title = clean(meta.title, 220);
    const extract = clean(meta.description || meta.description_508, 2800);
    if (!title || !extract) return [];
    const nasaId = clean(meta.nasa_id, 180);
    const rawUrl = nasaId ? `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}` : clean(item.href, 1200);
    const image = clean((item.links || []).find((link: any) => link.render === "image")?.href || item.links?.[0]?.href, 1400);
    return [{ pageid: 220000 + index, title, extract, fullurl: providerUrl(rawUrl, "NASA"), thumbnail: image ? { source: image } : undefined }];
  });
}

async function readArticle(originalFetch: typeof window.fetch, url: string) {
  if (!/^https?:\/\//i.test(url)) return "";
  const response = await timeout(originalFetch(`https://r.jina.ai/${url}`, { cache: "no-store", headers: { Accept: "text/plain" } }), 6500);
  if (!response?.ok) return "";
  const text = await response.text().catch(() => "");
  return clean(text
    .replace(/^Title:.*$/gmi, " ")
    .replace(/^URL Source:.*$/gmi, " ")
    .replace(/^Published Time:.*$/gmi, " ")
    .replace(/^Markdown Content:.*$/gmi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " "), 3000);
}

async function fetchGdelt(originalFetch: typeof window.fetch, query: string): Promise<SyntheticPage[]> {
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.search = new URLSearchParams({ query, mode: "artlist", maxrecords: "8", format: "json", sort: "HybridRel" }).toString();
  const response = await timeout(originalFetch(endpoint, { cache: "no-store" }), 6500);
  if (!response?.ok) return [];
  const data = await response.json().catch(() => ({}));
  const base = (data.articles || []).slice(0, 6);
  const pages = await Promise.all(base.map(async (article: any, index: number) => {
    const rawUrl = clean(article.url, 1200);
    const title = clean(article.title, 220);
    if (!rawUrl || !title) return null;
    const articleText = index < 3 ? await readArticle(originalFetch, rawUrl) : "";
    const provider = clean(article.domain, 180) || "News / GDELT";
    const fallback = `${title}. News report indexed by GDELT from ${provider}${article.seendate ? `, seen ${clean(article.seendate, 40)}` : ""}.`;
    const image = clean(article.socialimage, 1400);
    return { pageid: 230000 + index, title, extract: articleText || fallback, fullurl: providerUrl(rawUrl, provider), thumbnail: image ? { source: image } : undefined } as SyntheticPage;
  }));
  return pages.filter(Boolean) as SyntheticPage[];
}

async function fetchInternetArchive(originalFetch: typeof window.fetch, query: string): Promise<SyntheticPage[]> {
  const endpoint = new URL("https://archive.org/advancedsearch.php");
  endpoint.search = new URLSearchParams({ q: query, "fl[]": "identifier,title,description,creator,date", rows: "8", page: "1", output: "json" }).toString();
  const response = await timeout(originalFetch(endpoint, { cache: "no-store" }), 6500);
  if (!response?.ok) return [];
  const data = await response.json().catch(() => ({}));
  return (data.response?.docs || []).flatMap((doc: any, index: number) => {
    const identifier = clean(doc.identifier, 260);
    const title = clean(Array.isArray(doc.title) ? doc.title[0] : doc.title, 220);
    if (!identifier || !title) return [];
    const description = clean(Array.isArray(doc.description) ? doc.description[0] : doc.description, 2600);
    const creator = clean(Array.isArray(doc.creator) ? doc.creator.join(", ") : doc.creator, 260);
    const date = clean(doc.date, 80);
    const extract = description || `${title}.${creator ? ` Created by ${creator}.` : ""}${date ? ` Date: ${date}.` : ""} Historical or archival record indexed by Internet Archive.`;
    return [{
      pageid: 240000 + index,
      title,
      extract,
      fullurl: providerUrl(`https://archive.org/details/${encodeURIComponent(identifier)}`, "Internet Archive"),
      thumbnail: { source: `https://archive.org/services/img/${encodeURIComponent(identifier)}` },
    }];
  });
}

function domainOf(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

function diversify(pages: SyntheticPage[], intent: PlannedIntent) {
  const ranked = pages
    .map((page) => ({ page, score: textScore(`${page.title} ${page.extract}`, intent) }))
    .sort((a, b) => b.score - a.score);
  const chosen: SyntheticPage[] = [];
  const domains = new Map<string, number>();
  const seen = new Set<string>();
  for (const item of ranked) {
    const page = item.page;
    const key = `${page.fullurl}|${page.title}`.toLowerCase();
    if (seen.has(key)) continue;
    const domain = domainOf(page.fullurl) || "unknown";
    const count = domains.get(domain) || 0;
    if (domain.includes("wikipedia.org") && count >= 1) continue;
    if (count >= 2) continue;
    if (item.score < 0.08 && chosen.length >= 5) continue;
    seen.add(key);
    domains.set(domain, count + 1);
    chosen.push(page);
    if (chosen.length >= 12) break;
  }
  return chosen;
}

export function installPhiOmniSourceBridge() {
  if (typeof window === "undefined") return;
  const scope = window as any;
  if (scope[BRIDGE_FLAG]) return;
  scope[BRIDGE_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let url: URL;
    try { url = new URL(raw, location.href); } catch { return originalFetch(input, init); }
    const isPhiWikipedia = url.hostname === "en.wikipedia.org" && url.pathname.endsWith("/w/api.php") && url.searchParams.get("generator") === "search";
    if (!isPhiWikipedia) return originalFetch(input, init);

    const query = clean(url.searchParams.get("gsrsearch") || "", 600);
    if (!query) return originalFetch(input, init);

    try {
      const intent = await planQuery(originalFetch, query);
      const searchQueries = [...new Set([query, ...intent.searchQueries])].slice(0, 3);
      const wikiPromise = originalFetch(input, init).then((r) => r.ok ? r.json() : {}).catch(() => ({}));
      const tasks: Promise<SyntheticPage[]>[] = [];
      for (const q of searchQueries) {
        tasks.push(fetchOpenAlex(originalFetch, q));
        tasks.push(fetchNasa(originalFetch, q));
        tasks.push(fetchGdelt(originalFetch, q));
        tasks.push(fetchInternetArchive(originalFetch, q));
      }
      const [wiki, settled] = await Promise.all([wikiPromise, Promise.allSettled(tasks)]);
      const wikiPages = Object.values(wiki?.query?.pages || {}).slice(0, 3).map((page: any, index) => ({
        pageid: Number(page?.pageid) || 200000 + index,
        title: clean(page?.title, 220),
        extract: clean(page?.extract, 3000),
        fullurl: providerUrl(clean(page?.fullurl, 1400), "Wikipedia"),
        thumbnail: page?.thumbnail?.source ? { source: clean(page.thumbnail.source, 1400) } : undefined,
      })).filter((page: SyntheticPage) => page.title && page.extract);
      const external = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
      const pages = diversify([...external, ...wikiPages], intent);
      if (!pages.length) return new Response(JSON.stringify(wiki), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
      const payload = { batchcomplete: "", query: { pages: Object.fromEntries(pages.map((page, index) => [`phi_${index}`, page])) } };
      return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
    } catch (error) {
      console.warn("Infinity Phi Omni source bridge fallback", error);
      return originalFetch(input, init);
    }
  }) as typeof window.fetch;
}
