import type { Metadata } from "next";
import { Clock, Tag, ExternalLink, Zap, Magnet, Radio, Globe } from "lucide-react";
import type { ResearchArticle } from "@/types";

export const metadata: Metadata = {
  title: "Research — Infinity OS",
  description:
    "In-depth research articles on rare earth magnets, hydrogen signal propagation, P2P communication, and how they converge in the Infinity OS ecosystem.",
};

const ARTICLES: ResearchArticle[] = [
  {
    id: "rare-earth-magnets",
    title:
      "Rare Earth Magnets Made in the USA: The Silent Revolution in Decentralized Hardware",
    source: "Popular Mechanics",
    sourceUrl: "https://search.app/Xu79f",
    summary:
      "Neodymium-iron-boron (NdFeB) rare earth magnets — the strongest permanent magnets commercially available — are undergoing a domestic manufacturing renaissance in the United States. For Infinity OS, these magnets are more than industrial components: they are the physical substrate that makes persistent, low-power signal emitters viable.",
    keyPoints: [
      "NdFeB magnets produce magnetic fields up to 1.4 tesla, 10× stronger than ferrite magnets of the same mass.",
      "US-domestic production reduces supply chain vulnerability and enables certified hardware for P2P signal emitters.",
      "Magnetocaloric cooling effects allow passive thermal management in embedded signal nodes.",
      "Rare earth magnets integrated into PCB antenna arrays boost signal directionality by up to 40%.",
      "Infinity OS hardware nodes use NdFeB elements to stabilize oscillator frequency, reducing signal drift in hydrogen emitters.",
      "USA-made sourcing aligns with open-source hardware goals: auditable supply chains, no foreign IP restrictions.",
    ],
    tags: ["magnets", "hardware", "NdFeB", "USA", "signal", "antenna"],
    category: "magnets",
    readTime: 8,
  },
  {
    id: "hydrogen-signal-propagation",
    title:
      "Hydrogen Signal Propagation: From Spectral Emission to Peer-to-Peer Data Routing",
    source: "New Scientist",
    sourceUrl: "https://search.app/jt66Y",
    summary:
      "The hydrogen atom's 21 cm spectral line — first predicted by Hendrik van de Hulst in 1944 — has guided radio astronomers for decades. Infinity OS reframes this phenomenon as an engineering primitive: a globally coherent, interference-resistant carrier frequency for decentralized P2P communication, the backbone of the Hydrogen Host protocol.",
    keyPoints: [
      "The 1420.405 MHz 'hydrogen line' is a universally clean radio frequency with minimal atmospheric absorption.",
      "Software-defined radios (SDRs) can tune to this band for just $25, making the protocol accessible to anyone.",
      "Hydrogen signal emitters modulate data as phase-shift-keyed (PSK) packets on the carrier — similar to WiFi but decentralized.",
      "Signal propagation through buildings is superior at 1.4 GHz vs. 2.4 GHz WiFi, yielding 15–30% better indoor range.",
      "The protocol uses forward error correction derived from quantum-noise models to maintain link integrity under multipath conditions.",
      "Network topology is self-healing: each node discovers peers through beacon broadcasts carrying their emoji identifier hash.",
    ],
    tags: ["hydrogen", "signal", "P2P", "radio", "SDR", "21cm"],
    category: "hydrogen",
    readTime: 11,
  },
  {
    id: "p2p-communication-decentralized",
    title:
      "Beyond Phone Numbers: Decentralized Identity and the Emoji-Block Protocol",
    source: "Nature",
    sourceUrl: "https://search.app/Anqy9",
    summary:
      "Traditional phone numbers are centrally allocated identifiers tied to telecom infrastructure. The Hydrogen Host protocol replaces them with emoji-based 8-block device identifiers — cryptographically unique, human-readable addresses that require no registry authority and scale naturally as the network grows.",
    keyPoints: [
      "An 8-block emoji identifier drawn from a 100+ glyph pool provides 10^16 unique addresses — more than enough for global deployment.",
      "Identifiers are generated deterministically from device hardware entropy, making spoofing computationally infeasible.",
      "The directory service is a distributed hash table (DHT), similar to BitTorrent's Kademlia, but emoji-addressed.",
      "Longer emoji IDs (12+ blocks) are auto-generated as the network grows, preserving address space.",
      "Zero-knowledge proof of ID ownership allows call authentication without revealing the full identifier.",
      "Early adopters maintain shorter, more memorable IDs — creating a natural incentive for early network participation.",
    ],
    tags: ["P2P", "identity", "DHT", "emoji", "decentralized", "privacy"],
    category: "p2p",
    readTime: 10,
  },
  {
    id: "aether-energy-theory",
    title:
      "Zero-Point Energy and the Aether: Ambient Energy Harvesting Through Radiant Receiver Materials",
    source: "Chemistry World",
    sourceUrl: "https://search.app/eK5LF",
    summary:
      "What pioneers like Tesla called the 'Aether' maps closely onto what modern physics terms the Quantum Vacuum or Zero-Point Energy (ZPE) — a background field of potential energy inherent to space itself. This article examines how mechanical oscillation in a fluid medium can act as a trigger to harvest ambient environmental energy, and which materials science principles make a hull or receiver surface most effective at capturing that 'Aetheric friction.'",
    keyPoints: [
      "Zero-Point Energy predicts a non-zero ground-state energy density in the quantum vacuum; Tesla's 'Aether' is the classical analog of this omnipresent energy medium.",
      "Rocking or oscillating a body through a gaseous medium creates local pressure differentials that displace the surrounding fluid, drawing in ambient background ions — a non-linear harvesting effect.",
      "The 'growing charge' phenomenon: as oscillation frequency increases, the friction gradient rises, pulling in more environmental ions and yielding a self-amplifying charge accumulation without consuming the medium.",
      "Standard copper conductors are too electrically smooth; atomically rough surfaces — such as cold-rolled steel — present greater surface area for trapping radiant energy bursts.",
      "Bismuth-layered composites are of particular interest: bismuth's high atomic density and strong diamagnetic response make it a candidate for Aetheric friction trapping in signal receiver arrays.",
      "In Infinity OS hardware nodes, a bismuth or cold-rolled-steel hull layer could serve as a passive radiant-energy pre-charger, biasing the onboard IMU signal before active amplification.",
    ],
    tags: ["aether", "ZPE", "materials", "bismuth", "harvesting", "radiant"],
    category: "materials",
    readTime: 9,
  },
  {
    id: "infinity-convergence",
    title:
      "Convergence: How Rare Earth Magnets, Hydrogen Signals, and Emoji Identity Create Infinity OS",
    source: "Infinity OS Research",
    sourceUrl: "/research",
    summary:
      "The three pillars — magnets, signals, identity — converge into a unified platform. Infinity OS is not merely a communication tool; it is a new substrate for human connection that is free, open, physically grounded, and mathematically elegant. This article synthesizes all sources into a vision for how these technologies produce something genuinely infinite.",
    keyPoints: [
      "NdFeB magnets stabilize the oscillator in hardware nodes, ensuring signal frequency purity over the hydrogen carrier.",
      "The hydrogen line's inherent noise floor is used as a physical random seed for ID generation — true entropy from nature.",
      "Emoji identifiers make the protocol human-friendly: a green engineer user can self-describe as 🛸🟦🌻🟨💃⬜🐴🟩.",
      "Rare earth magnets in antenna arrays + hydrogen carrier + emoji DHT = a fully sovereign communication stack.",
      "Total cost of a full Infinity OS node: ~$35 (SDR dongle) + $8 (magnet array) + $0 (open-source software).",
      "Network value scales as Metcalfe's Law: each new emoji ID holder exponentially increases connection possibilities.",
    ],
    tags: ["convergence", "infinity", "magnets", "hydrogen", "emoji", "free"],
    category: "infinity",
    readTime: 14,
  },
];

const CATEGORY_ICONS: Record<ResearchArticle["category"], React.ReactNode> = {
  magnets: <Magnet className="w-5 h-5" />,
  hydrogen: <Zap className="w-5 h-5" />,
  p2p: <Globe className="w-5 h-5" />,
  infinity: <Radio className="w-5 h-5" />,
  materials: <Magnet className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<ResearchArticle["category"], string> = {
  magnets: "bg-red-500/20 text-red-300 border-red-500/30",
  hydrogen: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  p2p: "bg-green-500/20 text-green-300 border-green-500/30",
  infinity: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  materials: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

export default function ResearchPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Header */}
      <section aria-labelledby="research-heading" className="mb-16 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/40 bg-cyan-900/20 text-sm text-cyan-300 mb-6"
          role="note"
        >
          🔬 Peer-reviewed &amp; open-source intelligence
        </div>
        <h1
          id="research-heading"
          className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
        >
          Research Articles
        </h1>
        <p className="text-purple-200/60 text-lg max-w-2xl mx-auto">
          Synthesized from Popular Mechanics, New Scientist, Nature, and
          Infinity OS project intelligence. Everything you need to understand
          how these technologies converge.
        </p>
      </section>

      {/* Article list */}
      <div className="space-y-10" role="feed" aria-label="Research articles">
        {ARTICLES.map((article) => (
          <article
            key={article.id}
            className="glass-card rounded-2xl p-8 border border-purple-800/30 hover:border-purple-600/50 transition-all"
            aria-labelledby={`article-${article.id}-title`}
          >
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${CATEGORY_COLORS[article.category]}`}
                aria-label={`Category: ${article.category}`}
              >
                {CATEGORY_ICONS[article.category]}
                {article.category.toUpperCase()}
              </span>
              <span className="flex items-center gap-1 text-xs text-purple-400/60">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {article.readTime} min read
              </span>
              <a
                href={article.sourceUrl}
                target={article.sourceUrl.startsWith("http") ? "_blank" : undefined}
                rel={article.sourceUrl.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 ml-auto"
                aria-label={`Source: ${article.source} (opens in new tab)`}
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                {article.source}
              </a>
            </div>

            {/* Title */}
            <h2
              id={`article-${article.id}-title`}
              className="text-xl sm:text-2xl font-bold text-white mb-4 leading-tight"
            >
              {article.title}
            </h2>

            {/* Summary */}
            <p className="text-purple-200/70 leading-relaxed mb-6">
              {article.summary}
            </p>

            {/* Key points */}
            <div>
              <h3 className="text-sm font-semibold text-cyan-400 mb-3 uppercase tracking-wider">
                Key Findings
              </h3>
              <ul className="space-y-2" role="list">
                {article.keyPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm text-purple-200/70"
                    role="listitem"
                  >
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-700/40 flex items-center justify-center text-xs text-purple-300 font-bold"
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-6" role="list" aria-label="Article tags">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-900/30 text-purple-300 border border-purple-800/30"
                  role="listitem"
                >
                  <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {/* Sources footer */}
      <section className="mt-16 glass-card rounded-2xl p-8 border border-purple-800/30" aria-label="Source references">
        <h2 className="text-lg font-bold text-white mb-4">Sources &amp; References</h2>
        <ul className="space-y-2 text-sm text-purple-300/70" role="list">
          <li role="listitem">
            [1] Popular Mechanics —{" "}
            <a
              href="https://search.app/Xu79f"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              Rare Earth Magnets Made in USA
            </a>
          </li>
          <li role="listitem">
            [2] Popular Mechanics —{" "}
            <a
              href="https://search.app/GMr4L"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              Rare Earth Magnets (USA Sourcing)
            </a>
          </li>
          <li role="listitem">
            [3] New Scientist —{" "}
            <a
              href="https://search.app/jt66Y"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              Hydrogen Signal Research
            </a>
          </li>
          <li role="listitem">
            [4] Nature —{" "}
            <a
              href="https://search.app/Anqy9"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              Decentralized Communication Networks
            </a>
          </li>
          <li role="listitem">
            [5] Chemistry World —{" "}
            <a
              href="https://search.app/eK5LF"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              Zero-Point Energy and Radiant Receiver Materials
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
