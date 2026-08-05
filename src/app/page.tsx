import Link from "next/link";
import { ArrowRight, Zap, Globe, BookOpen, Cpu, Layers } from "lucide-react";
import EmojiIdentifier from "@/components/EmojiIdentifier";
import GameTokens from "@/components/GameTokens";

const FEATURE_CARDS = [
  {
    icon: "👑",
    title: "Crown Index",
    desc: "Repository-first map of all 100 www-infinity4 projects, organized into connected portfolio realms.",
    href: "/crown-index",
    color: "from-violet-600/25 to-amber-500/20 border-amber-400/30",
  },
  {
    icon: "🌐",
    title: "Hydrogen Host",
    desc: "Emoji-based 8-block device identifiers for free P2P communication. No phone numbers, no subscriptions.",
    href: "/hydrogen-host",
    color: "from-purple-600/20 to-cyan-600/20 border-purple-500/30",
  },
  {
    icon: "🔬",
    title: "Research Articles",
    desc: "Deep-dive articles on rare earth magnets, hydrogen signal propagation, and decentralized networks.",
    href: "/research",
    color: "from-cyan-600/20 to-green-600/20 border-cyan-500/30",
  },
  {
    icon: "🧊",
    title: "3D Visualizer",
    desc: "Interactive 3D rendering of signal propagation, magnetic fields, and network topologies.",
    href: "/visualizer",
    color: "from-green-600/20 to-yellow-600/20 border-green-500/30",
  },
  {
    icon: "🕹️",
    title: "Infinity Game",
    desc: "Watch & Earn tokens, level up through stages (♣️♦️♥️♠️), collect stars and unlock new features.",
    href: "/game",
    color: "from-yellow-600/20 to-orange-600/20 border-yellow-500/30",
  },
];

const TECH_STACK = [
  { icon: "🧲", label: "Rare Earth Magnets", sub: "USA-made NdFeB" },
  { icon: "⚛️", label: "Hydrogen Signal", sub: "P2P propagation" },
  { icon: "📡", label: "Emitter/Receiver", sub: "Signal nodes" },
  { icon: "🌍", label: "Decentralized", sub: "No middlemen" },
  { icon: "🆓", label: "Free Forever", sub: "Open source" },
  { icon: "👑", label: "Infinity OS", sub: "Crown Protocol" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section
        className="relative overflow-hidden px-4 py-24 sm:py-32 text-center"
        aria-labelledby="hero-heading"
      >
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/40 bg-purple-900/20 text-sm text-purple-300 mb-8"
            role="note"
          >
            <Zap className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            Infinity OS v1.0 — Hydrogen Host Protocol Active
          </div>

          <h1
            id="hero-heading"
            className="text-5xl sm:text-7xl font-extrabold mb-6 tracking-tight"
          >
            <span className="shimmer-text">Infinity OS</span>
            <br />
            <span className="text-white text-3xl sm:text-5xl font-bold">
              Hydrogen Signal Network
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-purple-200/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Replace phone numbers with emoji-based 8-block identifiers.
            Communicate freely using hydrogen signal propagation — a
            peer-to-peer network powered by rare-earth magnet technology and
            open-source intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/crown-index"
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-amber-500 text-white font-bold text-lg hover:from-violet-500 hover:to-amber-400 transition-all glow-pulse"
              aria-label="Open the Crown Index repository catalog"
            >
              Open Crown Index
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>
            <Link
              href="/hydrogen-host"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-purple-500/40 text-purple-200 font-semibold hover:bg-purple-900/30 transition-all"
              aria-label="Get your free emoji identifier"
            >
              Get Your Free ID
            </Link>
            <Link
              href="/research"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-purple-500/40 text-purple-200 font-semibold hover:bg-purple-900/30 transition-all"
              aria-label="Read research articles"
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" />
              Read Research
            </Link>
          </div>
        </div>
      </section>

      {/* Emoji ID Demo */}
      <section
        className="max-w-4xl mx-auto px-4 py-12"
        aria-labelledby="demo-heading"
      >
        <h2
          id="demo-heading"
          className="text-center text-2xl font-bold text-white mb-2"
        >
          Your Emoji Device ID
        </h2>
        <p className="text-center text-purple-300/60 text-sm mb-8">
          8-block identifier — your new free phone number on the Hydrogen network
        </p>
        <div className="grid sm:grid-cols-2 gap-6">
          <EmojiIdentifier label="Default User" />
          <EmojiIdentifier
            label="Green Engineer 🌿"
            initialId={{
              blocks: ["🛸", "🟦", "🌻", "🟨", "💃", "⬜", "🐴", "🟩"],
              userId: "green-engineer",
              deviceName: "Nature Device",
              createdAt: new Date().toISOString(),
            }}
          />
        </div>
      </section>

      {/* Feature cards */}
      <section
        className="max-w-7xl mx-auto px-4 py-16"
        aria-labelledby="features-heading"
      >
        <h2
          id="features-heading"
          className="text-3xl font-bold text-center text-white mb-12"
        >
          What is Infinity OS?
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEATURE_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group glass-card rounded-2xl p-6 bg-gradient-to-br ${card.color} border hover:scale-105 transition-all duration-200`}
              aria-label={`${card.title} — ${card.desc}`}
            >
              <div className="text-4xl mb-4" aria-hidden="true">
                {card.icon}
              </div>
              <h3 className="font-bold text-white text-lg mb-2">{card.title}</h3>
              <p className="text-sm text-purple-200/70 leading-relaxed">
                {card.desc}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs text-cyan-400 group-hover:gap-2 transition-all">
                Explore
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Tech stack pills */}
      <section
        className="max-w-4xl mx-auto px-4 py-12"
        aria-labelledby="tech-heading"
      >
        <h2
          id="tech-heading"
          className="text-center text-xl font-bold text-purple-200 mb-8"
        >
          Powered By
        </h2>
        <div
          className="flex flex-wrap justify-center gap-3"
          role="list"
          aria-label="Technology stack"
        >
          {TECH_STACK.map((t) => (
            <div
              key={t.label}
              className="glass-card px-4 py-3 rounded-xl flex items-center gap-3 border border-purple-800/30"
              role="listitem"
            >
              <span className="text-2xl" aria-hidden="true">
                {t.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{t.label}</p>
                <p className="text-xs text-purple-400/60">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Game section */}
      <section
        className="max-w-4xl mx-auto px-4 py-12"
        aria-labelledby="game-heading"
      >
        <h2
          id="game-heading"
          className="text-center text-2xl font-bold text-white mb-4"
        >
          🟡 Token → 👑 Website → 🤓 Research → 🦾 Tools
        </h2>
        <p className="text-center text-purple-300/60 text-sm mb-8">
          One click at a time — adding ⚙️ development → 💰 value → 💲 assets
        </p>
        <div className="max-w-md mx-auto">
          <GameTokens />
        </div>
      </section>

      {/* How it works */}
      <section
        className="max-w-5xl mx-auto px-4 py-16"
        aria-labelledby="how-heading"
      >
        <h2
          id="how-heading"
          className="text-3xl font-bold text-center text-white mb-12"
        >
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              icon: <Globe className="w-8 h-8" aria-hidden="true" />,
              title: "Get Your Emoji ID",
              desc: "Generate a unique 8-block emoji identifier. This is your new free phone number on the Hydrogen signal network.",
            },
            {
              step: "02",
              icon: <Cpu className="w-8 h-8" aria-hidden="true" />,
              title: "Hydrogen Signal",
              desc: "Your device acts as a hydrogen signal generator, broadcasting P2P packets through the network without telecom infrastructure.",
            },
            {
              step: "03",
              icon: <Layers className="w-8 h-8" aria-hidden="true" />,
              title: "Connect Freely",
              desc: "Share your emoji ID, call anyone on the network for free. No middlemen, no subscriptions, no contracts.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="glass-card rounded-2xl p-8 text-center border border-purple-800/30"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-900/40 text-purple-400 mb-4">
                {item.icon}
              </div>
              <div className="text-xs font-mono text-cyan-500 mb-2">
                STEP {item.step}
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
              <p className="text-sm text-purple-200/60 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
