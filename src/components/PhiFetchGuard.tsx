"use client";

import { useEffect } from "react";

const SNAKE_SENSE = /\b(snake|serpent|cobra|viper|boa|reptile)\b/i;
const STOP = new Set(["about", "after", "again", "against", "because", "before", "being", "between", "could", "every", "first", "from", "have", "into", "itself", "more", "other", "over", "same", "such", "than", "that", "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "while", "with", "would", "your", "chemical", "element", "atomic", "number"]);

function words(value: string) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9]+/g) || []).filter((word) => word.length > 2 && !STOP.has(word)))];
}

function visualSenseAllowed(title: string, query: string) {
  if (SNAKE_SENSE.test(query)) return true;
  return !SNAKE_SENSE.test(title);
}

function pageScore(page: any, query: string) {
  const title = String(page?.title || "").trim().toLowerCase();
  const extract = String(page?.extract || "").toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  const queryWords = words(query);
  let score = 0;

  if (title === normalizedQuery) score += 600;
  if (title === `${normalizedQuery} (plant)` || title === `${normalizedQuery} (food)`) score += 520;
  if (title.startsWith(`${normalizedQuery} (`)) score += 360;
  if (title.startsWith(`${normalizedQuery} `)) score += 140;

  for (const word of queryWords) {
    const boundary = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (boundary.test(title)) score += 90;
    if (boundary.test(extract.slice(0, 900))) score += 24;
  }

  if (page?.thumbnail?.source) score += 8;
  if (!visualSenseAllowed(title, query)) score -= 2000;
  return score;
}

function repairWikipediaPayload(data: any, query: string) {
  const pages = Object.values(data?.query?.pages || {}) as any[];
  if (!pages.length) return data;

  const filtered = pages
    .filter((page) => visualSenseAllowed(String(page?.title || ""), query))
    .sort((a, b) => pageScore(b, query) - pageScore(a, query));

  if (!filtered.length) return data;
  data.query.pages = Object.fromEntries(filtered.map((page, index) => [`rank_${index}`, page]));
  return data;
}

export default function PhiFetchGuard() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const guardedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      try {
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(rawUrl, window.location.href);
        const isPhiWikipediaSearch =
          url.hostname === "en.wikipedia.org" &&
          url.pathname.endsWith("/w/api.php") &&
          url.searchParams.get("generator") === "search";

        if (!isPhiWikipediaSearch || !response.ok) return response;

        const query = url.searchParams.get("gsrsearch") || "";
        const data = await response.clone().json();
        const repaired = repairWikipediaPayload(data, query);
        const headers = new Headers(response.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");
        headers.set("content-type", "application/json; charset=utf-8");

        return new Response(JSON.stringify(repaired), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        return response;
      }
    };

    window.fetch = guardedFetch;
    return () => {
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
