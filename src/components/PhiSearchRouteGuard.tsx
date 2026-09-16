"use client";

import { useLayoutEffect } from "react";
import PhiUnifiedPage from "@/components/PhiUnifiedPage";
import {
  configuredRetrievalBackends,
  runtimeRetrievalEndpoints,
  searchSearxng,
  type PhiRetrievedSource,
} from "@/lib/phi-retrieval-backends";

type PhiSearchWindow = Window & {
  __phiSearxFetchWrapped?: boolean;
  __phiConfiguredRetrievalBackends?: string[];
};

function mergeSearxIntoWikipedia(payload: any, sources: PhiRetrievedSource[]) {
  if (!sources.length) return payload;
  const next = payload && typeof payload === "object" ? payload : {};
  next.query = next.query && typeof next.query === "object" ? next.query : {};
  next.query.pages = next.query.pages && typeof next.query.pages === "object" ? next.query.pages : {};

  const existingUrls = new Set(
    Object.values(next.query.pages as Record<string, any>)
      .map((page: any) => String(page?.fullurl || page?.canonicalurl || ""))
      .filter(Boolean),
  );

  sources.forEach((source, index) => {
    if (existingUrls.has(source.url)) return;
    next.query.pages[`searx_${index}`] = {
      pageid: -(index + 1),
      ns: 0,
      title: source.title,
      extract: source.excerpt,
      fullurl: source.url,
      canonicalurl: source.url,
      index: 1000 + index,
      phiProvider: source.provider,
    };
    existingUrls.add(source.url);
  });

  return next;
}

/**
 * Infinity Phi is exported as a static GitHub Pages app. Next.js patches the
 * History API so a same-page query update can accidentally become a client
 * router navigation and stall or 404 on the static export. For an actual Phi
 * search, reload the already-exported /phi/ document with q/run in the query
 * string. PhiPage2 already reads those params on mount and starts the search.
 *
 * This guard also connects the typed retrieval registry to the live search
 * stream. When SearXNG is configured either by the Pages build or the shared
 * Control/News Phi browser config, SearXNG runs beside the existing
 * v9/Wikipedia/DDG/Crossref providers and its results are merged into the
 * Wikipedia-shaped response PhiPage2 already consumes. If SearXNG is absent
 * or fails, the existing providers continue normally.
 */
export default function PhiSearchRouteGuard() {
  useLayoutEffect(() => {
    const history = window.history as History & { pushState: History["pushState"]; replaceState: History["replaceState"] };
    const frameworkPushState = history.pushState.bind(history);
    const frameworkReplaceState = history.replaceState.bind(history);
    const trackedWindow = window as PhiSearchWindow;
    const endpoints = runtimeRetrievalEndpoints();

    trackedWindow.__phiConfiguredRetrievalBackends = configuredRetrievalBackends(endpoints).map((backend) => backend.id);

    const searxEndpoint = endpoints.searxng?.trim() || "";
    const upstreamFetch = window.fetch.bind(window);
    let installedFetch: typeof window.fetch | null = null;

    if (searxEndpoint && !trackedWindow.__phiSearxFetchWrapped) {
      trackedWindow.__phiSearxFetchWrapped = true;
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

        const [baseResult, searxResult] = await Promise.allSettled([
          upstreamFetch(input, init),
          searchSearxng(searxEndpoint, query, 18),
        ]);

        const baseResponse = baseResult.status === "fulfilled" ? baseResult.value : null;
        const searxSources = searxResult.status === "fulfilled" ? searxResult.value : [];
        if (!searxSources.length) {
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

        const merged = mergeSearxIntoWikipedia(payload, searxSources);
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
        const current = window.location.pathname.replace(/\/$/, "");
        const next = target.pathname.replace(/\/$/, "");
        return current === next && target.searchParams.has("q") && target.searchParams.get("run") === "1";
      } catch {
        return false;
      }
    };

    history.pushState = function guardedPushState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url) && url) {
        const target = new URL(String(url), window.location.href);
        window.location.assign(target.toString());
        return;
      }
      return frameworkPushState(data, unused, url);
    };

    history.replaceState = function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url) && url) {
        const target = new URL(String(url), window.location.href);
        window.location.replace(target.toString());
        return;
      }
      return frameworkReplaceState(data, unused, url);
    };

    return () => {
      history.pushState = frameworkPushState;
      history.replaceState = frameworkReplaceState;
      if (installedFetch && window.fetch === installedFetch) {
        window.fetch = upstreamFetch;
        trackedWindow.__phiSearxFetchWrapped = false;
      }
    };
  }, []);

  return <PhiUnifiedPage />;
}
