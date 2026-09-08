import { planWebsiteCapabilities, type PhiCapability } from "@/lib/capability-lattice";

export type BusinessHistorySignal = {
  query?: string;
  resolved?: string;
  kind?: string;
  at?: number;
};

export type BusinessStyleProfile = {
  fingerprint: string;
  name: string;
  layout: string;
  hero: string;
  rhythm: string;
  voice: string;
  density: string;
  historyTerms: string[];
  sectionPlan: string[];
  variationNonce: number;
  capabilityModes: string[];
  capabilities: PhiCapability[];
};

type StyleTemplate = Pick<BusinessStyleProfile, 'name' | 'layout' | 'hero' | 'rhythm' | 'voice' | 'density'>;

const STYLE_LIBRARY: StyleTemplate[] = [
  {
    name: 'Atlas Ledger',
    layout: 'wide editorial index with anchored fact rails',
    hero: 'single strong image plus concise operating statement',
    rhythm: 'large evidence block → compact cards → product grid',
    voice: 'precise, research-forward and practical',
    density: 'high information density with generous section breaks',
  },
  {
    name: 'Workshop Signal',
    layout: 'tool-bench cards with strong labels and stepwise navigation',
    hero: 'working object, process or storefront shown immediately',
    rhythm: 'problem → method → catalog → proof → action',
    voice: 'hands-on, direct and explanatory',
    density: 'medium density with large touch targets',
  },
  {
    name: 'Editorial Circuit',
    layout: 'magazine cover opening into asymmetric story columns',
    hero: 'headline-led visual spread with supporting context strip',
    rhythm: 'feature story → evidence tiles → offers → related research',
    voice: 'confident, polished and readable',
    density: 'alternates immersive spreads with short card clusters',
  },
  {
    name: 'Field Manual',
    layout: 'numbered sections, diagrams and expandable technical notes',
    hero: 'mission statement paired with a visual system map',
    rhythm: 'orientation → components → procedure → catalog → verification',
    voice: 'instructional, transparent and technical',
    density: 'high detail hidden behind progressive disclosure',
  },
  {
    name: 'Museum Grid',
    layout: 'visual collection wall with object-level captions and provenance',
    hero: 'full-bleed object or collection image',
    rhythm: 'visual gallery → featured object → story → catalog → sources',
    voice: 'curatorial, contextual and image-led',
    density: 'low text density above the fold, deeper detail below',
  },
  {
    name: 'Market Deck',
    layout: 'mobile-first storefront with category lanes and comparison cards',
    hero: 'featured offer plus store identity and trust signals',
    rhythm: 'featured item → categories → proof → catalog → checkout path',
    voice: 'clear, useful and transaction-ready without hype',
    density: 'compact product density with persistent navigation',
  },
];

const SECTION_LIBRARY = [
  'Opening visual and purpose',
  'Research-backed overview',
  'Products or services',
  'How it works',
  'Evidence and sources',
  'Materials, durability and repair',
  'Story and provenance',
  'Comparisons and decision aids',
  'Related history threads',
  'Storefront connector',
  'Wallet and ownership',
  'Contact or next action',
];

const STOP = new Set([
  'about', 'after', 'again', 'also', 'because', 'been', 'being', 'build', 'built',
  'could', 'from', 'have', 'into', 'more', 'that', 'their', 'there', 'these',
  'they', 'this', 'those', 'through', 'using', 'want', 'website', 'with', 'would',
]);

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function historyTerms(history: BusinessHistorySignal[], researchQuery: string): string[] {
  const text = [researchQuery, ...history.slice(-40).flatMap(item => [item.query || '', item.resolved || ''])]
    .join(' ')
    .toLowerCase();
  const words = text.match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
  const counts = new Map<string, number>();
  for (const word of words) {
    if (STOP.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 14)
    .map(([word]) => word);
}

function orderedSections(seed: number, siteType: string, terms: string[]): string[] {
  const scored = SECTION_LIBRARY.map((section, index) => ({
    section,
    score: hashString(`${seed}:${index}:${section}:${terms[index % Math.max(1, terms.length)] || siteType}`),
  })).sort((a, b) => a.score - b.score);

  const required = ['Opening visual and purpose', 'Products or services', 'Evidence and sources', 'Wallet and ownership'];
  const selected = [...required, ...scored.map(item => item.section)]
    .filter((section, index, all) => all.indexOf(section) === index)
    .slice(0, 9);

  if (/research|learning/i.test(siteType)) {
    const evidence = selected.indexOf('Evidence and sources');
    if (evidence > 2) {
      selected.splice(evidence, 1);
      selected.splice(2, 0, 'Evidence and sources');
    }
  }
  return selected;
}

function capabilityPlan(subject: string, siteType: string, terms: string[], seed: number) {
  const context = `${subject} ${siteType} ${terms.join(' ')}`.toLowerCase();
  const science3d = /\b(hydrogen|atom|atomic|molecule|molecular|element|material|metal|oxide|ion|electron|orbital|space|planet|machine|engine|architecture|structure|geometry|3d)\b/.test(context);
  const documentHeavy = /\b(research|learning|paper|document|history|manual|study|source|archive|book)\b/.test(context) || /research|learning/i.test(siteType);
  const explicitVideo = /\b(video|film|movie|motion|animation|tour|demo|show|music|concert)\b/.test(context);
  const explicitInteractive = /\b(interactive|tool|application|simulator|game|map|explore|model|storefront|shop|catalog)\b/.test(context) || /tool|application|product/i.test(siteType);

  // Variation changes optional media emphasis while subject-critical modes stay
  // stable. That makes repeat builds meaningfully different without routing a
  // scientific subject away from the capabilities it actually needs.
  const hasVideo = explicitVideo || seed % 5 === 0;
  const wants3d = science3d || seed % 7 === 0;
  const interactive = explicitInteractive || (wants3d && seed % 2 === 0);
  const needsSegmentation = /\b(product|object|part|component|photo|image|diagram|material)\b/.test(context) || seed % 3 === 0;

  const capabilities = planWebsiteCapabilities({
    hasImages: true,
    hasVideo,
    wants3d,
    documentHeavy,
    interactive,
    needsSegmentation,
  });

  const modes = [
    'image',
    ...(hasVideo ? ['video'] : []),
    ...(wants3d ? ['3d'] : []),
    ...(documentHeavy ? ['document'] : []),
    ...(interactive ? ['interactive'] : []),
    ...(needsSegmentation ? ['segment'] : []),
  ];

  return { capabilities, modes };
}

export function buildBusinessStyleProfile(input: {
  businessName: string;
  siteType: string;
  researchQuery: string;
  tokenId: string;
  walletId?: string | null;
  history: BusinessHistorySignal[];
  variationNonce?: number;
}): BusinessStyleProfile {
  const variationNonce = input.variationNonce || 0;
  const terms = historyTerms(input.history, input.researchQuery);
  const seedText = [
    input.businessName.trim().toLowerCase(),
    input.siteType,
    input.researchQuery.trim().toLowerCase(),
    input.tokenId,
    input.walletId || '',
    terms.join('|'),
    String(variationNonce),
  ].join('::');
  const seed = hashString(seedText);
  const template = STYLE_LIBRARY[seed % STYLE_LIBRARY.length];
  const fingerprint = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${seed.toString(36)}-${variationNonce.toString(36)}`;
  const routed = capabilityPlan(input.researchQuery, input.siteType, terms, seed);

  return {
    ...template,
    fingerprint,
    historyTerms: terms,
    sectionPlan: orderedSections(seed, input.siteType, terms),
    variationNonce,
    capabilityModes: routed.modes,
    capabilities: routed.capabilities,
  };
}
