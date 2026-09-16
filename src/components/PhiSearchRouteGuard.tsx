"use client";

import { useLayoutEffect } from "react";
import PhiUnifiedPage from "@/components/PhiUnifiedPage";
import {
  configuredRetrievalBackends,
  runtimeRetrievalEndpoints,
  searchSearxng,
  type PhiRetrievedSource,
} from "@/lib/phi-retrieval-backends";
import {
  searchOmniBrowserSources,
  type PhiOmniSource,
} from "@/lib/phi-omni-browser-search";

type PhiSearchWindow = Window & {
  __phiRetrievalFetchWrapped?: boolean;
  __phiConfiguredRetrievalBackends?: string[];
};

type RetrievedSource = PhiRetrievedSource & { imageUrl?: string };

const NEWS_PHI_URL = "https://www-infinity4.github.io/News-Phi/";
const OMNI_PHI_URL = "https://www-infinity4.github.io/Omni-Phi/";

function sourceKey(source: RetrievedSource) {
  return String(source.url || `${source.provider}:${source.title}`).trim().toLowerCase();
}

function mergeRetrievedIntoWikipedia(payload: any, sources: RetrievedSource[]) {
  if (!sources.length) return payload;
  const next = payload && typeof payload === "object" ? payload : {};
  next.query = next.query && typeof next.query === "object" ? next.query : {};
  next.query.pages = next.query.pages && typeof next.query.pages === "object" ? next.query.pages : {};

  const existingUrls = new Set(
    Object.values(next.query.pages as Record<string, any>)
      .map((page: any) => String(page?.fullurl || page?.canonicalurl || "").replace(/#phi-provider=.*$/, ""))
      .filter(Boolean),
  );

  sources.forEach((source, index) => {
    if (!source.url || existingUrls.has(source.url)) return;
    let taggedUrl = source.url;
    try {
      const target = new URL(source.url);
      if (source.provider && source.provider !== "Wikipedia") {
        target.hash = `phi-provider=${encodeURIComponent(source.provider)}`;
      }
      taggedUrl = target.toString();
    } catch {}

    next.query.pages[`omni_${index}`] = {
      pageid: -(index + 1),
      ns: 0,
      title: source.title,
      extract: source.excerpt,
      fullurl: taggedUrl,
      canonicalurl: source.url,
      index: 1000 + index,
      phiProvider: source.provider,
      ...(source.imageUrl ? { thumbnail: { source: source.imageUrl } } : {}),
    };
    existingUrls.add(source.url);
  });

  return next;
}

async function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      work.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = window.setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

async function gatherSharedSources(searxEndpoint: string, query: string): Promise<RetrievedSource[]> {
  const jobs: Promise<RetrievedSource[]>[] = [
    searchOmniBrowserSources(query, 20) as Promise<PhiOmniSource[]>,
  ];
  if (searxEndpoint) {
    jobs.push(within(searchSearxng(searxEndpoint, query, 18), 3200, []));
  }

  const batches = await Promise.allSettled(jobs);
  const merged: RetrievedSource[] = [];
  const seen = new Set<string>();
  batches.forEach((batch) => {
    if (batch.status !== "fulfilled") return;
    batch.value.forEach((source) => {
      const key = sourceKey(source);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(source);
    });
  });
  return merged.slice(0, 28);
}

/**
 * Search Phi is a static GitHub Pages app. Once a document is loaded, every
 * search stays on that exact pathname and only changes q/run in the query
 * string. That prevents a mounted root document from masquerading as /phi/
 * (or vice versa), which can make the Next router eventually request a static
 * route and show a delayed GitHub Pages 404.
 *
 * The same guard feeds Infinity Phi from the public multi-source provider
 * family used by Omni Phi (OpenAlex, NASA, GDELT and Internet Archive), plus
 * SearXNG when Control Phi has configured it. Infinity's own source gate and
 * semantic card ranking remain in charge after retrieval.
 */
export default function PhiSearchRouteGuard() {
  useLayoutEffect(() => {
    const history = window.history as History & {
      pushState: History["pushState"];
      replaceState: History["replaceState"];
    };
    const frameworkPushState = history.pushState.bind(history);
    const frameworkReplaceState = history.replaceState.bind(history);
    const nativePushState = window.History.prototype.pushState;
    const nativeReplaceState = window.History.prototype.replaceState;
    const trackedWindow = window as PhiSearchWindow;
    const endpoints = runtimeRetrievalEndpoints();

    trackedWindow.__phiConfiguredRetrievalBackends = configuredRetrievalBackends(endpoints).map((backend) => backend.id);

    const searxEndpoint = endpoints.searxng?.trim() || "";
    const upstreamFetch = window.fetch.bind(window);
    let installedFetch: typeof window.fetch | null = null;

    if (!trackedWindow.__phiRetrievalFetchWrapped) {
      trackedWindow.__phiRetrievalFetchWrapped = true;
      installedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
        let parsed: URL;
        try {
          parsed = new URL(rawUrl, window.location.href);
        } catch {
          return upstreamFetch(input, init);
        }

        const isWikipediaSearch = parsed.hostname === "en.wikipedia.org"
          && parsed.pathname.endsWith("/w/api.php")
          && parsed.searchParams.get("generator") === "search";
        if (!isWikipediaSearch) return upstreamFetch(input, init);

        const query = parsed.searchParams.get("gsrsearch")?.trim() || "";
        if (!query) return upstreamFetch(input, init);

        const [baseResult, sharedResult] = await Promise.allSettled([
          upstreamFetch(input, init),
          within(gatherSharedSources(searxEndpoint, query), 3900, []),
        ]);

        const baseResponse = baseResult.status === "fulfilled" ? baseResult.value : null;
        const sharedSources = sharedResult.status === "fulfilled" ? sharedResult.value : [];
        if (!sharedSources.length) {
          if (baseResponse) return baseResponse;
          return new Response(JSON.stringify({ query: { pages: {} } }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }

        let payload: any = {};
        if (baseResponse) {
          try {
            payload = await baseResponse.clone().json();
          } catch {
            payload = {};
          }
        }

        const merged = mergeRetrievedIntoWikipedia(payload, sharedSources);
        const headers = new Headers(baseResponse?.headers || undefined);
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(JSON.stringify(merged), { status: 200, headers });
      };
      window.fetch = installedFetch;
    }

    const isInfinitySearch = (data: unknown, url?: string | URL | null) => {
      if (data && typeof data === "object" && "infinityPhiSearch" in data) return true;
      if (!url) return false;
      try {
        const target = new URL(String(url), window.location.href);
        return target.origin === window.location.origin
          && target.searchParams.has("q")
          && target.searchParams.get("run") === "1";
      } catch {
        return false;
      }
    };

    const pinnedSearchUrl = (url: string | URL) => {
      const target = new URL(String(url), window.location.href);
      target.pathname = window.location.pathname;
      target.hash = "";
      return target.toString();
    };

    history.pushState = function guardedPushState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url) && url) {
        nativePushState.call(history, data, unused, pinnedSearchUrl(url));
        return;
      }
      return frameworkPushState(data, unused, url);
    };

    history.replaceState = function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url) && url) {
        nativeReplaceState.call(history, data, unused, pinnedSearchUrl(url));
        return;
      }
      return frameworkReplaceState(data, unused, url);
    };

    return () => {
      history.pushState = frameworkPushState;
      history.replaceState = frameworkReplaceState;
      if (installedFetch && window.fetch === installedFetch) {
        window.fetch = upstreamFetch;
        trackedWindow.__phiRetrievalFetchWrapped = false;
      }
    };
  }, []);

  return (
    <>
      <nav className="fixed right-3 top-[max(.7rem,env(safe-area-inset-top))] z-[65] flex gap-2" aria-label="Phi family">
        <a
          href={NEWS_PHI_URL}
          className="rounded-full border border-white/30 bg-[#a92f68]/95 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur"
        >
          News Phi
        </a>
        <a
          href={OMNI_PHI_URL}
          className="rounded-full border border-white/30 bg-[#6840bd]/95 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur"
        >
          Omni Phi
        </a>
      </nav>
      <PhiUnifiedPage />
    </>
  );
}
