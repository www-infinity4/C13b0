"use client";
import { useEffect } from "react";
import SparkSearch from "./SparkSearch";
import { secureLoad } from "@/lib/secure-storage";
import { resolveContextualQuery, type ContextToken } from "@/lib/contextual-query";

const KEY = "c13b0_infinity_token_ledger_v3";

function rewriteUrl(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  let url: URL;
  try { url = new URL(raw); } catch { return input; }
  const history = secureLoad<ContextToken[]>(KEY, []);
  const wikiSearch = url.hostname === "en.wikipedia.org" && url.pathname.includes("/w/api.php");
  const duck = url.hostname === "api.duckduckgo.com";
  const crossref = url.hostname === "api.crossref.org";
  const param = wikiSearch ? (url.searchParams.has("gsrsearch") ? "gsrsearch" : url.searchParams.has("srsearch") ? "srsearch" : "") : duck ? "q" : crossref ? "query.bibliographic" : "";
  if (!param) return input;
  const current = url.searchParams.get(param) || "";
  const resolved = resolveContextualQuery(current, history);
  if (resolved.lookup === current) return input;
  url.searchParams.set(param, resolved.lookup);
  return url.toString();
}

export default function ContextualSpark() {
  useEffect(() => {
    const original = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => original(rewriteUrl(input), init)) as typeof window.fetch;
    return () => { window.fetch = original; };
  }, []);
  return <SparkSearch />;
}
