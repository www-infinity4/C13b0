"use client";

import { useState, useCallback } from "react";
import { Star, Zap, Trophy, Bug, Circle } from "lucide-react";
import type { TokenGame } from "@/types";

const STAGE_MAP: Record<TokenGame["stage"], { icon: string; label: string; color: string }> = {
  club: { icon: "♣️", label: "Club Stage", color: "text-green-400" },
  diamond: { icon: "♦️", label: "Diamond Stage", color: "text-blue-400" },
  heart: { icon: "♥️", label: "Heart Stage", color: "text-red-400" },
  spade: { icon: "♠️", label: "Spade Stage", color: "text-purple-400" },
};

const STAGES: TokenGame["stage"][] = ["club", "diamond", "heart", "spade"];

const initialState: TokenGame = {
  tokens: 0,
  level: 1,
  stars: 0,
  mushrooms: 0,
  stage: "club",
  bugs: 0,
};

export default function GameTokens() {
  const [game, setGame] = useState<TokenGame>(initialState);
  const [lastAction, setLastAction] = useState<string>("");
  const [animating, setAnimating] = useState<string | null>(null);

  const trigger = (key: string, label: string, update: (g: TokenGame) => TokenGame) => {
    setAnimating(key);
    setLastAction(label);
    setGame((g) => {
      const next = update(g);
      // Auto-advance stage
      const newLevel = Math.floor(next.tokens / 50) + 1;
      const stageIndex = Math.min(Math.floor((newLevel - 1) / 3), STAGES.length - 1);
      return { ...next, level: newLevel, stage: STAGES[stageIndex] };
    });
    setTimeout(() => setAnimating(null), 600);
  };

  const watchAndEarn = useCallback(() => {
    trigger("watch", "🟡 +5 tokens earned!", (g) => ({ ...g, tokens: g.tokens + 5 }));
  }, []);

  const playGame = useCallback(() => {
    const earned = Math.floor(Math.random() * 15) + 5;
    trigger("play", `🕹️ +${earned} tokens from game!`, (g) => ({ ...g, tokens: g.tokens + earned }));
  }, []);

  const collectStar = useCallback(() => {
    trigger("star", "⭐ Star collected — trending boost!", (g) => ({ ...g, stars: g.stars + 1, tokens: g.tokens + 10 }));
  }, []);

  const useMushroom = useCallback(() => {
    if (game.mushrooms === 0) {
      setLastAction("❌ No mushrooms available!");
      return;
    }
    trigger("mushroom", "🍄 Research doubled!", (g) => ({
      ...g,
      mushrooms: g.mushrooms - 1,
      tokens: g.tokens + g.tokens, // double
    }));
  }, [game.mushrooms]);

  const squashBug = useCallback(() => {
    if (game.bugs === 0) {
      setLastAction("✅ No bugs found!");
      return;
    }
    trigger("bug", `🦟 Bug squashed! +20 tokens`, (g) => ({
      ...g,
      bugs: Math.max(0, g.bugs - 1),
      tokens: g.tokens + 20,
    }));
  }, [game.bugs]);

  const warp = useCallback(() => {
    trigger("warp", "⚪ Warp activated — clone preserved!", (g) => ({
      ...g,
      tokens: Math.floor(g.tokens * 0.8), // spend 20%
    }));
  }, []);

  const spawnBug = useCallback(() => {
    trigger("spawn", "🐛 Bug appeared in early repo!", (g) => ({ ...g, bugs: g.bugs + 1 }));
  }, []);

  const farmMushroom = useCallback(() => {
    trigger("farm", "🍄 Mushroom grown!", (g) => ({ ...g, mushrooms: g.mushrooms + 1 }));
  }, []);

  const stage = STAGE_MAP[game.stage];

  return (
    <div className="glass-card rounded-2xl p-6" role="region" aria-label="Infinity OS token game">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-lg text-white">Infinity Token Game</h3>
          <p className="text-xs text-purple-300/60">Click by click — real gold & value</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${stage.color}`}>{stage.icon}</p>
          <p className={`text-xs font-semibold ${stage.color}`}>{stage.label}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="text-center glass-card rounded-xl p-3">
          <p className="text-yellow-400 text-xl font-bold">🟡 {game.tokens}</p>
          <p className="text-xs text-purple-300/60">Tokens</p>
        </div>
        <div className="text-center glass-card rounded-xl p-3">
          <p className="text-white text-xl font-bold flex items-center justify-center gap-1">
            <Star className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            {game.stars}
          </p>
          <p className="text-xs text-purple-300/60">Stars</p>
        </div>
        <div className="text-center glass-card rounded-xl p-3">
          <p className="text-white text-xl font-bold">Lv.{game.level}</p>
          <p className="text-xs text-purple-300/60">Level</p>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="flex gap-4 mb-5 text-sm">
        <span className="flex items-center gap-1 text-orange-400">
          🍄 ×{game.mushrooms}
        </span>
        <span className="flex items-center gap-1 text-red-400">
          <Bug className="w-3 h-3" aria-hidden="true" />
          ×{game.bugs}
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <Circle className="w-3 h-3" aria-hidden="true" />
          Warps active
        </span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={watchAndEarn}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 transition-all ${animating === "watch" ? "scale-95" : ""}`}
          aria-label="Watch and earn 5 tokens"
        >
          👀 Watch &amp; Earn 🟡
        </button>
        <button
          onClick={playGame}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-all ${animating === "play" ? "scale-95" : ""}`}
          aria-label="Play a game to collect tokens"
        >
          🕹️ Play &amp; Collect 🟡
        </button>
        <button
          onClick={collectStar}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-all ${animating === "star" ? "scale-95" : ""}`}
          aria-label="Collect a star for trending boost"
        >
          <Star className="w-4 h-4" aria-hidden="true" /> Collect Star ⭐
        </button>
        <button
          onClick={useMushroom}
          disabled={game.mushrooms === 0}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            game.mushrooms > 0
              ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30"
              : "bg-gray-700/20 text-gray-500 border border-gray-700/30 cursor-not-allowed"
          } ${animating === "mushroom" ? "scale-95" : ""}`}
          aria-label={`Use mushroom to double research${game.mushrooms === 0 ? " — none available" : ""}`}
          aria-disabled={game.mushrooms === 0}
        >
          🍄 Double Research
        </button>
        <button
          onClick={squashBug}
          disabled={game.bugs === 0}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            game.bugs > 0
              ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30"
              : "bg-gray-700/20 text-gray-500 border border-gray-700/30 cursor-not-allowed"
          } ${animating === "bug" ? "scale-95" : ""}`}
          aria-label={`Squash bugs${game.bugs === 0 ? " — none detected" : ""}`}
          aria-disabled={game.bugs === 0}
        >
          <Bug className="w-4 h-4" aria-hidden="true" /> Squash Bugs
        </button>
        <button
          onClick={warp}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 border border-gray-500/30 transition-all ${animating === "warp" ? "scale-95" : ""}`}
          aria-label="Activate warp, spend tokens, preserve clone"
        >
          ⚪ Warp
        </button>
      </div>

      {/* Dev tools row */}
      <div className="flex gap-2 mb-4 text-xs">
        <button
          onClick={farmMushroom}
          className="px-3 py-1 rounded bg-purple-800/30 text-purple-300 hover:bg-purple-700/30"
          aria-label="Farm a mushroom"
        >
          🍄 Farm
        </button>
        <button
          onClick={spawnBug}
          className="px-3 py-1 rounded bg-red-900/30 text-red-400 hover:bg-red-800/30"
          aria-label="Simulate bug appearing in repo"
        >
          🐛 Simulate Bug
        </button>
        <div className="ml-auto flex items-center gap-1 text-purple-400/60">
          <Trophy className="w-3 h-3" aria-hidden="true" />
          <Zap className="w-3 h-3" aria-hidden="true" />
          <span>Infinity</span>
        </div>
      </div>

      {/* Last action feedback */}
      {lastAction && (
        <div
          className="text-center py-2 px-4 rounded-lg bg-purple-900/30 border border-purple-700/30 text-sm text-purple-200"
          role="status"
          aria-live="polite"
        >
          {lastAction}
        </div>
      )}

      {/* Level up message */}
      {game.tokens >= 100 && game.stage === "spade" && (
        <div
          className="mt-3 text-center py-2 px-4 rounded-lg bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/40 text-sm text-yellow-300"
          role="alert"
        >
          👑 Max Level Reached — New Games Unlocked for Free!
        </div>
      )}
    </div>
  );
}
