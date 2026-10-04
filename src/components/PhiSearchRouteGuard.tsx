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

export const NEWS_PHI_URL = "https://www-infinity4.github.io/News-Phi/";
export const OMNI_PHI_URL = "https://www-infinity4.github.io/Omni-Phi/";
export const WEB_PHI_URL = "https://www-infinity4.github.io/Web-Phi/";

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
 * Infinity Phi is a static GitHub Pages app. Next.js patches the History API,
 * so a same-document query update can be mistaken for an App Router navigation.
 * The search shell already remounts PhiPage2 after it writes q/run to the URL,
 * therefore a document reload is unnecessary and can create a Pages 404.
 *
 * For Infinity searches only, call the browser's native History methods. This
 * keeps the exported /phi/ document alive while PhiPage2 immediately starts the
 * new search. Optional SearXNG enrichment remains additive and has its own
 * timeout in phi-retrieval-backends so it cannot hold the base source pass open.
 */
export default function PhiSearchRouteGuard() {
  useLayoutEffect(() => {
    const history = window.history as History & { pushState: History["pushState"]; replaceState: History["replaceState"] };
    const frameworkPushState = history.pushState.bind(history);
    const frameworkReplaceState = history.replaceState.bind(history);
    const nativePushState = History.prototype.pushState;
    const nativeReplaceState = History.prototype.replaceState;
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
      if (isInfinitySearch(data, url)) {
        nativePushState.call(history, data, unused, url);
        return;
      }
      return frameworkPushState(data, unused, url);
    };

    history.replaceState = function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url)) {
        nativeReplaceState.call(history, data, unused, url);
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

  return (
    <>
      <PhiUnifiedPage />
      <footer style={{ display: "grid", placeItems: "center", padding: "32px 16px 112px" }}>
        <a
          href="https://quantaphi.org/mckee-coins/"
          aria-label="Open McKee Coins"
          style={{
            display: "grid",
            placeItems: "center",
            width: "min(82vw, 290px)",
            minHeight: "190px",
            padding: "22px",
            border: "5px double #6f4a08",
            borderRadius: "50%",
            background: "radial-gradient(circle at 34% 28%, #fff4a8 0, #f6c84b 22%, #bd7711 58%, #6b3905 100%)",
            color: "#241300",
            textAlign: "center",
            textDecoration: "none",
            fontFamily: "Georgia, serif",
            fontWeight: 900,
            boxShadow: "0 18px 42px rgba(70,38,0,.32), inset 0 0 0 7px rgba(255,238,151,.48), inset 0 -16px 28px rgba(79,40,0,.28)",
          }}
        >
          <span style={{ fontSize: "1.7rem", letterSpacing: ".04em", lineHeight: 1.05 }}>McKee Coins</span>
          <span style={{ fontSize: "1rem", letterSpacing: ".16em", textTransform: "uppercase" }}>Tap Here</span>
          <span aria-hidden="true" style={{ fontSize: "2rem", lineHeight: 1 }}>★</span>
        </a>
      </footer>
    </>
  );
}
