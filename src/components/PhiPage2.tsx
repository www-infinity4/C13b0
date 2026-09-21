"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Image as ImageIcon,
  Search,
  Share2,
  Sparkles,
} from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureSave } from "@/lib/secure-storage";
import {
  appendPhiTokenItems,
  beginPhiSearchToken,
  phiTokenItems,
  resolvePhiSearchToken,
} from "@/lib/phi-search-token";
import { awardPhiStarCredit } from "@/lib/phi-star-rewards";
import { writeCollectedOverviewWithGpt } from "@/lib/phi-gpt-router";

type HistoryItem = {
  query: string;
  resolved: string;
  kind: string;
  at: number;
};
type Source = {
  id: string;
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  provider: string;
  imageUrl?: string;
  score?: number;
  mediaKind?: "audio" | "video";
  mediaUrl?: string;
};
type ResultRecord = {
  query: string;
  resolved: string;
  title: string;
  overview: string;
  sources: Source[];
  created: number;
};
type ShareResult = {
  copied?: boolean;
  cancelled?: boolean;
  awarded?: number;
  progressToNextCoin?: number;
};
const HISTORY = "infinity_phi_context_v1",
  INFINITY_RESEARCH = "infinityPhi:lastResearch:v1",
  SHARED_COLLECTION = "phiShared:collection:v1",
  CURRENT_SEARCH_COLLECTION = "infinityPhi:currentSearchCollection:v1",
  IMAGE_OVERVIEW = "infinity_phi_selected_image_overview_v1",
  IMAGE_BY_QUERY = "infinity_phi_image_selections_by_query_v1",
  NEWS_PHI_URL = "https://www-infinity4.github.io/News-Phi/",
  FALLBACK_IMAGE = "https://www-infinity4.github.io/C13b0/og-image.png";
const STOP = new Set([
  "about",
  "after",
  "again",
  "against",
  "because",
  "before",
  "being",
  "between",
  "could",
  "every",
  "first",
  "from",
  "have",
  "into",
  "itself",
  "more",
  "other",
  "over",
  "same",
  "such",
  "than",
  "that",
  "their",
  "these",
  "they",
  "this",
  "through",
  "under",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "also",
  "only",
  "some",
  "most",
  "many",
  "search",
]);
const ELEMENTS: Record<string, { symbol: string; number: number }> = {
  hydrogen: { symbol: "H", number: 1 },
  helium: { symbol: "He", number: 2 },
  boron: { symbol: "B", number: 5 },
  carbon: { symbol: "C", number: 6 },
  nitrogen: { symbol: "N", number: 7 },
  oxygen: { symbol: "O", number: 8 },
  fluorine: { symbol: "F", number: 9 },
  aluminum: { symbol: "Al", number: 13 },
  potassium: { symbol: "K", number: 19 },
  manganese: { symbol: "Mn", number: 25 },
  iron: { symbol: "Fe", number: 26 },
  copper: { symbol: "Cu", number: 29 },
  arsenic: { symbol: "As", number: 33 },
  selenium: { symbol: "Se", number: 34 },
  yttrium: { symbol: "Y", number: 39 },
  niobium: { symbol: "Nb", number: 41 },
  technetium: { symbol: "Tc", number: 43 },
  antimony: { symbol: "Sb", number: 51 },
  iodine: { symbol: "I", number: 53 },
  dysprosium: { symbol: "Dy", number: 66 },
  ytterbium: { symbol: "Yb", number: 70 },
  hafnium: { symbol: "Hf", number: 72 },
  tantalum: { symbol: "Ta", number: 73 },
  tungsten: { symbol: "W", number: 74 },
  rhenium: { symbol: "Re", number: 75 },
  platinum: { symbol: "Pt", number: 78 },
  gold: { symbol: "Au", number: 79 },
  mercury: { symbol: "Hg", number: 80 },
  lead: { symbol: "Pb", number: 82 },
  bismuth: { symbol: "Bi", number: 83 },
  uranium: { symbol: "U", number: 92 },
  bohrium: { symbol: "Bh", number: 107 },
};
const clean = (v: unknown, max = 3200) =>
  String(v || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const domainOf = (v: string) => {
  try {
    return new URL(v).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const sentence = (v: string) =>
  clean(v)
    .split(/(?<=[.!?])\s+/)
    .find((x) => x.length > 35) || clean(v, 420);
const tokens = (v: string) => [
  ...new Set(
    (
      clean(v)
        .toLowerCase()
        .match(/[a-z0-9]+/g) || []
    ).filter((w) => w.length > 2 && !STOP.has(w)),
  ),
];
async function withTimeout<T>(p: Promise<T>, ms = 5200) {
  let t = 0;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, r) => {
        t = window.setTimeout(() => r(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}
function resolvedQuery(q: string) {
  const e = ELEMENTS[clean(q).toLowerCase()];
  if (!e) return q;
  const n = clean(q).replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  return `${n} chemical element ${e.symbol} atomic number ${e.number}`;
}
function hash(v: string) {
  let r = 0;
  for (let i = 0; i < v.length; i++) r = ((r << 5) - r + v.charCodeAt(i)) | 0;
  return r;
}
function normalizeSource(
  raw: Partial<Source>,
  provider: string,
): Source | null {
  const title = clean(raw.title, 240),
    excerpt = clean(raw.excerpt, 2800);
  if (!title || !excerpt) return null;
  const url = clean(raw.url, 1400),
    domain = clean(raw.domain, 180) || domainOf(url) || provider;
  return {
    id:
      clean(raw.id, 240) ||
      `${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.abs(hash(`${url}|${title}`))}`,
    title,
    url,
    domain,
    excerpt,
    provider: clean(raw.provider, 100) || provider,
    imageUrl: clean(raw.imageUrl, 1600) || undefined,
  };
}
async function fetchWikipedia(q: string) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: q,
    gsrlimit: "12",
    prop: "extracts|pageimages|info",
    exintro: "1",
    explaintext: "1",
    exlimit: "max",
    piprop: "thumbnail",
    pithumbsize: "900",
    inprop: "url",
    format: "json",
    origin: "*",
  }).toString();
  const r = await withTimeout(fetch(u, { cache: "no-store" }), 4800);
  if (!r.ok) throw new Error();
  const d = await r.json();
  return Object.values((d as any)?.query?.pages || {}).flatMap((p: any) => {
    const s = normalizeSource(
      {
        id: `wikipedia-${p.pageid}`,
        title: p.title,
        url: p.fullurl || `https://en.wikipedia.org/?curid=${p.pageid}`,
        domain: "wikipedia.org",
        excerpt: p.extract,
        imageUrl: p.thumbnail?.source,
      },
      "Wikipedia",
    );
    return s ? [s] : [];
  });
}
function openAlexAbstract(v: unknown) {
  if (!v || typeof v !== "object") return "";
  const w: string[] = [];
  Object.entries(v as Record<string, unknown>).forEach(([word, pos]) =>
    (Array.isArray(pos) ? pos : []).forEach((p) => {
      if (Number.isFinite(p) && Number(p) < 420) w[Number(p)] = word;
    }),
  );
  return clean(w.filter(Boolean).join(" "), 2600);
}
async function fetchOpenAlex(q: string) {
  const u = new URL("https://api.openalex.org/works");
  u.search = new URLSearchParams({ search: q, "per-page": "12" }).toString();
  const r = await withTimeout(fetch(u, { cache: "no-store" }), 4800);
  if (!r.ok) throw new Error();
  const d = await r.json();
  return ((d as any)?.results || []).flatMap((w: any) => {
    const title = clean(w.display_name || w.title, 240),
      abstract = openAlexAbstract(w.abstract_inverted_index),
      host = clean(
        w.primary_location?.source?.display_name ||
          w.best_oa_location?.source?.display_name ||
          w.type_crossref ||
          "scholarly source",
        180,
      ),
      year = w.publication_year ? ` Published ${w.publication_year}.` : "",
      s = normalizeSource(
        {
          id: clean(w.id, 240),
          title,
          url:
            w.primary_location?.landing_page_url ||
            w.best_oa_location?.landing_page_url ||
            w.doi ||
            w.id ||
            "",
          excerpt:
            abstract ||
            `${title}.${year} Scholarly work indexed by OpenAlex from ${host}.`,
          domain: host,
        },
        "OpenAlex",
      );
    return s ? [s] : [];
  });
}
async function fetchCrossref(q: string) {
  const u = new URL("https://api.crossref.org/works");
  u.search = new URLSearchParams({ query: q, rows: "12" }).toString();
  const r = await withTimeout(fetch(u, { cache: "no-store" }), 4800);
  if (!r.ok) throw new Error();
  const d = await r.json();
  return ((d as any)?.message?.items || []).flatMap((x: any) => {
    const title = clean(x.title?.[0], 240),
      s = normalizeSource(
        {
          title,
          url: x.URL || (x.DOI ? `https://doi.org/${x.DOI}` : ""),
          excerpt:
            clean(x.abstract, 2800) ||
            `${title}. Scholarly work indexed by Crossref${x.publisher ? ` from ${clean(x.publisher, 180)}` : ""}.`,
          domain: clean(x.publisher, 180),
        },
        "Crossref",
      );
    return s ? [s] : [];
  });
}
async function fetchNasa(q: string) {
  const u = new URL("https://images-api.nasa.gov/search");
  u.search = new URLSearchParams({
    q,
    media_type: "image",
    page_size: "12",
  }).toString();
  const r = await withTimeout(fetch(u, { cache: "no-store" }), 4800);
  if (!r.ok) throw new Error();
  const d = await r.json();
  return ((d as any)?.collection?.items || []).flatMap((x: any) => {
    const m = x.data?.[0] || {},
      id = clean(m.nasa_id, 180),
      s = normalizeSource(
        {
          id,
          title: m.title,
          url: id
            ? `https://images.nasa.gov/details/${encodeURIComponent(id)}`
            : clean(x.href, 1200),
          domain: "nasa.gov",
          excerpt: clean(m.description || m.description_508, 2800),
          imageUrl: clean(
            (x.links || []).find((l: any) => l.render === "image")?.href ||
              x.links?.[0]?.href,
            1600,
          ),
        },
        "NASA",
      );
    return s ? [s] : [];
  });
}
async function fetchInternetArchive(q: string) {
  const u = new URL("https://archive.org/advancedsearch.php");
  u.search = new URLSearchParams({
    q,
    "fl[]": "identifier,title,description,creator,date",
    rows: "12",
    page: "1",
    output: "json",
  }).toString();
  const r = await withTimeout(fetch(u, { cache: "no-store" }), 4800);
  if (!r.ok) throw new Error();
  const d = await r.json();
  return ((d as any)?.response?.docs || []).flatMap((x: any) => {
    const id = clean(x.identifier, 260),
      title = clean(Array.isArray(x.title) ? x.title[0] : x.title, 240),
      description = clean(
        Array.isArray(x.description) ? x.description[0] : x.description,
        2600,
      ),
      creator = clean(
        Array.isArray(x.creator) ? x.creator.join(", ") : x.creator,
        260,
      ),
      date = clean(x.date, 80),
      s = normalizeSource(
        {
          id,
          title,
          url: id
            ? `https://archive.org/details/${encodeURIComponent(id)}`
            : "",
          domain: "archive.org",
          excerpt:
            description ||
            `${title}.${creator ? ` Created by ${creator}.` : ""}${date ? ` Date: ${date}.` : ""} Historical or archival record indexed by Internet Archive.`,
          imageUrl: id
            ? `https://archive.org/services/img/${encodeURIComponent(id)}`
            : undefined,
        },
        "Internet Archive",
      );
    return s ? [s] : [];
  });
}
async function fetchDuckDuckGo(q: string) {
  const u = new URL("https://api.duckduckgo.com/");
  u.search = new URLSearchParams({
    q,
    format: "json",
    no_html: "1",
    skip_disambig: "0",
  }).toString();
  const r = await withTimeout(fetch(u, { cache: "no-store" }), 4200);
  if (!r.ok) throw new Error();
  const d = (await r.json()) as any,
    out: Source[] = [];
  const p = normalizeSource(
    {
      title: d.Heading || q,
      url: d.AbstractURL || "",
      excerpt: d.AbstractText || "",
    },
    "DuckDuckGo",
  );
  if (p) out.push(p);
  (d.RelatedTopics || [])
    .flatMap((x: any) => x.Topics || [x])
    .slice(0, 10)
    .forEach((x: any) => {
      const s = normalizeSource(
        {
          title: clean(x.Text).split(" - ")[0],
          url: x.FirstURL || "",
          excerpt: x.Text || "",
        },
        "DuckDuckGo",
      );
      if (s) out.push(s);
    });
  return out;
}
function relevance(s: Source, q: string) {
  const w = tokens(q);
  if (!w.length) return 1;
  const t = tokens(s.title),
    titleText = s.title.toLowerCase(),
    body = s.excerpt.toLowerCase(),
    titleHits = w.filter((x) => t.includes(x) || titleText.includes(x)).length,
    bodyHits = w.filter((x) => body.slice(0, 1500).includes(x)).length;
  if (titleHits === 0) return 0;
  const titleCoverage = titleHits / w.length;
  if (w.length > 1 && titleCoverage < 0.5) return 0;
  let score = titleCoverage * 10 + (bodyHits / w.length) * 2;
  if (titleText.includes(clean(q).toLowerCase())) score += 8;
  if (s.imageUrl) score += 0.4;
  return score;
}
function selectSources(sources: Source[], q: string) {
  const seen = new Set<string>(),
    dc = new Map<string, number>(),
    pc = new Map<string, number>(),
    ranked = sources
      .filter((s) => {
        const k = (s.url || `${s.provider}:${s.title}`).toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((s) => ({ ...s, score: relevance(s, q) }))
      .sort((a, b) => (b.score || 0) - (a.score || 0)),
    chosen: Source[] = [];
  ranked.forEach((s) => {
    if (chosen.length >= 15) return;
    const d = (s.domain || s.provider).toLowerCase(),
      p = s.provider.toLowerCase(),
      dn = dc.get(d) || 0,
      pn = pc.get(p) || 0;
    if (d.includes("wikipedia.org") && pn >= 1) return;
    if (dn >= 2 || pn >= 4) return;
    if ((s.score || 0) <= 0) return;
    chosen.push(s);
    dc.set(d, dn + 1);
    pc.set(p, pn + 1);
  });
  if (chosen.length < 10)
    ranked.forEach((s) => {
      if (
        chosen.length < 12 &&
        (s.score || 0) > 0 &&
        !chosen.some(
          (x) =>
            (x.url || `${x.provider}:${x.title}`) ===
            (s.url || `${s.provider}:${s.title}`),
        )
      )
        chosen.push(s);
    });
  return chosen;
}
async function searchAllSources(q: string) {
  const resolved = resolvedQuery(q),
    searches = [...new Set([q, resolved])].slice(0, 2),
    tasks: Promise<Source[]>[] = [];
  searches.forEach((s) =>
    tasks.push(
      fetchWikipedia(s),
      fetchOpenAlex(s),
      fetchCrossref(s),
      fetchNasa(s),
      fetchInternetArchive(s),
    ),
  );
  tasks.push(fetchDuckDuckGo(q));
  const settled = await Promise.allSettled(tasks),
    merged = settled.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
  return { resolved, sources: selectSources(merged, resolved) };
}
function buildOverview(q: string, sources: Source[]) {
  const lines: string[] = [];
  sources
    .filter((s) => (s.score || 0) > 0)
    .slice(0, 6)
    .forEach((s) => {
      const first = sentence(s.excerpt);
      if (first && !lines.some((x) => x.toLowerCase() === first.toLowerCase()))
        lines.push(first);
    });
  return (
    lines.slice(0, 3).join(" ") ||
    `Infinity Phi opened ${q}, but the public source providers did not return sufficiently relevant evidence on this pass.`
  );
}
function buildRecord(
  q: string,
  resolved: string,
  sources: Source[],
): ResultRecord {
  return {
    query: q,
    resolved,
    title: q,
    overview: buildOverview(q, sources),
    sources,
    created: Date.now(),
  };
}
function saveSharedResearch(r: ResultRecord) {
  try {
    localStorage.setItem(
      INFINITY_RESEARCH,
      JSON.stringify({
        version: "infinity-render-v1",
        query: r.query,
        mode: "search",
        createdAt: new Date(r.created).toISOString(),
        overview: r.overview,
        source: {
          id: "source",
          label: r.query,
          position: { x: 0, y: 0, z: 0 },
          affinity: 1,
        },
        nodes: [],
        sources: r.sources.map((s) => ({
          id: s.id,
          title: s.title,
          url: s.url,
          domain: s.domain,
          provider: s.provider,
          extract: s.excerpt,
          image: s.imageUrl || "",
          storyKey: s.url || s.id,
        })),
        sourceSystem: "Infinity Phi",
        profileSnapshot: {},
      }),
    );
  } catch {}
}
async function shareSource(s: Source, q: string): Promise<ShareResult> {
  const params = new URLSearchParams({
      sharedTitle: s.title,
      sharedBody: s.excerpt.slice(0, 1200),
      sharedUrl: s.url,
      sharedImage: s.imageUrl || "",
      sharedDomain: s.domain || s.provider,
      sharedQuery: q,
    }),
    url = `https://www-infinity4.github.io/News-Phi/?${params.toString()}#story=${encodeURIComponent(s.url || s.id)}`;
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(url);
      return { copied: true, ...awardPhiStarCredit("share", url) };
    } catch {
      return {};
    }
  }
  try {
    await navigator.share({
      title: s.title,
      text: s.excerpt.slice(0, 320),
      url,
    });
    return awardPhiStarCredit("share", url);
  } catch (e: any) {
    return e?.name === "AbortError" ? { cancelled: true } : {};
  }
}
function collectionRecord(s: Source, q: string, tokenId: string) {
  return {
    id: `infinity-card-${s.id || Math.abs(hash(s.url || s.title))}`,
    storyKey: s.url || s.id,
    title: s.title,
    sourceTitle: s.title,
    extract: s.excerpt,
    sourceExtract: s.excerpt,
    url: s.url,
    domain: s.domain || s.provider,
    provider: s.provider,
    image: s.imageUrl || "",
    imageVerified: Boolean(s.imageUrl),
    sourceBacked: Boolean(s.url),
    sourceLocked: true,
    searchQuery: q,
    tokenId,
    collectedAt: new Date().toISOString(),
    collectedFrom: "Infinity Phi",
    mediaKind: s.mediaKind || "image",
    files: s.mediaUrl ? [{ name: s.title, url: s.mediaUrl }] : undefined,
  };
}
function collectSource(s: Source, q: string, tokenId = currentPhiTokenId(q)) {
  const card = collectionRecord(s, q, tokenId),
    key = card.storyKey || card.id;
  appendPhiTokenItems(tokenId, q, [card]);
  awardPhiStarCredit("collect", key);
  let list: any[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(SHARED_COLLECTION) || "[]");
    list = Array.isArray(raw) ? raw : [];
  } catch {}
  const i = list.findIndex((x) => (x?.storyKey || x?.url || x?.id) === key);
  if (i >= 0)
    list[i] = { ...list[i], ...card, collectedAt: new Date().toISOString() };
  else list.unshift(card);
  try {
    localStorage.setItem(SHARED_COLLECTION, JSON.stringify(list.slice(0, 300)));
  } catch {}
  try {
    const items = list.filter(
      (x: any) =>
        clean(x?.searchQuery).toLowerCase() === clean(q).toLowerCase() &&
        (!x?.tokenId || x.tokenId === tokenId),
    );
    localStorage.setItem(
      CURRENT_SEARCH_COLLECTION,
      JSON.stringify({
        query: q,
        tokenId,
        items,
        updatedAt: new Date().toISOString(),
      }),
    );
    window.dispatchEvent(
      new CustomEvent("infinityphi:current-search-collection", {
        detail: { query: q, tokenId, items },
      }),
    );
  } catch {}
  window.dispatchEvent(
    new CustomEvent("controlphi:shared", {
      detail: { source: "infinity-phi", storyKey: key },
    }),
  );
  return true;
}
function similarCardsUrl(s: Source, q: string) {
  const p = new URLSearchParams({
    q: clean(`${q} ${s.title}`, 1000),
    run: "1",
    similar: "1",
  });
  return `${appPath("phi")}?${p.toString()}`;
}
function readQuery() {
  return typeof window === "undefined"
    ? ""
    : clean(new URLSearchParams(location.search).get("q") || "", 1000);
}
function currentPhiTokenId(q: string) {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(location.search),
    requested = params.get("token") || "",
    token = resolvePhiSearchToken(q, requested);
  if (!requested) {
    params.set("token", token.id);
    History.prototype.replaceState.call(
      history,
      history.state,
      "",
      `${location.pathname}?${params.toString()}${location.hash}`,
    );
  }
  return token.id;
}
function imagePicksForQuery(q: string) {
  const key = clean(q).toLowerCase(),
    packets: any[] = [];
  try {
    packets.push(JSON.parse(sessionStorage.getItem(IMAGE_OVERVIEW) || "null"));
  } catch {}
  try {
    packets.push(JSON.parse(localStorage.getItem(IMAGE_OVERVIEW) || "null"));
  } catch {}
  let images: any[] = [];
  const packet = packets.find(
    (value) =>
      clean(value?.query).toLowerCase() === key && Array.isArray(value?.images),
  );
  if (packet) images = packet.images;
  else
    try {
      const saved = JSON.parse(localStorage.getItem(IMAGE_BY_QUERY) || "{}");
      if (Array.isArray(saved?.[key])) images = saved[key];
    } catch {}
  return images.slice(-20).flatMap((x: any, index: number) => {
    const image = clean(x?.image || x?.original, 1600);
    if (!image) return [];
    return [
      {
        id: `infinity-image-${clean(x?.id, 240) || index}`,
        storyKey: `image:${clean(x?.original || x?.image, 1800) || index}`,
        title: clean(x?.title, 240) || `${q} image ${index + 1}`,
        sourceTitle: clean(x?.title, 240) || `${q} image ${index + 1}`,
        extract:
          clean(x?.description, 2800) || `Selected visual evidence for ${q}.`,
        sourceExtract: clean(x?.description, 2800),
        url: clean(x?.sourceUrl || x?.original || x?.image, 1400),
        domain: clean(x?.provider, 180) || "Image source",
        provider: clean(x?.provider, 100) || "Image source",
        image,
        imageUrl: image,
        imageVerified: true,
        sourceBacked: Boolean(x?.sourceUrl || x?.original),
        sourceLocked: true,
        searchQuery: q,
        collectedFrom: "Infinity Phi image search",
        mediaKind: "image",
        kind: "image-seed",
        selectedFromImageSearch: true,
      },
    ];
  });
}
function collectedForQuery(q: string, tokenId = currentPhiTokenId(q)) {
  const tokenItems = tokenId ? phiTokenItems(tokenId) : [];
  const key = clean(q).toLowerCase(),
    picks = imagePicksForQuery(q),
    current: any[] = [];
  try {
    const packet = JSON.parse(
      localStorage.getItem(CURRENT_SEARCH_COLLECTION) || "null",
    );
    if (
      packet &&
      clean(packet.query).toLowerCase() === key &&
      Array.isArray(packet.items)
    )
      current.push(...packet.items);
  } catch {}
  try {
    const all = JSON.parse(localStorage.getItem(SHARED_COLLECTION) || "[]");
    if (Array.isArray(all))
      current.push(
        ...all.filter((x: any) => clean(x?.searchQuery).toLowerCase() === key),
      );
  } catch {}
  const seen = new Set<string>();
  return [...picks, ...tokenItems, ...current].filter((x: any) => {
    const isImage =
        x?.selectedFromImageSearch ||
        x?.kind === "image-seed" ||
        x?.collectedFrom === "Infinity Phi image search",
      id = isImage
        ? `image:${clean(x?.image || x?.imageUrl || x?.id, 1800).toLowerCase()}`
        : `item:${clean(x?.storyKey || x?.url || x?.id, 1800).toLowerCase()}`;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
function selectedImageSource(
  item: any,
  index: number,
  q: string,
): Source | null {
  const selected =
      item?.selectedFromImageSearch ||
      item?.kind === "image-seed" ||
      item?.collectedFrom === "Infinity Phi image search",
    imageUrl = clean(item?.image || item?.imageUrl, 1600);
  if (!selected || !imageUrl) return null;
  const title =
      clean(item?.title || item?.sourceTitle, 240) || `${q} image ${index + 1}`,
    excerpt =
      clean(item?.sourceExtract || item?.extract || item?.description, 2800) ||
      `Selected visual evidence for ${q}.`;
  return {
    id: clean(item?.id, 240) || `selected-image-${index}`,
    title,
    url: clean(item?.sourceUrl || item?.url, 1400),
    domain: clean(item?.domain || item?.provider, 180) || "Image source",
    excerpt,
    provider: clean(item?.provider, 100) || "Image source",
    imageUrl,
    score: 100,
  };
}
function selectedMediaSources(item: any, index: number): Source[] {
  const mediaKind = String(item?.mediaKind || "").toLowerCase();
  if (mediaKind !== "audio" && mediaKind !== "video") return [];
  const files = Array.isArray(item?.files) ? item.files : [],
    baseTitle =
      clean(item?.title || item?.sourceTitle, 240) || `Collected ${mediaKind}`;
  return files.flatMap((file: any, fileIndex: number) => {
    const mediaUrl = clean(file?.url, 1800);
    if (!mediaUrl) return [];
    return [
      {
        id: `${clean(item?.id, 180)}-media-${fileIndex}`,
        title:
          files.length > 1
            ? clean(file?.name, 240) || `${baseTitle} ${fileIndex + 1}`
            : baseTitle,
        url: clean(item?.url, 1400),
        domain: clean(item?.domain || item?.provider, 180) || "archive.org",
        excerpt:
          clean(item?.extract || item?.sourceExtract, 2800) ||
          `${baseTitle} is a collected ${mediaKind} result.`,
        provider: clean(item?.provider, 100) || "Internet Archive",
        imageUrl: clean(item?.image || item?.imageUrl, 1600) || undefined,
        score: 100,
        mediaKind,
        mediaUrl,
      },
    ];
  });
}
function productOverview(q: string, base: string, items: any[]) {
  if (!items.length) return base;
  const counts = { image: 0, video: 0, audio: 0, card: 0 };
  items.forEach((x) => {
    const k = String(x?.mediaKind || x?.kind || "card").toLowerCase();
    if (k.includes("video")) counts.video++;
    else if (k.includes("audio")) counts.audio++;
    else if (k.includes("image") || x?.image || x?.imageUrl) counts.image++;
    else counts.card++;
  });
  const parts = [
    counts.image && `${counts.image} image${counts.image === 1 ? "" : "s"}`,
    counts.video && `${counts.video} video${counts.video === 1 ? "" : "s"}`,
    counts.audio &&
      `${counts.audio} audio clip${counts.audio === 1 ? "" : "s"}`,
    counts.card && `${counts.card} source card${counts.card === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `${base} Current website material adds ${parts.join(", ")} selected for this search.`;
}
function productDirections(q: string, items: any[]) {
  if (!items.length) return [];
  const out = [
    `Lead with a clear ${q} introduction using the common overview and the three starting source cards.`,
  ];
  if (items.some((x) => x?.image || x?.imageUrl))
    out.push(
      "Use the collected images as the visual story, gallery, or section artwork.",
    );
  if (items.some((x) => String(x?.mediaKind).toLowerCase() === "video"))
    out.push(
      "Add the collected video as a watch/highlight section tied to the surrounding source material.",
    );
  if (items.some((x) => String(x?.mediaKind).toLowerCase() === "audio"))
    out.push(
      "Add the collected audio as a listen/archive section with source credit.",
    );
  out.push(
    "Keep every collected item tied to its original source and use the combined material to shape the final website product.",
  );
  return out;
}
export default function PhiPage2() {
  const [query, setQuery] = useState(""),
    [input, setInput] = useState(""),
    [record, setRecord] = useState<ResultRecord | null>(null),
    [collected, setCollected] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [shareStatus, setShareStatus] = useState<Record<string, string>>({}),
    [collectStatus, setCollectStatus] = useState<Record<string, string>>({});
  const requestRef = useRef(0),
    history = useMemo(
      () => secureLoad<HistoryItem[]>(HISTORY, []),
      [record?.created],
    );
  async function run(next: string, write = false) {
    const q = clean(next, 1000);
    if (!q) return;
    const id = ++requestRef.current,
      freshToken = write ? beginPhiSearchToken(q) : null,
      tokenId = freshToken?.id || currentPhiTokenId(q);
    setQuery(q);
    setInput(q);
    const selected = collectedForQuery(q, tokenId);
    setCollected(selected);
    setBusy(true);
    setNotice("");
    setRecord({
      query: q,
      resolved: resolvedQuery(q),
      title: q,
      overview: `Searching the public source field for ${q}…`,
      sources: [],
      created: Date.now(),
    });
    if (write) {
      const t = new URL(location.href);
      t.pathname = appPath("phi");
      t.search = "";
      t.searchParams.set("q", q);
      t.searchParams.set("run", "1");
      t.searchParams.set("token", tokenId);
      History.prototype.pushState.call(
        history,
        { infinityPhiSearch: q },
        "",
        t.toString(),
      );
    }
    try {
      const result = await searchAllSources(q);
      if (id !== requestRef.current) return;
      const nextRecord = buildRecord(q, result.resolved, result.sources);
      if (selected.length)
        nextRecord.overview = await writeCollectedOverviewWithGpt(
          q,
          selected,
          productOverview(q, nextRecord.overview, selected),
        );
      setRecord(nextRecord);
      setBusy(false);
      if (!nextRecord.sources.length)
        setNotice(
          "The renderer stayed active, but no provider returned usable public evidence on this pass.",
        );
      secureSave(
        HISTORY,
        [
          ...secureLoad<HistoryItem[]>(HISTORY, []),
          {
            query: q,
            resolved: result.resolved,
            kind: result.resolved === q ? "general" : "element",
            at: Date.now(),
          },
        ].slice(-80),
      );
      saveSharedResearch(nextRecord);
      window.dispatchEvent(new Event("infinity-history-updated"));
    } catch {
      if (id !== requestRef.current) return;
      setBusy(false);
      setNotice(
        "The public providers did not finish, but the result renderer stayed live. Retry this search without leaving the page.",
      );
    }
  }
  useEffect(() => {
    const q = readQuery();
    if (q) {
      setCollected(collectedForQuery(q));
      void run(q);
    }
    const refresh = () => {
      const now = readQuery() || query;
      if (now) setCollected(collectedForQuery(now));
    };
    window.addEventListener(
      "infinityphi:current-search-collection",
      refresh as EventListener,
    );
    window.addEventListener("controlphi:shared", refresh as EventListener);
    return () => {
      requestRef.current++;
      window.removeEventListener(
        "infinityphi:current-search-collection",
        refresh as EventListener,
      );
      window.removeEventListener("controlphi:shared", refresh as EventListener);
    };
  }, []);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void run(input, true);
  }
  function openImages() {
    const q = clean(input || query, 1000);
    if (!q) return;
    const token = currentPhiTokenId(query || q);
    location.assign(
      `${appPath("phi/images")}?q=${encodeURIComponent(q)}&token=${encodeURIComponent(token)}`,
    );
  }
  const activeTokenId = query ? currentPhiTokenId(query) : "",
    sources = record?.sources || [],
    selectedImages = collected.flatMap((item, index) => {
      const source = selectedImageSource(item, index, query);
      return source ? [source] : [];
    }),
    selectedMedia = collected.flatMap((item, index) =>
      selectedMediaSources(item, index),
    ),
    selectedKeys = new Set(
      [...selectedImages, ...selectedMedia].map((s) =>
        (s.url || s.id).toLowerCase(),
      ),
    ),
    orange = [
      ...selectedImages,
      ...selectedMedia,
      ...sources.filter(
        (s) => !selectedKeys.has((s.url || s.id).toLowerCase()),
      ),
    ].slice(0, Math.max(10, selectedImages.length + selectedMedia.length)),
    green = sources.slice(0, 15),
    hero =
      selectedImages[0] ||
      selectedMedia.find((s) => s.imageUrl) ||
      sources.find((s) => s.imageUrl) ||
      sources[0];
  if (!query && !record) return null;
  return (
    <main className="mx-auto w-full max-w-6xl px-3 pb-24 pt-20 sm:px-5">
      <section className="mb-5 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-xl sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <a
            href={appPath("phi")}
            className="rounded-full bg-violet-700 px-3 py-2 text-xs font-black text-white"
          >
            Search φ
          </a>
          <button
            type="button"
            onClick={openImages}
            className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-900"
          >
            <ImageIcon size={14} />
            Images φ
          </button>
          <a
            href={`${appPath("phi/video")}?q=${encodeURIComponent(query)}&token=${encodeURIComponent(activeTokenId)}`}
            className="rounded-full border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-black text-orange-900"
          >
            Video
          </a>
          <a
            href={`${appPath("phi/sound")}?q=${encodeURIComponent(query)}&token=${encodeURIComponent(activeTokenId)}`}
            className="rounded-full border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-black text-orange-900"
          >
            Sound
          </a>
          <a
            href={`${appPath("phi/code")}?q=${encodeURIComponent(query)}`}
            className="rounded-full border border-violet-300 bg-white px-3 py-2 text-xs font-black text-violet-800"
          >
            Code φ
          </a>
          <a
            href={`${appPath("phi/create")}?q=${encodeURIComponent(query)}`}
            className="rounded-full border border-violet-300 bg-white px-3 py-2 text-xs font-black text-violet-800"
          >
            Create φ
          </a>
          <span className="ml-auto text-xs font-bold text-slate-500">
            Infinity Phi · result engine
          </span>
        </div>
        <form
          onSubmit={submit}
          className="flex items-center gap-2 rounded-2xl border-2 border-violet-300 bg-slate-50 p-2"
        >
          <Search size={20} className="text-violet-700" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-1 py-2 font-semibold text-black placeholder:text-slate-500 outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="grid h-11 w-11 place-items-center rounded-full bg-violet-700 font-black text-white"
          >
            {busy ? <Sparkles size={18} /> : "φ"}
          </button>
        </form>
        {notice && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold">
            {notice}
          </p>
        )}
      </section>
      {record && (
        <article className="space-y-7">
          <section className="overflow-hidden rounded-[30px] border bg-white shadow-xl">
            {hero?.imageUrl && (
              <img
                src={hero.imageUrl}
                alt={hero.title}
                className="h-56 w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
            )}
            <div className="p-5 text-slate-950 sm:p-7">
              <div className="text-xs font-black uppercase text-violet-700">
                AI overview
              </div>
              <h1 className="mt-2 text-3xl font-black text-slate-950">
                {record.title}
              </h1>
              <p className="phi-editorial-deck mt-4 font-medium leading-7 text-slate-800">
                {productOverview(query, record.overview, collected)}
              </p>
              {productDirections(query, collected).length > 0 && (
                <ul className="mt-4 list-disc space-y-2 pl-6 font-semibold text-slate-900">
                  {productDirections(query, collected).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          {collected.length > 0 && (
            <section className="rounded-[30px] border-2 border-cyan-300 bg-cyan-50 p-5">
              <h2 className="text-2xl font-black text-slate-950">
                Collected for this website
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                These are your selected images, video, audio and source cards
                for this search. They stay separate from the orange
                search-result feed.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {collected.map((x: any, i) => (
                  <article
                    key={x.storyKey || x.id || i}
                    className="rounded-2xl bg-white p-4 shadow"
                  >
                    <b className="text-slate-950">
                      {clean(x.title || x.sourceTitle) || "Collected item"}
                    </b>
                    <small className="mt-1 block font-bold text-cyan-800">
                      {clean(x.mediaKind || x.kind || "source")}
                    </small>
                    {(x.image || x.imageUrl) && (
                      <img
                        src={x.image || x.imageUrl}
                        alt={clean(x.title)}
                        className="mt-3 h-36 w-full rounded-xl object-cover"
                      />
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-2xl font-black text-slate-950">
              Orange cards
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {orange.map((s, i) => (
                <article
                  key={s.id || i}
                  data-phi-media-kind={s.mediaKind || "image"}
                  className="phi-orange-card overflow-hidden rounded-[26px] border-2 border-orange-400 bg-gradient-to-br from-orange-500 to-red-700 text-white shadow-lg"
                >
                  {s.mediaKind === "video" && s.mediaUrl ? (
                    <video
                      controls
                      preload="metadata"
                      poster={s.imageUrl}
                      src={s.mediaUrl}
                      className="aspect-video w-full bg-black"
                    />
                  ) : (
                    s.imageUrl && (
                      <img
                        src={s.imageUrl}
                        alt={s.title}
                        className="h-44 w-full object-cover"
                      />
                    )
                  )}
                  <div className="p-5">
                    {s.mediaKind === "audio" && s.mediaUrl && (
                      <audio
                        controls
                        preload="none"
                        src={s.mediaUrl}
                        className="mb-4 w-full"
                      />
                    )}
                    <h3 className="mt-2 text-xl font-black text-white">
                      {s.title}
                    </h3>
                    <p className="mt-3 font-medium leading-6 text-white">
                      {s.excerpt.slice(0, 520)}
                      {s.excerpt.length > 520 ? "…" : ""}
                    </p>
                    <div className="phi-orange-actions mt-4 flex flex-wrap gap-2">
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener"
                          className="rounded-full bg-black/25 px-3 py-2 text-xs font-black"
                        >
                          Read source{" "}
                          <ExternalLink size={13} className="inline" />
                        </a>
                      )}
                      <button
                        type="button"
                        className="rounded-full bg-emerald-900 px-3 py-2 text-xs font-black text-white"
                        onClick={() => {
                          collectSource(s, query);
                          setCollectStatus((x) => ({
                            ...x,
                            [s.id]: "✓ Collected",
                          }));
                        }}
                      >
                        {collectStatus[s.id] || "Collect"}
                      </button>
                      <a
                        href={`${appPath("phi/build")}?${new URLSearchParams({ q: query, focus: s.title })}`}
                        className="rounded-full bg-yellow-300 px-3 py-2 text-xs font-black text-red-950"
                      >
                        Build this story
                      </a>
                      <a
                        href={similarCardsUrl(s, query)}
                        className="rounded-full bg-violet-900 px-3 py-2 text-xs font-black text-white"
                      >
                        Build similar cards
                      </a>
                      <button
                        type="button"
                        className="phi-share-card rounded-full border px-3 py-2 text-xs font-black"
                        onClick={async () => {
                          const r = await shareSource(s, query);
                          setShareStatus((x) => ({
                            ...x,
                            [s.id]: r.awarded
                              ? "Shared · 1 StarCoin!"
                              : r.progressToNextCoin != null
                                ? `Shared · ${r.progressToNextCoin}/10 ⭐`
                                : r.copied
                                  ? "Link copied"
                                  : "Share card · +1/10 ⭐",
                          }));
                        }}
                      >
                        <Share2 size={13} className="inline" />{" "}
                        {shareStatus[s.id] || "Share card · +1/10 ⭐"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-[30px] bg-emerald-950 p-5 text-white">
            <h2 className="text-2xl font-black">Green sources</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {green.map((s, i) => (
                <a
                  key={`g-${s.id}-${i}`}
                  href={s.url || "#"}
                  target={s.url ? "_blank" : undefined}
                  className="phi-green-card rounded-2xl bg-white/10 p-4"
                >
                  <small className="text-emerald-300">
                    {s.provider} · {s.domain}
                  </small>
                  <b className="mt-2 block">{s.title}</b>
                  <p className="mt-2 text-sm">
                    {s.excerpt.slice(0, 260)}
                    {s.excerpt.length > 260 ? "…" : ""}
                  </p>
                </a>
              ))}
            </div>
          </section>
          {history.length > 0 && (
            <section className="rounded-2xl border bg-white p-4 text-sm">
              <b>Infinity history is still connected.</b>
            </section>
          )}
          <section className="flex flex-wrap justify-center gap-3 py-6 text-center">
            <a
              href={`${appPath("phi/build")}?${new URLSearchParams({ q: query, mode: "website" })}`}
              className="inline-block rounded-2xl bg-emerald-600 px-8 py-4 text-lg font-black text-white shadow-lg"
            >
              Generate Website →
            </a>
            <a
              href={`https://www-infinity4.github.io/Web-Phi/?${new URLSearchParams({
                q: query,
                token: activeTokenId,
              })}`}
              className="inline-block rounded-2xl bg-violet-700 px-8 py-4 text-lg font-black text-white shadow-lg"
            >
              Website directions in Web Phi →
            </a>
          </section>
        </article>
      )}
    </main>
  );
}
