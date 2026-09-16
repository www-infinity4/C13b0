export type PhiRetrievalRuntime = "server" | "service" | "library";

export type PhiRetrievalBackend = {
  id: string;
  repo: string;
  role: string;
  runtime: PhiRetrievalRuntime;
  endpointKey?: string;
  requiresCredentials?: boolean;
};

/**
 * Backend/search forks owned by www-infinity4. This registry complements the
 * browser-side 15-stage query/relevance filters in phi-search-capabilities.ts.
 * A fork is source code, not a running service: server backends are only used
 * once an endpoint has been deployed/configured.
 */
export const PHI_RETRIEVAL_BACKENDS: PhiRetrievalBackend[] = [
  { id: "meilisearch", repo: "www-infinity4/meilisearch", role: "fast lexical and hybrid index", runtime: "server", endpointKey: "meilisearch" },
  { id: "typesense", repo: "www-infinity4/typesense", role: "typo-tolerant instant search and field ranking", runtime: "server", endpointKey: "typesense" },
  { id: "qdrant", repo: "www-infinity4/qdrant", role: "vector memory and semantic retrieval", runtime: "server", endpointKey: "qdrant" },
  { id: "vespa", repo: "www-infinity4/vespa", role: "multi-stage retrieval and ranking", runtime: "server", endpointKey: "vespa" },
  { id: "opensearch", repo: "www-infinity4/OpenSearch", role: "durable BM25 and vector search", runtime: "server", endpointKey: "opensearch" },
  { id: "llama-index", repo: "www-infinity4/llama_index", role: "document ingestion and retrieval orchestration", runtime: "library" },
  { id: "flag-embedding", repo: "www-infinity4/FlagEmbedding", role: "embeddings and reranking", runtime: "library" },
  { id: "sentence-transformers", repo: "www-infinity4/sentence-transformers", role: "semantic embeddings and similarity", runtime: "library" },
  { id: "colbert", repo: "www-infinity4/ColBERT", role: "late-interaction passage retrieval", runtime: "library" },
  { id: "faiss", repo: "www-infinity4/faiss", role: "local vector index and nearest-neighbor retrieval", runtime: "library" },
  { id: "unstructured", repo: "www-infinity4/unstructured", role: "article/document extraction and chunking", runtime: "service", endpointKey: "unstructured" },
  { id: "crawl4ai", repo: "www-infinity4/crawl4ai", role: "web crawling and article extraction", runtime: "service", endpointKey: "crawl4ai" },
  { id: "searxng", repo: "www-infinity4/searxng", role: "broad metasearch discovery", runtime: "server", endpointKey: "searxng" },
  { id: "google-api-nodejs-client", repo: "www-infinity4/google-api-nodejs-client", role: "official Google API access", runtime: "library", requiresCredentials: true },
  { id: "js-genai", repo: "www-infinity4/js-genai", role: "Gemini/Vertex synthesis and structured reasoning", runtime: "library", requiresCredentials: true },
];

export const PHI_RETRIEVAL_BACKEND_COUNT = PHI_RETRIEVAL_BACKENDS.length;

export type PhiRetrievalEndpointMap = Partial<Record<string, string>>;

/**
 * Public runtime endpoint configuration for the static GitHub Pages build.
 * NEXT_PUBLIC_* values are compiled into the browser bundle by Next.js.
 * Empty values intentionally mean "not configured" so the existing browser
 * providers remain the fallback instead of pretending a fork is live.
 */
export const PHI_RETRIEVAL_ENDPOINTS: PhiRetrievalEndpointMap = {
  searxng: process.env.NEXT_PUBLIC_PHI_SEARXNG_URL?.trim() || "",
};

export function configuredRetrievalBackends(endpoints: PhiRetrievalEndpointMap) {
  return PHI_RETRIEVAL_BACKENDS.filter((backend) => !backend.endpointKey || Boolean(endpoints[backend.endpointKey]));
}

export type PhiRetrievedSource = {
  title: string;
  url: string;
  excerpt: string;
  provider: string;
};

export async function searchSearxng(endpoint: string, query: string, limit = 12): Promise<PhiRetrievedSource[]> {
  const base = endpoint.trim().replace(/\/$/, "");
  if (!base || !query.trim()) return [];
  const url = `${base}/search?${new URLSearchParams({ q: query.trim(), format: "json" }).toString()}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`SearXNG search failed (${response.status})`);
  const payload = await response.json();
  return (Array.isArray(payload?.results) ? payload.results : []).slice(0, limit).flatMap((result: any) => {
    const title = String(result?.title || "").trim();
    const target = String(result?.url || "").trim();
    const excerpt = String(result?.content || result?.snippet || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || !target || !excerpt) return [];
    return [{ title, url: target, excerpt, provider: "SearXNG" }];
  });
}
