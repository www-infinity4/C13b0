"use client";

import { useEffect } from "react";
import PhiIntentShell from "@/components/PhiIntentShell";

const OMNI_RESEARCH = "omniPhi:lastResearch:v1";
const OMNI_REACTIONS = "omniPhi:cardReactions:v1";
const SHARED_COLLECTION = "phiShared:collection:v1";
const NEWS_PHI_URL = "https://www-infinity4.github.io/News-Phi/";

function clean(value: unknown, max = 3200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function domainOf(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function providerFromUrl(value: string) {
  try {
    const url = new URL(value, location.href);
    const match = url.hash.match(/(?:^#|&)phi-provider=([^&]+)/);
    if (match) return decodeURIComponent(match[1]);
    const domain = url.hostname.replace(/^www\./, "");
    if (domain.includes("nasa.gov")) return "NASA";
    if (domain.includes("archive.org")) return "Internet Archive";
    if (domain.includes("wikipedia.org")) return "Wikipedia";
    if (domain.includes("openalex.org")) return "OpenAlex";
    return domain || "Public web";
  } catch {
    return "Public web";
  }
}

function sanitizedUrl(value: string) {
  try {
    const url = new URL(value, location.href);
    if (url.hash.startsWith("#phi-provider=")) url.hash = "";
    return url.toString();
  } catch { return value; }
}

function cardKey(title: string, url = "") {
  return url || clean(title, 180).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function weightFor(action: string) {
  return ({ share: 6, collect: 5, "build-story": 5, "build-similar": 5, read: 4, open: 3, inspect: 2 } as Record<string, number>)[action] || 2;
}

function currentQuery() {
  return clean(new URLSearchParams(location.search).get("q") || "", 240);
}

function recordFromOrangeCard(card: HTMLElement) {
  const query = currentQuery();
  const title = clean(card.querySelector("h3")?.textContent || card.querySelector("h2")?.textContent, 220);
  const extract = clean(card.querySelector("p")?.textContent || card.textContent, 1800);
  const image = card.querySelector<HTMLImageElement>("img")?.src || "";
  const sourceLink = card.querySelector<HTMLAnchorElement>("a[href^='http']")?.href || "";
  const url = sanitizedUrl(sourceLink);
  return {
    id: `infinity-card-${cardKey(title, url) || Date.now().toString(36)}`,
    storyKey: cardKey(title, url),
    title,
    sourceTitle: title,
    extract,
    sourceExtract: extract,
    url,
    domain: url ? domainOf(url) : "Infinity Phi",
    provider: url ? providerFromUrl(url) : "Infinity Phi",
    image,
    imageVerified: Boolean(image),
    sourceBacked: Boolean(url),
    sourceLocked: true,
    searchQuery: query,
    collectedAt: new Date().toISOString(),
    collectedFrom: "Infinity Phi",
  };
}

function collectInfinityRecord() {
  const query = currentQuery();
  if (!query) return null;
  const overview = clean(document.querySelector(".phi-editorial-deck")?.textContent, 2400);
  const sourceCards = [...document.querySelectorAll<HTMLAnchorElement>(".phi-green-card")].map((anchor, index) => {
    const title = clean(anchor.querySelector("b")?.textContent || `Source ${index + 1}`, 220);
    const extract = clean(anchor.querySelector("p")?.textContent, 2200);
    const rawUrl = anchor.getAttribute("href") || "";
    const url = sanitizedUrl(rawUrl);
    const provider = providerFromUrl(rawUrl);
    const image = anchor.querySelector("img")?.getAttribute("src") || "";
    return {
      id: `infinity-source-${index}`,
      title,
      url,
      domain: domainOf(url) || provider,
      provider,
      extract,
      image,
      sourceTitle: title,
      sourceExtract: extract,
      sourceLocked: true,
      storyKey: cardKey(title, url),
    };
  }).filter((source) => source.title && source.extract);

  const orangeCards = [...document.querySelectorAll<HTMLElement>(".phi-orange-card")]
    .map((card) => recordFromOrangeCard(card))
    .filter((source) => source.title && source.extract);

  const merged = [...orangeCards, ...sourceCards];
  const seen = new Set<string>();
  const sources = merged.filter((source) => {
    const key = source.storyKey || source.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 24);

  return {
    query,
    mode: "search",
    createdAt: new Date().toISOString(),
    source: { id: "source", label: query, position: { x: 0, y: 0, z: 0 }, affinity: 1 },
    nodes: [],
    overview,
    sources,
    sourceSystem: "Infinity Phi → shared Omni website engine",
    profileSnapshot: {},
  };
}

function saveOmniRecord() {
  const record = collectInfinityRecord();
  if (!record || !record.sources.length) return null;
  try { localStorage.setItem(OMNI_RESEARCH, JSON.stringify(record)); } catch {}
  return record;
}

function saveSharedCard(card: ReturnType<typeof recordFromOrangeCard>) {
  let shared: ReturnType<typeof recordFromOrangeCard>[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARED_COLLECTION) || "[]");
    shared = Array.isArray(parsed) ? parsed : [];
  } catch {}
  const key = card.storyKey || card.url || card.id;
  const existing = shared.findIndex((item) => (item.storyKey || item.url || item.id) === key);
  if (existing >= 0) shared[existing] = { ...shared[existing], ...card, collectedAt: new Date().toISOString() };
  else shared.unshift(card);
  try { localStorage.setItem(SHARED_COLLECTION, JSON.stringify(shared.slice(0, 300))); } catch {}
  saveOmniRecord();
  window.dispatchEvent(new CustomEvent("controlphi:shared", { detail: { source: "infinity-phi", storyKey: key } }));
  return card;
}

function newsPhiUrl(card: ReturnType<typeof recordFromOrangeCard>, buildSimilar = false) {
  const params = new URLSearchParams({
    collect: "1",
    from: "infinity-phi",
    sharedTitle: card.sourceTitle || card.title || "Collected Infinity Phi card",
    sharedBody: String(card.sourceExtract || card.extract || "").slice(0, 1800),
    sharedUrl: card.url || "",
    sharedImage: card.image || "",
    sharedDomain: card.domain || card.provider || "Infinity Phi",
    sharedQuery: card.searchQuery || currentQuery(),
  });
  if (buildSimilar) params.set("buildSimilar", "1");
  return `${NEWS_PHI_URL}?${params.toString()}#story=${encodeURIComponent(card.storyKey || cardKey(card.title, card.url))}`;
}

async function shareCard(card: ReturnType<typeof recordFromOrangeCard>) {
  const url = newsPhiUrl(card, false);
  const text = clean(card.extract, 420);
  if (navigator.share) {
    try {
      await navigator.share({ title: card.title, text, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    window.dispatchEvent(new CustomEvent("infinity:toast", { detail: { message: "Card link copied." } }));
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function recordReaction(card: HTMLElement, action: string) {
  const query = currentQuery();
  const title = clean(card.querySelector("h3")?.textContent, 220);
  if (!query || !title) return;
  const body = clean(card.querySelector("p")?.textContent, 1400);
  const sourceLink = card.querySelector<HTMLAnchorElement>("a[href^='http']")?.href || "";
  let events: any[] = [];
  try { events = JSON.parse(localStorage.getItem(OMNI_REACTIONS) || "[]"); } catch {}
  events.unshift({
    id: `infinity-rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    query,
    cardKey: cardKey(title, sourceLink),
    title,
    domain: sourceLink ? domainOf(sourceLink) : "Infinity Phi",
    sourceUrl: sourceLink,
    image: card.querySelector("img")?.getAttribute("src") || "",
    action,
    weight: weightFor(action),
    body,
    atomRoute: card.dataset.atomRoute || "",
    atomNucleus: card.dataset.atomNucleus || query,
    at: new Date().toISOString(),
    sourceSystem: "Infinity Phi",
  });
  try { localStorage.setItem(OMNI_REACTIONS, JSON.stringify(events.slice(0, 600))); } catch {}
  saveOmniRecord();
}

function relabelProviders(root: ParentNode = document) {
  root.querySelectorAll<HTMLAnchorElement>(".phi-green-card").forEach((anchor) => {
    const raw = anchor.getAttribute("href") || "";
    if (!raw) return;
    const small = anchor.querySelector("small");
    const provider = providerFromUrl(raw);
    if (small && provider && small.textContent === "Wikipedia") small.textContent = provider;
    const cleanUrl = sanitizedUrl(raw);
    if (cleanUrl && cleanUrl !== raw) anchor.setAttribute("href", cleanUrl);
  });
}

function ensureCardActionStyles() {
  if (document.getElementById("phi-unified-card-action-style")) return;
  const style = document.createElement("style");
  style.id = "phi-unified-card-action-style";
  style.textContent = `
    .phi-unified-card-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.16)}
    .phi-unified-card-actions button{min-height:40px;border:1px solid rgba(255,255,255,.26);border-radius:12px;background:rgba(26,19,11,.72);color:#fff5df;font:800 12px/1.2 system-ui,sans-serif;padding:9px 8px;cursor:pointer;box-shadow:none}
    .phi-unified-card-actions button:hover,.phi-unified-card-actions button:focus-visible{background:rgba(62,41,17,.9);border-color:rgba(255,200,104,.76);outline:none}
    .phi-unified-card-actions [data-phi-card-action="collect"]{border-color:rgba(92,220,154,.62)}
    .phi-unified-card-actions [data-phi-card-action="share"]{border-color:rgba(103,178,255,.62)}
    .phi-unified-card-actions [data-phi-card-action="build-story"]{border-color:rgba(255,185,70,.72)}
    .phi-unified-card-actions [data-phi-card-action="build-similar"]{border-color:rgba(198,138,255,.72)}
    @media(max-width:700px){.phi-unified-card-actions{grid-template-columns:repeat(2,minmax(0,1fr))}.phi-unified-card-actions button{font-size:12px}}
  `;
  document.head.appendChild(style);
}

function ensureCardActions() {
  ensureCardActionStyles();
  document.querySelectorAll<HTMLElement>(".phi-orange-card").forEach((card) => {
    if (card.querySelector("[data-phi-unified-actions]")) return;
    const title = clean(card.querySelector("h3")?.textContent || card.querySelector("h2")?.textContent, 220);
    const extract = clean(card.querySelector("p")?.textContent, 1800);
    if (!title || !extract) return;

    const actions = document.createElement("div");
    actions.className = "phi-unified-card-actions";
    actions.dataset.phiUnifiedActions = "1";
    const items = [
      ["collect", "Collect"],
      ["share", "Share"],
      ["build-story", "Build Story"],
      ["build-similar", "Build Similar Cards"],
    ] as const;

    items.forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.phiCardAction = action;
      button.textContent = label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const record = saveSharedCard(recordFromOrangeCard(card));
        recordReaction(card, action);
        if (action === "share") {
          void shareCard(record);
          return;
        }
        if (action === "collect") {
          location.href = newsPhiUrl(record, false);
          return;
        }
        if (action === "build-story") {
          location.href = newsPhiUrl(record, false);
          return;
        }
        location.href = newsPhiUrl(record, true);
      });
      actions.appendChild(button);
    });

    const existingActions = card.querySelector(".phi-orange-actions");
    if (existingActions) existingActions.insertAdjacentElement("afterend", actions);
    else card.appendChild(actions);
  });
}

function ensureOmniWebsiteButton() {
  const section = document.querySelector<HTMLElement>(".phi-purple-section");
  if (!section || section.querySelector("[data-omni-website-builder]")) return;
  const query = currentQuery();
  if (!query) return;
  const link = document.createElement("a");
  link.dataset.omniWebsiteBuilder = "1";
  link.className = "phi-purple-build";
  link.href = `https://www-infinity4.github.io/Omni-Phi/cards/?${new URLSearchParams({ q: query, mode: "search", from: "infinity" })}`;
  link.innerHTML = '<span class="phi-card-orb">φ</span> Generate website from this storyboard';
  link.addEventListener("click", () => { saveOmniRecord(); });
  section.appendChild(link);
}

function installInteractionBridge() {
  if ((window as any).__phiUnifiedInteractionBridge) return;
  (window as any).__phiUnifiedInteractionBridge = true;
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const orange = target?.closest<HTMLElement>(".phi-orange-card");
    if (!orange || target?.closest("[data-phi-card-action]")) return;
    if (target?.closest(".phi-share-card")) recordReaction(orange, "share");
    else if (target?.closest("a")) recordReaction(orange, "open");
    else if (target?.closest("button")) recordReaction(orange, "read");
    else recordReaction(orange, "inspect");
  }, true);
}

export default function PhiUnifiedPage() {
  useEffect(() => {
    installInteractionBridge();
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        relabelProviders();
        ensureCardActions();
        ensureOmniWebsiteButton();
        saveOmniRecord();
      });
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
    return () => observer.disconnect();
  }, []);

  return <PhiIntentShell />;
}
