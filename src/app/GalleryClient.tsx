"use client";

import { useState, useMemo } from "react";

export interface TileCard {
  tileId: string;
  generatedAt: string;
  masterHash: string;
  shotCount: number;
  fps: number;
  totalFrames: number;
  storyboard: string;
  comfyNodes: number;
  shots: Array<{
    id: string;
    durationS: number;
    frameCount: number;
    frameStart: number;
  }>;
}

function shortHash(h: string): string {
  return h.slice(0, 8) + "…";
}

function formatDate(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

function TileCardView({ card, index }: { card: TileCard; index: number }) {
  const [open, setOpen] = useState(false);
  const date = formatDate(card.generatedAt);

  return (
    <article
      id={card.tileId}
      className="glass-card rounded-2xl p-5 border border-purple-800/30 hover:border-yellow-500/60 transition-all duration-200 flex flex-col gap-3"
    >
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-purple-900/40 pb-3">
        <span className="text-xs font-mono text-purple-500">
          #{String(index + 1).padStart(4, "0")}
        </span>
        <span className="font-bold text-yellow-400 flex-1 truncate text-sm">
          {card.tileId}
        </span>
        <span
          className="text-xs text-purple-400/60 cursor-help shrink-0"
          title={card.masterHash}
        >
          🔒 {shortHash(card.masterHash)}
        </span>
      </header>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-purple-300/70">
        <span>📅 {date}</span>
        <span>
          🎞 {card.fps} fps · {card.totalFrames} frames · {card.shotCount}{" "}
          shots
        </span>
        {card.comfyNodes > 0 && <span>🔧 {card.comfyNodes} nodes</span>}
      </div>

      {/* Shot badges */}
      <div className="flex flex-wrap gap-1.5">
        {card.shots.map((s) => (
          <span
            key={s.id}
            className="px-2 py-0.5 rounded text-xs border border-purple-800/40 bg-purple-900/20 text-blue-300"
          >
            {s.id}{" "}
            <span className="text-purple-500/60">
              {s.durationS}s · {s.frameCount}f
            </span>
          </span>
        ))}
      </div>

      {/* Storyboard toggle */}
      {card.storyboard && !card.storyboard.startsWith("(storyboard not") && (
        <div className="border-t border-purple-900/30 pt-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-purple-400/70 hover:text-yellow-400 transition-colors"
            aria-expanded={open}
          >
            {open ? "▼" : "▶"} ASCII Storyboard
          </button>
          {open && (
            <pre className="mt-2 text-xs text-cyan-300/80 leading-snug overflow-x-auto bg-black/30 rounded p-2 whitespace-pre">
              {card.storyboard}
            </pre>
          )}
        </div>
      )}
    </article>
  );
}

export default function GalleryClient({ tiles }: { tiles: TileCard[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tiles;
    return tiles.filter((t) => t.tileId.toLowerCase().includes(q));
  }, [tiles, query]);

  return (
    <div className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      {/* Page header */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold shimmer-text mb-2">
          C13b0 — Film Cell Index
        </h1>
        <p className="text-purple-300/60 text-sm">
          {tiles.length.toLocaleString()} tile
          {tiles.length !== 1 ? "s" : ""} · Cartoon Prompt Engine · Deterministic
        </p>
      </header>

      {/* Search bar */}
      <div className="mb-6 max-w-md mx-auto">
        <label htmlFor="tile-search" className="sr-only">
          Search tiles
        </label>
        <input
          id="tile-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tile IDs…"
          className="w-full px-4 py-2.5 rounded-xl bg-purple-900/20 border border-purple-700/40 text-white placeholder:text-purple-400/40 focus:outline-none focus:border-yellow-500/60 text-sm"
          aria-label="Search tiles by ID"
        />
      </div>

      {/* Stats bar */}
      <p className="text-center text-xs text-purple-400/50 mb-6" aria-live="polite">
        {query
          ? `${filtered.length.toLocaleString()} of ${tiles.length.toLocaleString()} tiles match`
          : `Showing all ${tiles.length.toLocaleString()} tiles`}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-purple-400/50 py-20">
          No tiles match your search.
          {tiles.length === 0 && (
            <>
              {" "}
              Run{" "}
              <code className="text-yellow-400 text-xs">npm run generate</code>{" "}
              to create your first Film Cell.
            </>
          )}
        </p>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          }}
          role="list"
          aria-label="Film cell tiles"
        >
          {filtered.map((card, i) => (
            <div key={card.tileId} role="listitem">
              <TileCardView card={card} index={i} />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-purple-500/40">
        C13b0 Cartoon Prompt Engine · Deterministic · No Video Rendered
      </footer>
    </div>
  );
}
