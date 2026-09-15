"use client";

import { useEffect } from "react";
import PhiIntentShell from "@/components/PhiIntentShell";

const OMNI_RESEARCH = "omniPhi:lastResearch:v1";
const OMNI_REACTIONS = "omniPhi:cardReactions:v1";

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
  return ({ share: 6, collect: 5, read: 4, open: 3, inspect: 2 } as Record<string, number>)[action] || 2;
}

function currentQuery() {
  return clean(new URLSearchParams(location.search).get("q") || "", 240);
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

  const orangeCards = [...document.querySelectorAll<HTMLElement>(".phi-orange-card")].map((card, index) => {
    const title = clean(card.querySelector("h3")?.textContent, 220);
    const extract = clean(card.querySelector("p")?.textContent, 1800);
    const image = card.querySelector("img")?.getAttribute("src") || "";
    const sourceLink = card.querySelector<HTMLAnchorElement>("a[href^='http']")?.href || "";
    return {
      id: `infinity-orange-${index}`,
      title,
      url: sourceLink,
      domain: sourceLink ? domainOf(sourceLink) : "Infinity Phi",
      provider: "Infinity Phi semantic card",
      extract,
      image,
      sourceTitle: title,
      sourceExtract: extract,
      sourceLocked: true,
      storyKey: cardKey(title, sourceLink),
    };
  }).filter((source) => source.title && source.extract);

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
    if (!orange) return;
    if (target?.closest(".phi-share-card")) recordReaction(orange, "share");
    else if (target?.closest("a")) recordReaction(orange, "open");
    else if (target?.closest("button")) recordReaction(orange, "read");
    else recordReaction(orange, "inspect");
  }, true);
}

export default function PhiUnifiedPage() {
  useEffect(() => {
    installInteractionBridge();
    const refresh = () => {
      relabelProviders();
      ensureOmniWebsiteButton();
      saveOmniRecord();
    };
    const observer = new MutationObserver(() => refresh());
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
    return () => observer.disconnect();
  }, []);

  return <PhiIntentShell />;
}
