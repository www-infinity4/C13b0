import type { Metadata } from "next";
import GameTokens from "@/components/GameTokens";
import { Trophy, Coins, Star, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Infinity Game — Infinity OS",
  description:
    "Play the Infinity OS token game. Watch & Earn, level up through stages ♣️♦️♥️♠️, collect stars, squash bugs, and unlock new features.",
};

const HOW_TO_PLAY = [
  { icon: "👀", title: "Watch & Earn", desc: "Watch content to earn 🟡 tokens each time." },
  { icon: "🕹️", title: "Play & Collect", desc: "Play mini-games to collect bonus tokens." },
  { icon: "⭐", title: "Collect Stars", desc: "Stars give trending boosts across the network." },
  { icon: "🍄", title: "Use Mushrooms", desc: "Doubles your research output instantly." },
  { icon: "🐛", title: "Squash Bugs", desc: "Fix bugs in early repo systems to earn bonus tokens." },
  { icon: "⚪", title: "Warp", desc: "Warp mode: spend tokens, leave a clone behind." },
];

const STAGES = [
  { icon: "♣️", name: "Club", desc: "Starting stage — basic token earning", threshold: "0 tokens" },
  { icon: "♦️", name: "Diamond", desc: "Intermediate — unlock research tools", threshold: "150 tokens" },
  { icon: "♥️", name: "Heart", desc: "Advanced — community features unlocked", threshold: "300 tokens" },
  { icon: "♠️", name: "Spade", desc: "Master stage — full website builder access", threshold: "500+ tokens" },
];

export default function GamePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Header */}
      <section aria-labelledby="game-page-heading" className="mb-12 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-500/40 bg-yellow-900/20 text-sm text-yellow-300 mb-6"
          role="note"
        >
          <Coins className="w-4 h-4" aria-hidden="true" />
          🟡 Token Economy — Real Value, One Click at a Time
        </div>
        <h1
          id="game-page-heading"
          className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
        >
          Infinity Game
        </h1>
        <p className="text-purple-200/60 text-lg max-w-2xl mx-auto">
          Build value click by click. Every action earns tokens, every token
          drives development. Watch & Earn → Research → Website → Tools → Assets.
        </p>
      </section>

      {/* Token path */}
      <section
        className="mb-12 glass-card rounded-2xl p-8 border border-yellow-800/30"
        aria-labelledby="path-heading"
      >
        <h2 id="path-heading" className="text-xl font-bold text-white mb-6 text-center">
          🟡 Token → 👑 Website → 🤓 Research → 🦾 Tools
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2 text-2xl" aria-label="Token path: tokens to website to research to tools to development to value to assets">
          {["🟡", "→", "👑", "→", "🤓", "→", "🦾", "→", "⚙️", "→", "💰", "→", "💲"].map(
            (item, i) => (
              <span
                key={i}
                className={item === "→" ? "text-purple-500 text-lg" : "float-animation"}
                style={{ animationDelay: `${i * 0.15}s` }}
                aria-hidden={item === "→"}
              >
                {item}
              </span>
            )
          )}
        </div>
        <p className="text-center text-purple-300/50 text-sm mt-4">
          In a few clicks, any idea becomes real gold and value in website building alone
        </p>
      </section>

      {/* Game widget + stages */}
      <div className="grid lg:grid-cols-2 gap-8 mb-12">
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" aria-hidden="true" />
            Play Now
          </h2>
          <GameTokens />
        </div>

        {/* Stages */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" aria-hidden="true" />
            Level Stages
          </h2>
          <div className="space-y-3" role="list" aria-label="Game level stages">
            {STAGES.map((stage) => (
              <div
                key={stage.name}
                className="glass-card rounded-xl p-4 border border-purple-800/30 flex items-center gap-4"
                role="listitem"
              >
                <span className="text-3xl flex-shrink-0" aria-hidden="true">
                  {stage.icon}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-white">
                    {stage.name} Stage
                  </p>
                  <p className="text-xs text-purple-300/60 mt-0.5">{stage.desc}</p>
                </div>
                <span className="text-xs text-cyan-400 font-mono">{stage.threshold}</span>
              </div>
            ))}
          </div>

          {/* Star info */}
          <div className="mt-4 glass-card rounded-xl p-4 border border-yellow-800/30">
            <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2 mb-2">
              <Star className="w-4 h-4" aria-hidden="true" />
              Stars = Trending Boost
            </h3>
            <p className="text-xs text-purple-300/60">
              Stars amplify your content&apos;s reach across the Infinity network. High
              point scores unlock new free games via the switch mechanism.
            </p>
          </div>
        </div>
      </div>

      {/* How to play */}
      <section aria-labelledby="how-to-play-heading">
        <h2
          id="how-to-play-heading"
          className="text-2xl font-bold text-white mb-6 text-center"
        >
          How to Play
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
          {HOW_TO_PLAY.map((item) => (
            <div
              key={item.title}
              className="glass-card rounded-xl p-5 border border-purple-800/30"
              role="listitem"
            >
              <div className="text-3xl mb-3" aria-hidden="true">{item.icon}</div>
              <h3 className="font-bold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-purple-300/60">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
