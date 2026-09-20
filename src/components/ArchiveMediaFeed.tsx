"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { appPath } from "@/lib/base-path";
import { writeMediaCardWithGpt } from "@/lib/phi-gpt-router";
import {
  appendPhiTokenItems,
  phiTokenItems,
  resolvePhiSearchToken,
} from "@/lib/phi-search-token";

type MediaFile = { name: string; url: string };
type Item = {
  id: string;
  title: string;
  description: string;
  source: string;
  image: string;
  file: MediaFile;
  match: "exact" | "all words" | "related";
};
const clean = (v: any, max = 3200) =>
  String(Array.isArray(v) ? v[0] : v || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const words = (v: string): string[] =>
  (clean(v)
    .toLowerCase()
    .match(/[a-z0-9]+/g) || []) as string[];
const MEDIA_QUALIFIERS = new Set([
  "audio",
  "episode",
  "film",
  "full",
  "movie",
  "movies",
  "music",
  "playable",
  "show",
  "song",
  "sound",
  "stream",
  "video",
  "watch",
]);
const subjectWords = (v: string) => {
  const meaningful = words(v).filter((word) => !MEDIA_QUALIFIERS.has(word));
  return (meaningful.length ? meaningful : words(v)).slice(0, 10);
};
const SHARED = "phiShared:collection:v1",
  SESSION = "infinityPhi:mediaCollectedSession:v1",
  CURRENT = "infinityPhi:currentSearchCollection:v1",
  LEGACY_MEDIA = "infinityPhi:selectedMedia:v1",
  OVERVIEW = "infinityPhi:mediaOverview:v1",
  SEARCH_HISTORY = "infinityPhi:mediaSearchHistory:v1";
const PORNOGRAPHY =
  /\b(porn(?:ography|ographic)?|xxx|hardcore sex|adult sex video|sex tape|explicit sexual|hentai|rule 34|fetish porn|erotic sex film)\b/i;
const timedFetch = (
  input: RequestInfo | URL,
  init: RequestInit = {},
  milliseconds = 15000,
) => fetch(input, { ...init, signal: AbortSignal.timeout(milliseconds) });

function pornographic(...values: any[]) {
  return PORNOGRAPHY.test(values.map((value) => clean(value, 5000)).join(" "));
}
function mediaStem(value: string) {
  return clean(value, 800)
    .toLowerCase()
    .replace(/\.(mp3|ogg|oga|flac|m4a|mp4|ogv|webm|m4v)$/i, "")
    .replace(
      /(?:[_ .-](?:vbr|64kb|128kb|160kb|256kb|512kb|h264|mpeg4|derivative))+$/i,
      "",
    )
    .replace(/[^a-z0-9]+/g, "-");
}
function bestPlayableFiles(files: any[], kind: "audio" | "video") {
  const playable =
      kind === "audio"
        ? /\.(mp3|ogg|oga|flac|m4a)$/i
        : /\.(mp4|webm|ogv|m4v)$/i,
    priority = (name: string) =>
      kind === "audio"
        ? /\.mp3$/i.test(name)
          ? 0
          : /\.m4a$/i.test(name)
            ? 1
            : /\.ogg$/i.test(name)
              ? 2
              : 3
        : /\.mp4$/i.test(name)
          ? 0
          : /\.webm$/i.test(name)
            ? 1
            : 2,
    seen = new Set<string>();
  return files
    .filter(
      (file) =>
        playable.test(file?.name || "") &&
        !/sample|thumb|trailer|preview|spectrogram|waveform/i.test(
          file?.name || "",
        ) &&
        !pornographic(file?.name, file?.title) &&
        String(file?.private || "") !== "true",
    )
    .sort((a, b) => priority(a.name || "") - priority(b.name || ""))
    .filter((file) => {
      const key = mediaStem(file?.name || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}
async function mediaLookup(item: Item) {
  if (clean(item.description).length >= 180) return "";
  try {
    const subject = clean(
        `${item.title} ${mediaStem(item.file.name).replace(/-/g, " ")}`,
        500,
      ),
      url = new URL("https://en.wikipedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: subject,
      gsrlimit: "3",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      format: "json",
      origin: "*",
    }).toString();
    const response = await timedFetch(url, { cache: "no-store" }, 5000);
    if (!response.ok) return "";
    const data = await response.json(),
      page = Object.values(data?.query?.pages || {})[0] as any;
    return clean(page?.extract, 1200);
  } catch {
    return "";
  }
}
function archiveQuery(
  kind: "audio" | "video",
  term: string,
  tier: "exact" | "all words" | "related",
) {
  const media = kind === "audio" ? "audio" : "movies",
    safeWords = subjectWords(term),
    phrase = safeWords.join(" ").replace(/["\\]/g, " "),
    fieldMatch = (word: string) =>
      `(title:${word} OR subject:${word} OR description:${word} OR creator:${word})`;
  if (tier === "exact")
    return `mediatype:${media} AND (title:"${phrase}" OR subject:"${phrase}" OR description:"${phrase}")`;
  if (tier === "all words")
    return `mediatype:${media} AND (${safeWords.map(fieldMatch).join(" AND ")})`;
  const pairs =
    safeWords.length > 1
      ? safeWords.flatMap((a, i) =>
          safeWords
            .slice(i + 1)
            .map((b) => `(${fieldMatch(a)} AND ${fieldMatch(b)})`),
        )
      : safeWords.map(fieldMatch);
  return `mediatype:${media} AND (${pairs.join(" OR ")})`;
}
async function archiveDocs(
  kind: "audio" | "video",
  term: string,
  tier: "exact" | "all words" | "related",
  page = 1,
) {
  const u = new URL("https://archive.org/advancedsearch.php");
  u.search = new URLSearchParams({
    q: archiveQuery(kind, term, tier),
    "fl[]":
      "identifier,title,description,creator,date,downloads,subject,collection",
    rows: tier === "related" ? "100" : "80",
    page: String(Math.max(1, page)),
    sort: "downloads desc",
    output: "json",
  }).toString();
  try {
    const r = await timedFetch(u, { cache: "no-store" }, 18000);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.response?.docs || [])
      .filter(
        (x: any) =>
          !pornographic(
            x.identifier,
            x.title,
            x.description,
            x.subject,
            x.collection,
          ),
      )
      .map((x: any) => ({ ...x, _tier: tier }));
  } catch {
    return [];
  }
}
function relevance(doc: any, term: string) {
  const requested = subjectWords(term),
    title = clean(doc.title).toLowerCase(),
    description = clean(doc.description).toLowerCase(),
    creator = clean(doc.creator).toLowerCase(),
    hay = `${title} ${description} ${creator}`;
  const hits = requested.filter((word) => hay.includes(word)).length,
    titleHits = requested.filter((word) => title.includes(word)).length,
    phrase = requested.join(" ");
  let score =
    doc._tier === "exact" ? 300 : doc._tier === "all words" ? 200 : 100;
  if (title === phrase) score += 120;
  if (title.includes(phrase)) score += 80;
  if (description.includes(phrase)) score += 45;
  score += titleHits * 180;
  score += hits * 18;
  if (requested.length && hits === requested.length) score += 90;
  return score;
}
function titleMatchesSubject(doc: any, term: string) {
  const title = clean(doc?.title, 1000).toLowerCase();
  return subjectWords(term).some((word) => title.includes(word));
}
function matchesBlendedSearch(doc: any, current: string, previous: string) {
  if (!titleMatchesSubject(doc, current)) return false;
  const metadata = clean(
    [doc?.title, doc?.description, doc?.creator, doc?.subject, doc?.collection].join(
      " ",
    ),
    8000,
  ).toLowerCase();
  return subjectWords(previous).some((word) => metadata.includes(word));
}
function starShare(reference: string) {
  try {
    const read = (k: string, f: any) => {
        try {
          return JSON.parse(localStorage.getItem(k) || "null") || f;
        } catch {
          return f;
        }
      },
      session = read("starquest_session", null),
      users = read("starquest_users", {}),
      signed = session?.key && users[session.key],
      w: any =
        signed ||
        read("starquest_guest_profile_v1", {
          tokens: 0,
          shareCount: 0,
          pendingShareCredits: 0,
          shareEvents: [],
          ledger: [],
        });
    w.tokens = Math.max(0, Number(w.tokens) || 0);
    w.shareCount = Math.max(0, Number(w.shareCount) || 0) + 1;
    w.pendingShareCredits = Math.max(0, Number(w.pendingShareCredits) || 0) + 1;
    w.shareEvents = Array.isArray(w.shareEvents) ? w.shareEvents : [];
    w.ledger = Array.isArray(w.ledger) ? w.ledger : [];
    const id = "phi-media-" + Date.now().toString(36);
    w.shareEvents.push({
      id,
      reference,
      method: "web_share_api",
      confirmed: true,
      createdAt: Date.now(),
    });
    let awarded = 0;
    while (w.pendingShareCredits >= 10) {
      w.pendingShareCredits -= 10;
      w.tokens++;
      awarded++;
    }
    w.ledger.push({
      id: "tx-" + id,
      type: awarded ? "share_reward" : "share_credit",
      amount: awarded,
      balance: w.tokens,
      pendingShareCredits: w.pendingShareCredits,
      referenceId: id,
      createdAt: Date.now(),
    });
    if (signed) {
      users[session.key] = w;
      localStorage.setItem("starquest_users", JSON.stringify(users));
    } else
      localStorage.setItem("starquest_guest_profile_v1", JSON.stringify(w));
    window.dispatchEvent(new Event("infinity-wallet-updated"));
    return awarded
      ? "Shared · 1 StarCoin!"
      : `Shared · ${w.pendingShareCredits}/10 ⭐`;
  } catch {
    return "Shared ✓";
  }
}

export default function ArchiveMediaFeed({
  kind,
}: {
  kind: "audio" | "video";
}) {
  const [q, setQ] = useState(""),
    [tokenId, setTokenId] = useState(""),
    [tokenLabel, setTokenLabel] = useState("Token A"),
    [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [collected, setCollected] = useState<Record<string, boolean>>({}),
    [collecting, setCollecting] = useState<Record<string, boolean>>({}),
    [shared, setShared] = useState<Record<string, string>>({}),
    [collectedCount, setCollectedCount] = useState(0),
    [notice, setNotice] = useState("");
  const pageRef = useRef(1),
    itemsRef = useRef<Item[]>([]),
    fallbackRef = useRef(0);
  function recentSearches(current: string) {
    try {
      const value = JSON.parse(localStorage.getItem(SEARCH_HISTORY) || "[]");
      return (Array.isArray(value) ? value : [])
        .map((term) => clean(term, 500))
        .filter(
          (term, index, all) =>
            term &&
            term.toLowerCase() !== clean(current).toLowerCase() &&
            all.findIndex(
              (other) => other.toLowerCase() === term.toLowerCase(),
            ) === index,
        )
        .slice(0, 12);
    } catch {
      return [];
    }
  }
  function rememberSearch(term: string) {
    try {
      const history = recentSearches(term);
      localStorage.setItem(
        SEARCH_HISTORY,
        JSON.stringify([term, ...history].slice(0, 12)),
      );
    } catch {}
  }
  async function run(term: string, append = false) {
    const exact = clean(term);
    if (!exact) return;
    if (!append) {
      pageRef.current = 1;
      fallbackRef.current = 0;
      itemsRef.current = [];
      rememberSearch(exact);
      try {
        localStorage.removeItem(LEGACY_MEDIA);
        localStorage.setItem(
          SESSION,
          JSON.stringify({ query: exact, kind, ids: [] }),
        );
      } catch {}
    }
    setBusy(true);
    setNotice("");
    try {
      const requestedPage = append ? pageRef.current + 1 : 1;
      const tiers: ["exact" | "all words" | "related", any[]][] = (
        await Promise.all([
          archiveDocs(kind, exact, "exact", requestedPage),
          archiveDocs(kind, exact, "all words", requestedPage),
          archiveDocs(kind, exact, "related", requestedPage),
        ])
      ).map((docs, index) => [
        ["exact", "all words", "related"][index] as
          "exact" | "all words" | "related",
        docs,
      ]);
      const seenDocs = new Set<string>(),
        ranked = tiers
          .flatMap(([, docs]) => docs)
          .filter((doc: any) => {
            const id = clean(doc.identifier);
            if (!id || seenDocs.has(id) || !titleMatchesSubject(doc, exact))
              return false;
            seenDocs.add(id);
            return true;
          })
          .sort(
            (a: any, b: any) =>
              relevance(b, exact) - relevance(a, exact) ||
              Number(b.downloads || 0) - Number(a.downloads || 0),
          )
          .slice(0, 80);
      let groups = (
        await Promise.all(
          ranked.map(async (doc: any) => {
            const id = clean(doc.identifier);
            try {
              const response = await timedFetch(
                `https://archive.org/metadata/${encodeURIComponent(id)}`,
                { cache: "no-store" },
                12000,
              );
              if (!response.ok) return [];
              const metadata = await response.json(),
                meta = metadata?.metadata || {};
              if (
                pornographic(
                  meta.title,
                  meta.description,
                  meta.subject,
                  meta.collection,
                  meta.identifier,
                )
              )
                return [];
              return bestPlayableFiles(metadata.files || [], kind).map(
                (file: any, index: number) => {
                  const name =
                      clean(file.title || file.name, 300) ||
                      `Track ${index + 1}`,
                    parent = clean(doc.title || meta.title, 300) || id;
                  return {
                    id: `${id}:${clean(file.name, 500)}`,
                    title: name === clean(file.name, 300) ? parent : name,
                    description: clean(
                      doc.description || meta.description,
                      2600,
                    ),
                    source: `https://archive.org/details/${encodeURIComponent(id)}`,
                    image: `https://archive.org/services/img/${encodeURIComponent(id)}`,
                    file: {
                      name,
                      url: `https://archive.org/download/${encodeURIComponent(id)}/${String(file.name).split("/").map(encodeURIComponent).join("/")}`,
                    },
                    match: doc._tier as Item["match"],
                  };
                },
              );
            } catch {
              return [];
            }
          }),
        )
      )
        .flat()
        .slice(0, 30) as Item[];
      groups = groups.filter(
        (item) => !itemsRef.current.some((old) => old.id === item.id),
      );
      let fallbackTerm = "",
        previousTerm = "";
      if (append && !groups.length) {
        const history = recentSearches(exact);
        previousTerm =
          history[fallbackRef.current % Math.max(1, history.length)] || "";
        fallbackTerm = previousTerm ? clean(`${exact} ${previousTerm}`, 900) : "";
        if (fallbackTerm) {
          fallbackRef.current += 1;
          const fallbackDocs = await archiveDocs(
            kind,
            fallbackTerm,
            "related",
            1,
          );
          const fallbackRanked = fallbackDocs
            .filter(
              (doc: any) =>
                clean(doc.identifier) &&
                matchesBlendedSearch(doc, exact, previousTerm),
            )
            .sort(
              (a: any, b: any) =>
                relevance(b, fallbackTerm) - relevance(a, fallbackTerm),
            )
            .slice(0, 80);
          groups = (
            await Promise.all(
              fallbackRanked.map(async (doc: any) => {
                const id = clean(doc.identifier);
                try {
                  const response = await timedFetch(
                    `https://archive.org/metadata/${encodeURIComponent(id)}`,
                    { cache: "no-store" },
                    12000,
                  );
                  if (!response.ok) return [];
                  const metadata = await response.json(),
                    meta = metadata?.metadata || {};
                  if (
                    pornographic(
                      meta.title,
                      meta.description,
                      meta.subject,
                      meta.collection,
                      meta.identifier,
                    )
                  )
                    return [];
                  return bestPlayableFiles(metadata.files || [], kind).map(
                    (file: any, index: number) => ({
                      id: `${id}:${clean(file.name, 500)}`,
                      title:
                        clean(file.title || doc.title || meta.title, 300) ||
                        `Track ${index + 1}`,
                      description: clean(
                        doc.description || meta.description,
                        2600,
                      ),
                      source: `https://archive.org/details/${encodeURIComponent(id)}`,
                      image: `https://archive.org/services/img/${encodeURIComponent(id)}`,
                      file: {
                        name: clean(file.title || file.name, 300),
                        url: `https://archive.org/download/${encodeURIComponent(id)}/${String(file.name).split("/").map(encodeURIComponent).join("/")}`,
                      },
                      match: "related" as const,
                    }),
                  );
                } catch {
                  return [];
                }
              }),
            )
          )
            .flat()
            .filter(
              (item) => !itemsRef.current.some((old) => old.id === item.id),
            )
            .slice(0, 30);
        }
      }
      pageRef.current = requestedPage;
      itemsRef.current = append ? [...itemsRef.current, ...groups] : groups;
      setItems(itemsRef.current);
      if (fallbackTerm && groups.length)
        setNotice(
          `The complete “${exact}” results were exhausted, so Add more blended it with your recent “${previousTerm}” search to find new playable ${kind}.`,
        );
      else if (!groups.length)
        setNotice(
          `No additional playable ${kind} was returned yet. Tap Add more to keep searching the Archive and your recent searches.`,
        );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      term = params.get("q") || "",
      token = resolvePhiSearchToken(term, params.get("token") || ""),
      existing = phiTokenItems(token.id).filter(
        (item: any) => String(item?.mediaKind || "").toLowerCase() === kind,
      ),
      existingIds = existing.map((item: any) =>
        clean(item?.id).replace(new RegExp(`^archive-${kind}-`), ""),
      );
    setQ(term);
    setTokenId(token.id);
    setTokenLabel(token.label);
    setCollected(Object.fromEntries(existingIds.map((id) => [id, true])));
    setCollectedCount(existing.length);
    try {
      localStorage.removeItem(LEGACY_MEDIA);
      localStorage.setItem(
        SESSION,
        JSON.stringify({
          query: term,
          kind,
          tokenId: token.id,
          ids: existingIds,
          items: token.items,
        }),
      );
    } catch {}
    if (term) void run(term);
  }, []);
  function backToOverview() {
    try {
      localStorage.setItem(
        OVERVIEW,
        JSON.stringify({ query: q, tokenId, returnFrom: kind, at: Date.now() }),
      );
    } catch {}
    location.assign(
      `${appPath("phi")}?q=${encodeURIComponent(q)}&run=1&collected=1&token=${encodeURIComponent(tokenId)}`,
    );
  }
  function record(item: Item, writeup: string) {
    return {
      id: `archive-${kind}-${item.id}`,
      storyKey: `${item.source}#file=${encodeURIComponent(item.file.name)}`,
      title: item.title,
      sourceTitle: item.title,
      extract: writeup,
      sourceExtract: item.description,
      url: item.source,
      domain: "archive.org",
      provider: "Internet Archive",
      image: item.image,
      imageVerified: true,
      sourceBacked: true,
      sourceLocked: true,
      searchQuery: q,
      tokenId,
      collectedAt: new Date().toISOString(),
      collectedFrom: "Infinity Phi",
      mediaKind: kind,
      files: [item.file],
    };
  }
  async function collect(item: Item) {
    setCollecting((value) => ({ ...value, [item.id]: true }));
    const lookup = await mediaLookup(item),
      writeup = await writeMediaCardWithGpt({
        query: q,
        kind,
        title: item.title,
        description: [
          item.description,
          lookup && `Verified background: ${lookup}`,
        ]
          .filter(Boolean)
          .join("\n"),
        fileName: item.file.name,
      }),
      card = record(item, writeup);
    const updatedToken = appendPhiTokenItems(tokenId, q, [card]);
    let list: any[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(SHARED) || "[]");
      list = Array.isArray(raw) ? raw : [];
    } catch {}
    const index = list.findIndex(
      (value) => (value?.storyKey || value?.url || value?.id) === card.storyKey,
    );
    if (index >= 0) list[index] = { ...list[index], ...card };
    else list.unshift(card);
    try {
      localStorage.setItem(SHARED, JSON.stringify(list.slice(0, 300)));
      const packet = {
        query: q,
        tokenId,
        items: updatedToken.items,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(CURRENT, JSON.stringify(packet));
      sessionStorage.setItem(CURRENT, JSON.stringify(packet));
      sessionStorage.setItem(
        OVERVIEW,
        JSON.stringify({
          query: q,
          tokenId,
          returnFrom: kind,
          items: updatedToken.items,
          at: Date.now(),
        }),
      );
      window.dispatchEvent(
        new CustomEvent("infinityphi:current-search-collection", {
          detail: packet,
        }),
      );
    } catch {}
    window.dispatchEvent(
      new CustomEvent("controlphi:shared", {
        detail: { source: "infinity-phi", storyKey: card.storyKey },
      }),
    );
    setCollected((value) => {
      const next = { ...value, [item.id]: true },
        ids = Object.keys(next).filter((id) => next[id]);
      setCollectedCount(ids.length);
      try {
        localStorage.setItem(
          SESSION,
          JSON.stringify({
            query: q,
            kind,
            tokenId,
            ids,
            items: updatedToken.items,
          }),
        );
      } catch {}
      return next;
    });
    setCollecting((value) => ({ ...value, [item.id]: false }));
  }
  async function share(item: Item) {
    const url = item.source;
    if (!navigator.share) {
      try {
        await navigator.clipboard.writeText(url);
        setShared((value) => ({ ...value, [item.id]: "Link copied" }));
      } catch {}
      return;
    }
    try {
      await navigator.share({
        title: item.title,
        text: item.description.slice(0, 320),
        url,
      });
      setShared((value) => ({ ...value, [item.id]: starShare(url) }));
    } catch (error: any) {
      if (error?.name !== "AbortError")
        setShared((value) => ({ ...value, [item.id]: "Share again" }));
    }
  }
  function findSimilar(item: Item) {
    const titleTerms = words(item.title)
        .filter((word) => !words(q).includes(word))
        .slice(0, 4)
        .join(" "),
      next = clean(`${q} ${titleTerms}`);
    void run(next || q, true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(q);
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-20">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={backToOverview}
            className="rounded-full bg-violet-700 px-4 py-2 text-sm font-black text-white"
          >
            ← AI Overview
          </button>
          <div className="relative rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 pr-8 text-xs font-black text-violet-900">
            {tokenLabel} · added
            <span className="absolute -right-2 -top-2 grid h-7 min-w-7 place-items-center rounded-full bg-orange-500 px-1.5 text-xs font-black text-white shadow">
              {collectedCount}
            </span>
          </div>
        </div>
        <h1 className="mt-4 text-4xl font-black">
          {kind === "audio" ? "Audio φ" : "Video φ"}
        </h1>
        <p className="mt-2 text-slate-700">
          Exact full-query matches appear first, followed by results containing
          every search word, then closely related playable files. Each card has
          one player. Pornography identified in Archive metadata or file names
          is blocked before a player is created. R-rated and other
          non-pornographic material remains available.
        </p>
        <form className="mt-5 flex gap-2" onSubmit={submit}>
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-3 text-slate-950"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            aria-label={`Search ${kind}`}
          />
          <button className="rounded-xl bg-violet-700 px-5 font-black text-white">
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
        {notice && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 font-semibold text-amber-950">
            {notice}
          </p>
        )}
        <section className="mt-7 grid gap-5 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-[26px] border-2 border-orange-400 bg-white text-slate-950 shadow-lg"
            >
              {kind === "video" ? (
                <video
                  controls
                  preload="metadata"
                  poster={item.image}
                  className="aspect-video w-full bg-black"
                  src={item.file.url}
                />
              ) : (
                <>
                  <img
                    src={item.image}
                    alt=""
                    className="h-48 w-full object-cover"
                  />
                  <div className="px-5 pt-4">
                    <audio
                      controls
                      preload="none"
                      className="w-full"
                      src={item.file.url}
                    />
                  </div>
                </>
              )}
              <div className="p-5">
                <small className="font-black uppercase text-orange-800">
                  {item.match} · Internet Archive
                </small>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {item.title}
                </h2>
                <b className="mt-2 block text-sm text-slate-700">
                  {item.file.name}
                </b>
                {item.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {item.description.slice(0, 420)}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={collecting[item.id]}
                    onClick={() => void collect(item)}
                    className="rounded-full bg-emerald-800 px-4 py-2 text-xs font-black text-white"
                  >
                    {collecting[item.id]
                      ? "Writing overview…"
                      : collected[item.id]
                        ? "✓ Added to AI Overview"
                        : "Collect to AI Overview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => findSimilar(item)}
                    className="rounded-full bg-violet-800 px-4 py-2 text-xs font-black text-white"
                  >
                    Build similar cards
                  </button>
                  <button
                    type="button"
                    onClick={() => void share(item)}
                    className="rounded-full bg-amber-800 px-4 py-2 text-xs font-black text-white"
                  >
                    {shared[item.id] || "Share card · +1/10 ⭐"}
                  </button>
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener"
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white"
                  >
                    Archive source
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(q, true)}
          className="mx-auto mt-8 block rounded-full bg-violet-800 px-7 py-3 font-black text-white disabled:opacity-50"
        >
          {busy ? "Adding more…" : "Add more"}
        </button>
        {!busy && q && !items.length && !notice && (
          <p className="mt-8">
            No safe playable {kind} files returned on this pass.
          </p>
        )}
      </div>
    </main>
  );
}
