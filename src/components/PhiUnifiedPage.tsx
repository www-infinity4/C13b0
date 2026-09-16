"use client";

import { useEffect } from "react";
import PhiIntentShell from "@/components/PhiIntentShell";

const OMNI_RESEARCH = "omniPhi:lastResearch:v1";
const OMNI_REACTIONS = "omniPhi:cardReactions:v1";
const SHARED_COLLECTION = "phiShared:collection:v1";
const INTEREST_SIGNALS = "phiShared:interestSignals:v1";
const NEWS_PHI_URL = "https://www-infinity4.github.io/News-Phi/";
const activeNewsBuilds = new Map<string, { frame: HTMLIFrameElement; cleanup: () => void }>();

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
  return ({ share: 6, collect: 5, "build-story": 5, "build-more-news": 5, read: 4, open: 3, inspect: 2 } as Record<string, number>)[action] || 2;
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

type OrangeRecord = ReturnType<typeof recordFromOrangeCard>;

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

function sharedCards(): OrangeRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARED_COLLECTION) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function sharedKey(card: OrangeRecord) {
  return card.storyKey || card.url || card.id;
}

function isCollected(card: OrangeRecord) {
  const key = sharedKey(card);
  return sharedCards().some((item) => (item.storyKey || item.url || item.id) === key);
}

function saveSharedCard(card: OrangeRecord) {
  const shared = sharedCards();
  const key = sharedKey(card);
  const existing = shared.findIndex((item) => (item.storyKey || item.url || item.id) === key);
  if (existing >= 0) shared[existing] = { ...shared[existing], ...card, collectedAt: new Date().toISOString() };
  else shared.unshift(card);
  try { localStorage.setItem(SHARED_COLLECTION, JSON.stringify(shared.slice(0, 300))); } catch {}
  saveOmniRecord();
  window.dispatchEvent(new CustomEvent("controlphi:shared", { detail: { source: "infinity-phi", storyKey: key } }));
  return card;
}

function saveInterestSignal(card: OrangeRecord, action: "collect" | "build-more-news") {
  let signals: any[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(INTEREST_SIGNALS) || "[]");
    signals = Array.isArray(parsed) ? parsed : [];
  } catch {}
  const key = sharedKey(card);
  const prior = signals.find((item) => item?.topicKey === key);
  const next = {
    ...(prior || {}),
    id: prior?.id || `infinity-interest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "search",
    sourceAction: action,
    topicKey: key,
    title: card.title,
    program: card.title,
    query: clean(`${card.title} ${card.searchQuery} ${card.extract}`, 1200),
    url: card.url,
    image: card.image,
    domain: card.domain,
    hits: Math.max(1, Number(prior?.hits || 0) + 1),
    collectedAt: card.collectedAt,
    lastAt: Date.now(),
    source: "Infinity Phi collect",
  };
  const filtered = signals.filter((item) => item?.topicKey !== key);
  try { localStorage.setItem(INTEREST_SIGNALS, JSON.stringify([next, ...filtered].slice(0, 500))); } catch {}
  window.dispatchEvent(new CustomEvent("newsphi:interest", { detail: next }));
}

function newsPhiUrl(card: OrangeRecord, buildSimilar = false) {
  const params = new URLSearchParams({
    collect: "1",
    from: "infinity-phi",
    background: "1",
    sharedTitle: card.sourceTitle || card.title || "Collected Infinity Phi card",
    sharedBody: String(card.sourceExtract || card.extract || "").slice(0, 1800),
    sharedUrl: card.url || "",
    sharedImage: card.image || "",
    sharedDomain: card.domain || card.provider || "Infinity Phi",
    sharedQuery: card.searchQuery || currentQuery(),
  });
  if (buildSimilar) params.set("buildSimilar", "1");
  return `${NEWS_PHI_URL}?${params.toString()}#story=${encodeURIComponent(sharedKey(card))}`;
}

function childIdsFor(key: string) {
  return new Set(sharedCards().filter((item: any) => item?.parentStoryKey === key).map((item: any) => item.id || item.storyKey || item.url));
}

function setNewsButtonState(key: string, state: "idle" | "building" | "done") {
  document.querySelectorAll<HTMLButtonElement>("[data-phi-build-news-key]").forEach((button) => {
    if (button.dataset.phiBuildNewsKey !== key) return;
    button.disabled = state === "building";
    button.dataset.newsState = state;
    button.textContent = state === "building" ? "Building news…" : state === "done" ? "✓ News added" : "Build more news";
    if (state === "done") window.setTimeout(() => {
      if (button.isConnected && button.dataset.newsState === "done") {
        button.dataset.newsState = "idle";
        button.textContent = "Build more news";
      }
    }, 2200);
  });
}

function buildNewsInBackground(card: OrangeRecord) {
  const key = sharedKey(card);
  const running = activeNewsBuilds.get(key);
  if (running) {
    setNewsButtonState(key, "building");
    return;
  }

  const before = childIdsFor(key);
  const frame = document.createElement("iframe");
  frame.title = `News Phi background builder for ${card.title}`;
  frame.src = newsPhiUrl(card, true);
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    right: "-20px",
    bottom: "-20px",
    opacity: "0",
    pointerEvents: "none",
    border: "0",
  });

  let timeoutId = 0;
  const finish = (success: boolean) => {
    window.removeEventListener("storage", onStorage);
    if (timeoutId) window.clearTimeout(timeoutId);
    frame.remove();
    activeNewsBuilds.delete(key);
    setNewsButtonState(key, success ? "done" : "idle");
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SHARED_COLLECTION || !event.newValue) return;
    try {
      const cards = JSON.parse(event.newValue);
      const added = Array.isArray(cards) && cards.some((item: any) => item?.parentStoryKey === key && !before.has(item.id || item.storyKey || item.url));
      if (added) finish(true);
    } catch {}
  };

  window.addEventListener("storage", onStorage);
  timeoutId = window.setTimeout(() => finish(childIdsFor(key).size > before.size), 30000);
  activeNewsBuilds.set(key, { frame, cleanup: () => finish(false) });
  setNewsButtonState(key, "building");
  document.body.appendChild(frame);
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
    .phi-unified-card-actions{display:contents}
    .phi-news-action{display:inline-flex;align-items:center;justify-content:center;min-height:34px;border-radius:999px;padding:8px 12px;font:900 12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:none;transition:transform .12s ease,background .12s ease,border-color .12s ease;color:#fff}
    .phi-news-action:hover,.phi-news-action:focus-visible{transform:translateY(-1px);outline:none}
    .phi-collect-card{border:1px solid rgba(167,243,208,.72);background:rgba(6,78,59,.48)}
    .phi-collect-card[data-collected="1"]{border-color:#a7f3d0;background:#d1fae5;color:#064e3b}
    .phi-build-news-card{border:1px solid rgba(233,213,255,.72);background:rgba(88,28,135,.48)}
    .phi-build-news-card:disabled{cursor:progress;opacity:.78;transform:none}
  `;
  document.head.appendChild(style);
}

function markCollected(button: HTMLButtonElement, collected: boolean) {
  button.dataset.collected = collected ? "1" : "0";
  button.textContent = collected ? "✓ Collected" : "Collect";
  button.setAttribute("aria-pressed", collected ? "true" : "false");
}

function ensureCardActions() {
  ensureCardActionStyles();
  document.querySelectorAll<HTMLElement>(".phi-orange-card").forEach((card) => {
    card.querySelectorAll<HTMLElement>(".phi-unified-card-actions").forEach((old) => old.remove());
    if (card.querySelector("[data-phi-collect-card]")) return;
    const record = recordFromOrangeCard(card);
    if (!record.title || !record.extract) return;

    const nativeActions = card.querySelector<HTMLElement>(".phi-share-card")?.parentElement;
    const actions = nativeActions || document.createElement("div");
    if (!nativeActions) {
      actions.className = "phi-unified-card-actions";
      const body = card.querySelector(".p-5") || card;
      body.appendChild(actions);
    }

    const collectButton = document.createElement("button");
    collectButton.type = "button";
    collectButton.className = "phi-news-action phi-collect-card";
    collectButton.dataset.phiCollectCard = "1";
    collectButton.dataset.phiCardAction = "collect";
    markCollected(collectButton, isCollected(record));
    collectButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = recordFromOrangeCard(card);
      const wasCollected = isCollected(current);
      saveSharedCard(current);
      saveInterestSignal(current, "collect");
      recordReaction(card, "collect");
      markCollected(collectButton, true);
      if (!wasCollected) buildNewsInBackground(current);
    });

    const buildButton = document.createElement("button");
    buildButton.type = "button";
    buildButton.className = "phi-news-action phi-build-news-card";
    buildButton.dataset.phiBuildNewsKey = sharedKey(record);
    buildButton.dataset.phiCardAction = "build-more-news";
    buildButton.dataset.newsState = "idle";
    buildButton.textContent = "Build more news";
    buildButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const current = recordFromOrangeCard(card);
      saveSharedCard(current);
      saveInterestSignal(current, "build-more-news");
      recordReaction(card, "build-more-news");
      markCollected(collectButton, true);
      buildButton.dataset.phiBuildNewsKey = sharedKey(current);
      buildNewsInBackground(current);
    });

    actions.append(collectButton, buildButton);
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
    return () => {
      observer.disconnect();
      activeNewsBuilds.forEach((entry) => entry.cleanup());
      activeNewsBuilds.clear();
    };
  }, []);

  return <PhiIntentShell />;
}
