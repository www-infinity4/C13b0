"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, ExternalLink, Globe2, Search, Sparkles, Star } from "lucide-react";
import { appPath } from "@/lib/base-path";

const GUEST_KEY = "starquest_guest_profile_v1";
const SESSION_KEY = "starquest_session";
const USERS_KEY = "starquest_users";
const HANDOFF_KEY = "phiNetwork:walletHandoff:v1";

type StarSnapshot = {
  balance: number;
  progress: number;
  shares: number;
};

function jsonRead<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function starSnapshot(): StarSnapshot {
  const session = jsonRead<{ key?: string } | null>(SESSION_KEY, null);
  const users = jsonRead<Record<string, Record<string, unknown>>>(USERS_KEY, {});
  const profile = session?.key && users[session.key]
    ? users[session.key]
    : jsonRead<Record<string, unknown>>(GUEST_KEY, {});
  return {
    balance: Math.max(0, Number(profile.tokens) || 0),
    progress: Math.max(0, Number(profile.pendingShareCredits) || 0),
    shares: Math.max(0, Number(profile.shareCount) || 0),
  };
}

function selectedTokenId() {
  return new URLSearchParams(location.search).get("token") || "";
}

function saveHandoff(action: "expand-sources" | "build-website", query: string) {
  const packet = {
    schema: "phi-wallet-handoff/v1",
    action,
    query,
    tokenId: selectedTokenId(),
    source: "infinity-token-wallet",
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(HANDOFF_KEY, JSON.stringify(packet));
  return packet;
}

export default function TokenWalletAI() {
  const [request, setRequest] = useState("");
  const [stars, setStars] = useState<StarSnapshot>({ balance: 0, progress: 0, shares: 0 });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => setStars(starSnapshot());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("starquest:share-progress", refresh as EventListener);
    window.addEventListener("controlphi:wallet-change", refresh as EventListener);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("starquest:share-progress", refresh as EventListener);
      window.removeEventListener("controlphi:wallet-change", refresh as EventListener);
    };
  }, []);

  useEffect(() => {
    // The global shell button normally lives at the upper-left. On the wallet it
    // sat on top of the AI wallet heading, so keep it floating clear of content.
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Open Infinity Phi menu"]');
    if (!button) return;
    const previous = {
      left: button.style.left,
      right: button.style.right,
      top: button.style.top,
      bottom: button.style.bottom,
    };
    button.style.left = "auto";
    button.style.right = "1rem";
    button.style.top = "auto";
    button.style.bottom = "1rem";
    return () => {
      button.style.left = previous.left;
      button.style.right = previous.right;
      button.style.top = previous.top;
      button.style.bottom = previous.bottom;
    };
  }, []);

  function workingQuery() {
    return request.trim() || selectedTokenId();
  }

  function expandSources() {
    const query = workingQuery();
    if (!query) {
      setNotice("Select a token below or describe the sources you want AI to add.");
      return;
    }
    const packet = saveHandoff("expand-sources", query);
    const params = new URLSearchParams({ q: packet.query, from: "wallet" });
    if (packet.tokenId) params.set("token", packet.tokenId);
    location.href = `${appPath("phi")}?${params}`;
  }

  function buildWebsite() {
    const query = workingQuery();
    if (!query) {
      setNotice("Select a token below or describe the website you want to build.");
      return;
    }
    const packet = saveHandoff("build-website", query);
    const params = new URLSearchParams({ q: packet.query, mode: "search", from: "wallet" });
    if (packet.tokenId) params.set("token", packet.tokenId);
    location.href = `https://www-infinity4.github.io/Omni-Phi/cards/?${params}`;
  }

  return (
    <section className="bg-[#061a30] px-4 pt-5 text-white sm:px-7">
      <div className="mx-auto max-w-7xl rounded-[1.6rem] border border-white/10 bg-white/[.06] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#f0bd55]"><BrainCircuit size={17} /> AI wallet workspace</p>
            <h2 className="mt-2 font-serif text-3xl font-black">Add sources. Build farther from the token.</h2>
            <p className="mt-2 leading-7 text-white/60">The token keeps its original ledger and manual source attachments below. These controls hand the selected token into Infinity Phi for AI source expansion or into Omni Phi to turn the research into an actual website.</p>
          </div>
          <div id="star-coin" className="min-w-48 rounded-2xl border border-[#f0bd55]/30 bg-[#f0bd55]/10 p-4 text-right">
            <p className="flex items-center justify-end gap-2 text-xs font-black uppercase tracking-wider text-[#f0bd55]"><Star size={16} /> Star Coin</p>
            <p className="mt-1 text-2xl font-black">{stars.balance}</p>
            <p className="text-xs text-white/55">{stars.progress}/10 shares · {stars.shares} total shares</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="flex min-w-0 items-center gap-3 rounded-xl bg-black/20 px-4">
            <Search size={18} className="shrink-0 text-white/45" />
            <input
              value={request}
              onChange={(event) => { setRequest(event.target.value); setNotice(""); }}
              placeholder="Ask for more sources or describe what this token should build…"
              className="min-w-0 flex-1 bg-transparent py-3.5 text-base outline-none placeholder:text-white/35"
            />
          </label>
          <button onClick={expandSources} className="flex items-center justify-center gap-2 rounded-xl bg-[#174d7e] px-5 py-3 font-black"><Sparkles size={18} /> Add more sources with AI</button>
          <button onClick={buildWebsite} className="flex items-center justify-center gap-2 rounded-xl bg-[#7b2ca2] px-5 py-3 font-black"><Globe2 size={18} /> Build actual website</button>
        </div>
        {notice && <p className="mt-3 text-sm font-bold text-[#f0bd55]">{notice}</p>}

        <nav className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4" aria-label="Phi network and wallets">
          <a href={appPath("phi")} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold">Infinity Phi</a>
          <a href="https://www-infinity4.github.io/Omni-Phi/" className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold">Omni Phi</a>
          <a href="https://www-infinity4.github.io/News-Phi/" className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold">News Phi</a>
          <a href={appPath("wallet")} className="flex items-center gap-2 rounded-full border border-[#f0bd55]/35 px-4 py-2 text-sm font-bold text-[#f0bd55]">Infinity + Star Coin wallets <ExternalLink size={14} /></a>
        </nav>
      </div>
    </section>
  );
}
