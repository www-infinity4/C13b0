import {
  repositoryInventory,
  repositoryInventoryCount,
  repositoryRealmGroups,
} from './repository-inventory';

export type CrownType =
  | 'website' | 'repository' | 'research' | 'tool' | 'world'
  | 'star-coin' | 'avatar-coin' | 'trading-card' | 'creator';

export type CrownSource = {
  label: string;
  url?: string;
  authority: number;
  local?: boolean;
};

export type CrownRecord = {
  id: string;
  type: CrownType;
  title: string;
  summary: string;
  tags: string[];
  sources: CrownSource[];
  freshness: number;
  originality: number;
  provenance: number;
  security: number;
  community: number;
  starQuest: boolean;
  buildable: boolean;
  verified: boolean;
  owner?: string;
  edition?: string;
  realm?: string;
  realmId?: string;
  priority?: 'core' | 'active' | 'preserve';
  inventoryOrder?: number;
};

export type CrownRankMode =
  | 'best' | 'trusted' | 'new' | 'original' | 'starquest' | 'network';

export type RankedCrownRecord = CrownRecord & {
  score: number;
  scoreExplanation: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function tokenSet(value: string): Set<string> {
  return new Set(
    value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(word => word.length > 1)
  );
}

function relevance(query: string, record: CrownRecord): number {
  const q = tokenSet(query);
  if (!q.size) return 0.5;
  const haystack = tokenSet(
    [record.title, record.summary, record.realm ?? '', ...record.tags].join(' ')
  );
  let matches = 0;
  q.forEach(token => { if (haystack.has(token)) matches += 1; });
  return clamp(matches / q.size);
}

function trust(record: CrownRecord): number {
  const sourceTrust = record.sources.length
    ? record.sources.reduce((sum, source) => sum + clamp(source.authority), 0) / record.sources.length
    : 0;
  return clamp(sourceTrust * 0.55 + record.provenance * 0.3 + (record.verified ? 0.15 : 0));
}

export function rankCrownRecord(
  query: string,
  record: CrownRecord,
  mode: CrownRankMode = 'best'
): RankedCrownRecord {
  const rel = relevance(query, record);
  const trusted = trust(record);
  const relationship = record.sources.some(source => source.local) ? 1 : 0.45;

  const weights: Record<CrownRankMode, Record<string, number>> = {
    best: { rel: .30, trusted: .16, provenance: .12, freshness: .10, originality: .08, relationship: .08, security: .05, community: .05, star: .06 },
    trusted: { rel: .18, trusted: .34, provenance: .20, freshness: .05, originality: .05, relationship: .06, security: .09, community: .01, star: .02 },
    new: { rel: .22, trusted: .12, provenance: .08, freshness: .35, originality: .08, relationship: .05, security: .04, community: .03, star: .03 },
    original: { rel: .20, trusted: .13, provenance: .15, freshness: .07, originality: .30, relationship: .05, security: .04, community: .03, star: .03 },
    starquest: { rel: .20, trusted: .14, provenance: .14, freshness: .06, originality: .08, relationship: .08, security: .05, community: .05, star: .20 },
    network: { rel: .22, trusted: .14, provenance: .12, freshness: .07, originality: .07, relationship: .25, security: .05, community: .03, star: .05 }
  };

  const w = weights[mode];
  const score = clamp(
    rel * w.rel + trusted * w.trusted + record.provenance * w.provenance +
    record.freshness * w.freshness + record.originality * w.originality +
    relationship * w.relationship + record.security * w.security +
    record.community * w.community + (record.starQuest ? 1 : 0) * w.star
  );

  const explanation = [
    `Relevance ${Math.round(rel * 100)}%`,
    `Trust ${Math.round(trusted * 100)}%`,
    `Provenance ${Math.round(record.provenance * 100)}%`,
    record.starQuest ? 'StarQuest compatible' : 'General Crown record',
    record.sources.some(source => source.local) ? 'Infinity network source' : 'External source'
  ];

  return { ...record, score, scoreExplanation: explanation };
}

export function searchCrown(
  query: string,
  records: CrownRecord[],
  mode: CrownRankMode = 'best',
  type: CrownType | 'all' = 'all',
  realm: string | 'all' = 'all'
): RankedCrownRecord[] {
  return records
    .filter(record => type === 'all' || record.type === type)
    .filter(record => realm === 'all' || record.realmId === realm)
    .map(record => rankCrownRecord(query, record, mode))
    .filter(record => !query.trim() || record.score > 0.08)
    .sort((a, b) => {
      if (!query.trim()) {
        const aRepository = a.type === 'repository' ? 0 : 1;
        const bRepository = b.type === 'repository' ? 0 : 1;
        if (aRepository !== bRepository) return aRepository - bRepository;
        if (a.type === 'repository' && b.type === 'repository') {
          return (a.inventoryOrder ?? Number.MAX_SAFE_INTEGER)
            - (b.inventoryOrder ?? Number.MAX_SAFE_INTEGER);
        }
      }
      return b.score - a.score;
    });
}

const starQuestRealms = new Set([
  'core-infinity-platform',
  'games-emulation-and-3d-worlds',
  'coins-tokens-and-economy',
]);

export const repositoryCrownRecords: CrownRecord[] = repositoryInventory.map(
  (repository, inventoryOrder) => ({
    id: `repository:${repository.fullName}`,
    type: 'repository',
    title: repository.name,
    summary: repository.summary,
    tags: [
      'repository',
      repository.name,
      repository.fullName,
      repository.realm,
      repository.realmId,
      repository.priority,
    ],
    sources: [{
      label: 'Live GitHub repository',
      url: repository.url,
      authority: 1,
      local: true,
    }],
    freshness: .9,
    originality: repository.priority === 'core' ? .9 : .78,
    provenance: 1,
    security: .55,
    community: .45,
    starQuest: starQuestRealms.has(repository.realmId),
    buildable: true,
    verified: true,
    owner: 'www-infinity4',
    realm: repository.realm,
    realmId: repository.realmId,
    priority: repository.priority,
    inventoryOrder,
  })
);

export const conceptSeeds: CrownRecord[] = [
  {
    id: 'crown:c13b0', type: 'repository', title: 'C13b0 Machine',
    summary: 'Next.js machine combining deterministic generation, token input, visualizers, research, and Crown Index.',
    tags: ['c13b0','machine','generator','search','crown index'],
    sources: [{ label: 'Local repository', authority: 1, local: true }],
    freshness: .95, originality: .94, provenance: 1, security: .82, community: .55,
    starQuest: true, buildable: true, verified: true, owner: 'Kris Watson',
    realm: 'Core Infinity Platform', realmId: 'core-infinity-platform'
  },
  {
    id: 'crown:starquest', type: 'world', title: 'StarQuest',
    summary: 'Connected world system using Crown identities, Star Coins, Avatar Coins, achievements, scenes, and persistent wallet links.',
    tags: ['starquest','world','avatar','coin','identity'],
    sources: [{ label: 'Infinity conversation architecture', authority: .95, local: true }],
    freshness: .9, originality: .96, provenance: .9, security: .78, community: .68,
    starQuest: true, buildable: true, verified: true, owner: 'Kris Watson'
  },
  {
    id: 'coin:star:001', type: 'star-coin', title: 'Star Coin Identity',
    summary: 'Persistent Crown identity for a creator, character, world, project, or achievement.',
    tags: ['star coin','identity','creator','world','provenance'],
    sources: [{ label: 'Crown Index recovery record', authority: .95, local: true }],
    freshness: .9, originality: .9, provenance: .94, security: .86, community: .62,
    starQuest: true, buildable: true, verified: true, edition: 'System definition'
  },
  {
    id: 'coin:avatar:001', type: 'avatar-coin', title: 'Avatar Coin Identity',
    summary: 'User-controlled visual identity with version history, world membership, wallet destination, and recovery events.',
    tags: ['avatar coin','avatar','wallet','identity','starquest'],
    sources: [{ label: 'Crown Index recovery record', authority: .95, local: true }],
    freshness: .9, originality: .91, provenance: .94, security: .9, community: .7,
    starQuest: true, buildable: true, verified: true, edition: 'System definition'
  },
  {
    id: 'tool:builder', type: 'tool', title: 'Infinity Builder Agent',
    summary: 'Turns Crown evidence bundles into reviewed websites, tools, research pages, stores, and StarQuest worlds.',
    tags: ['builder','website','tool','research','AI generation'],
    sources: [{ label: 'Multi-agent architecture', authority: .9, local: true }],
    freshness: .84, originality: .85, provenance: .88, security: .8, community: .6,
    starQuest: true, buildable: true, verified: true
  },
  {
    id: 'research:watson', type: 'research', title: 'Watson Particle Research',
    summary: 'Indexed research papers, diagrams, calculation tools, and simulations in the Infinity Quantum System.',
    tags: ['watson particle','quantum','research','visualizer'],
    sources: [{ label: 'Infinity Quantum Systems', authority: .86, local: true }],
    freshness: .88, originality: .92, provenance: .84, security: .8, community: .57,
    starQuest: false, buildable: true, verified: true
  }
];

export const crownSeeds: CrownRecord[] = [
  ...repositoryCrownRecords,
  ...conceptSeeds,
];

export {
  repositoryInventory,
  repositoryInventoryCount,
  repositoryRealmGroups,
};
