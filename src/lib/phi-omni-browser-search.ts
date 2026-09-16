import type { PhiRetrievedSource } from "@/lib/phi-retrieval-backends";

export type PhiOmniSource = PhiRetrievedSource & {
  imageUrl?: string;
  domain?: string;
};

const clean = (value: unknown, max = 2600) => String(value || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);

function domainOf(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

async function fetchJson(url: string, ms = 3200): Promise<any | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function normalize(source: Partial<PhiOmniSource>, provider: string): PhiOmniSource | null {
  const title = clean(source.title, 240);
  const excerpt = clean(source.excerpt, 2600);
  const url = clean(source.url, 1400);
  if (!title || !excerpt) return null;
  return {
    title,
    excerpt,
    url,
    provider: clean(provider || source.provider || "Public web", 100),
    imageUrl: clean(source.imageUrl, 1400) || undefined,
    domain: clean(source.domain, 180) || domainOf(url) || undefined,
  };
}

function openAlexAbstract(inverted: unknown) {
  if (!inverted || typeof inverted !== "object") return "";
  const words: string[] = [];
  Object.entries(inverted as Record<string, unknown>).forEach(([word, rawPositions]) => {
    if (!Array.isArray(rawPositions)) return;
    rawPositions.forEach((position) => {
      if (typeof position === "number" && Number.isFinite(position) && position >= 0 && position < 420) {
        words[position] = word;
      }
    });
  });
  return clean(words.filter(Boolean).join(" "), 2400);
}

async function fetchOpenAlex(query: string): Promise<PhiOmniSource[]> {
  const endpoint = new URL("https://api.openalex.org/works");
  endpoint.search = new URLSearchParams({ search: query, "per-page": "10" }).toString();
  const data = await fetchJson(endpoint.toString(), 3000);
  return (Array.isArray(data?.results) ? data.results : []).flatMap((work: any) => {
    const title = clean(work?.display_name || work?.title, 240);
    if (!title) return [];
    const abstract = openAlexAbstract(work?.abstract_inverted_index);
    const host = clean(
      work?.primary_location?.source?.display_name ||
      work?.best_oa_location?.source?.display_name ||
      work?.type_crossref ||
      "scholarly source",
      180,
    );
    const year = Number(work?.publication_year) || 0;
    const excerpt = abstract || `${title}.${year ? ` Published ${year}.` : ""} Scholarly work indexed by OpenAlex from ${host}.`;
    const url = clean(
      work?.primary_location?.landing_page_url ||
      work?.best_oa_location?.landing_page_url ||
      work?.doi ||
      work?.id,
      1400,
    );
    const source = normalize({ title, excerpt, url, domain: domainOf(url) || host }, "OpenAlex");
    return source ? [source] : [];
  });
}

async function fetchNasa(query: string): Promise<PhiOmniSource[]> {
  const endpoint = new URL("https://images-api.nasa.gov/search");
  endpoint.search = new URLSearchParams({ q: query, media_type: "image", page_size: "12" }).toString();
  const data = await fetchJson(endpoint.toString(), 3000);
  return (Array.isArray(data?.collection?.items) ? data.collection.items : []).flatMap((item: any) => {
    const meta = item?.data?.[0] || {};
    const title = clean(meta?.title, 240);
    const description = clean(meta?.description || meta?.description_508, 2500);
    if (!title || !description) return [];
    const nasaId = clean(meta?.nasa_id, 200);
    const url = nasaId ? `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}` : clean(item?.href, 1400);
    const imageUrl = clean((item?.links || []).find((link: any) => link?.render === "image")?.href || item?.links?.[0]?.href, 1400);
    const date = clean(meta?.date_created, 40);
    const source = normalize({
      title,
      url,
      excerpt: `${description}${date ? ` Date: ${date.slice(0, 10)}.` : ""}`,
      imageUrl,
      domain: "nasa.gov",
    }, "NASA");
    return source ? [source] : [];
  });
}

async function fetchGdelt(query: string): Promise<PhiOmniSource[]> {
  const endpoint = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  endpoint.search = new URLSearchParams({
    query,
    mode: "artlist",
    maxrecords: "12",
    format: "json",
    sort: "HybridRel",
  }).toString();
  const data = await fetchJson(endpoint.toString(), 3200);
  return (Array.isArray(data?.articles) ? data.articles : []).flatMap((article: any) => {
    const url = clean(article?.url, 1400);
    const title = clean(article?.title, 240);
    if (!url || !title) return [];
    const domain = clean(article?.domain, 180) || domainOf(url);
    const seen = clean(article?.seendate, 60);
    const source = normalize({
      title,
      url,
      domain,
      imageUrl: clean(article?.socialimage, 1400),
      excerpt: `${title}. News report indexed by GDELT from ${domain || "the public web"}${seen ? `, seen ${seen}.` : "."}`,
    }, "News / GDELT");
    return source ? [source] : [];
  });
}

async function fetchInternetArchive(query: string): Promise<PhiOmniSource[]> {
  const endpoint = new URL("https://archive.org/advancedsearch.php");
  const params = new URLSearchParams({ q: query, rows: "10", page: "1", output: "json" });
  ["identifier", "title", "description", "creator", "date"].forEach((field) => params.append("fl[]", field));
  endpoint.search = params.toString();
  const data = await fetchJson(endpoint.toString(), 3200);
  return (Array.isArray(data?.response?.docs) ? data.response.docs : []).flatMap((doc: any) => {
    const identifier = clean(doc?.identifier, 260);
    const title = clean(Array.isArray(doc?.title) ? doc.title[0] : doc?.title, 240);
    if (!identifier || !title) return [];
    const description = clean(Array.isArray(doc?.description) ? doc.description[0] : doc?.description, 2400);
    const creator = clean(Array.isArray(doc?.creator) ? doc.creator.join(", ") : doc?.creator, 260);
    const date = clean(doc?.date, 80);
    const excerpt = description || `${title}.${creator ? ` Created by ${creator}.` : ""}${date ? ` Date: ${date}.` : ""} Historical or archival record indexed by Internet Archive.`;
    const source = normalize({
      title,
      url: `https://archive.org/details/${encodeURIComponent(identifier)}`,
      domain: "archive.org",
      imageUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
      excerpt,
    }, "Internet Archive");
    return source ? [source] : [];
  });
}

function dedupe(sources: PhiOmniSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = clean(source.url || `${source.provider}:${source.title}`, 1500).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function diversify(sources: PhiOmniSource[], limit: number) {
  const queues = new Map<string, PhiOmniSource[]>();
  sources.forEach((source) => {
    const key = source.provider || "Public web";
    const queue = queues.get(key) || [];
    queue.push(source);
    queues.set(key, queue);
  });

  const out: PhiOmniSource[] = [];
  const domainCount = new Map<string, number>();
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const queue of queues.values()) {
      while (queue.length) {
        const source = queue.shift()!;
        const domain = source.domain || domainOf(source.url) || source.provider;
        const count = domainCount.get(domain) || 0;
        if (count >= 3) continue;
        domainCount.set(domain, count + 1);
        out.push(source);
        progressed = true;
        break;
      }
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Browser-safe subset of Omni Phi's multi-source search. It deliberately runs
 * the same public providers in parallel, but uses shorter per-provider budgets
 * so Infinity Phi can stay inside its existing five-second first-result window.
 * Infinity's own source gate/ranker still decides which records become cards.
 */
export async function searchOmniBrowserSources(query: string, limit = 18): Promise<PhiOmniSource[]> {
  const q = clean(query, 500);
  if (!q) return [];

  const batches = await Promise.allSettled([
    fetchOpenAlex(q),
    fetchNasa(q),
    fetchGdelt(q),
    fetchInternetArchive(q),
  ]);

  const merged: PhiOmniSource[] = [];
  batches.forEach((batch) => {
    if (batch.status === "fulfilled") merged.push(...batch.value);
  });
  return diversify(dedupe(merged), Math.max(1, Math.min(limit, 28)));
}
