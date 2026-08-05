export type RepositoryDecision = 'strengthen' | 'merge-purpose' | 'archive-after-preservation' | 'review-pending';
export type PortalScale = 'hero' | 'large' | 'wide' | 'compact' | 'utility';
export type PortalStatus = 'active' | 'partial' | 'planned' | 'preservation-review';

export interface ParticipationProof {
  provider: 'git-coin' | 'infinity';
  recordId: string;
  verifiedAt: string;
  verifier: string;
}

export interface InfinityPortal {
  id: string;
  title: string;
  purpose: string;
  route: string;
  scale: PortalScale;
  status: PortalStatus;
  accent: string;
  services: string[];
  repositoryDecision: RepositoryDecision;
  parentPortal?: string;
  expandable: boolean;
  provenance: string[];
}

export const portals: InfinityPortal[] = [
  {
    id: 'mario-spin',
    title: 'Mario Spin',
    purpose: 'Cartoon-oriented interactive portal using the C13b0 cartoon engine, storyboards, audio, physics, lighting, patterns, and export systems.',
    route: '/mario-spin',
    scale: 'hero',
    status: 'partial',
    accent: 'from-red-500 via-amber-400 to-sky-500',
    services: ['cartoon-engine', 'shared-game-service', 'shared-media-service', 'star-editor', 'version-history'],
    repositoryDecision: 'strengthen',
    expandable: true,
    provenance: ['C13b0/cartoon-engine', 'Infinity Repo Distillation directive'],
  },
  {
    id: 'bitcoin-crusher',
    title: 'Bitcoin Crusher',
    purpose: 'A short intermission experience for movies and shows. Participation records must be verified through Git Coin or Infinity before rewards or public credit are displayed.',
    route: '/bitcoin-crusher',
    scale: 'large',
    status: 'planned',
    accent: 'from-amber-400 via-orange-500 to-fuchsia-600',
    services: ['participation-proof', 'shared-game-service', 'shared-media-service', 'reversible-session-log'],
    repositoryDecision: 'strengthen',
    expandable: true,
    provenance: ['Infinity Repo Distillation directive'],
  },
  {
    id: 'infinity-synapses',
    title: 'Infinity Synapses',
    purpose: 'Connected media, ideas, people, signals, and project relationships.',
    route: '/synapses',
    scale: 'wide',
    status: 'planned',
    accent: 'from-violet-600 via-blue-500 to-cyan-400',
    services: ['relationship-graph', 'shared-media-service', 'crown-index', 'encrypted-user-data'],
    repositoryDecision: 'strengthen',
    expandable: true,
    provenance: ['Infinity architecture recovery'],
  },
  {
    id: 'spacebook',
    title: 'Spacebook',
    purpose: 'TV and video extension of Infinity Synapses. It remains a child portal unless repository review establishes a distinct independent purpose.',
    route: '/synapses/spacebook',
    scale: 'compact',
    status: 'preservation-review',
    accent: 'from-slate-800 via-indigo-700 to-violet-500',
    services: ['shared-media-service', 'watch-history', 'participation-proof'],
    repositoryDecision: 'merge-purpose',
    parentPortal: 'infinity-synapses',
    expandable: true,
    provenance: ['Infinity Repo Distillation directive'],
  },
  {
    id: 'crown-index',
    title: 'Crown Index',
    purpose: 'Discovery, provenance, identity, ranking, repository relationships, and build history.',
    route: '/crown-index',
    scale: 'large',
    status: 'partial',
    accent: 'from-yellow-300 via-amber-500 to-purple-700',
    services: ['repository-registry', 'provenance', 'identity', 'ranking-explanation'],
    repositoryDecision: 'strengthen',
    expandable: true,
    provenance: ['C13b0 Crown Index architecture'],
  },
  {
    id: 'gitpal-gitpub',
    title: 'Gitpal / Gitpub Engineer Station',
    purpose: 'Engineering station for repository review, preservation, reversible changes, branch work, tests, and merge proposals.',
    route: '/engineer-station',
    scale: 'utility',
    status: 'planned',
    accent: 'from-emerald-500 via-cyan-500 to-blue-700',
    services: ['gitpal', 'gitpub', 'branch-manager', 'test-reporter', 'preservation-bundle'],
    repositoryDecision: 'strengthen',
    expandable: true,
    provenance: ['Infinity Repo Distillation directive'],
  },
];

export interface RepositoryRegistryRecord {
  repository: string;
  decision: RepositoryDecision;
  survivingPurpose: string;
  destinationPortal: string;
  uniqueAssets: string[];
  preservationState: 'not-started' | 'inventory-created' | 'preserved' | 'verified';
  implementationState: 'not-reviewed' | 'reviewed' | 'branch-created' | 'implemented' | 'tested' | 'merge-proposed';
  notes: string[];
}

export const repositoryRegistry: RepositoryRegistryRecord[] = [
  {
    repository: 'www-infinity4/C13b0',
    decision: 'strengthen',
    survivingPurpose: 'Central Infinity index, Crown registry, cartoon engine, portal host, and shared service integration.',
    destinationPortal: 'crown-index',
    uniqueAssets: ['cartoon-engine', 'machine atlas', 'Crown Index architecture', 'helper carts', 'science recovery documents'],
    preservationState: 'inventory-created',
    implementationState: 'implemented',
    notes: ['Central portal registry added on agent/crown-index-backbone.', 'No merge proposed until build and tests run successfully.'],
  },
  {
    repository: 'Spacebook repository not yet identified',
    decision: 'merge-purpose',
    survivingPurpose: 'TV/video surface for Infinity Synapses.',
    destinationPortal: 'infinity-synapses',
    uniqueAssets: [],
    preservationState: 'not-started',
    implementationState: 'not-reviewed',
    notes: ['Do not archive or merge code until the actual repository is inspected.'],
  },
];
