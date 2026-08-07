export type SiteMaturity = 'prototype' | 'functional' | 'polished' | 'production';
export type BuilderStage = 'scan' | 'shape' | 'fatten' | 'format' | 'verify' | 'publish';
export type BuilderPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type BuilderArea =
  | 'identity' | 'content' | 'navigation' | 'layout' | 'features'
  | 'accessibility' | 'performance' | 'security' | 'deployment' | 'provenance';

export interface PublicSiteIdentity {
  repositoryFullName: string;
  productName: string;
  suggestedDomain: string;
  domainStatus: 'suggested' | 'owned' | 'connected' | 'verified';
  aliases: string[];
  tagline: string;
  publicPath: string;
}

export interface BuilderFinding {
  id: string;
  area: BuilderArea;
  severity: 'blocker' | 'major' | 'minor' | 'opportunity';
  title: string;
  detail: string;
  evidence: string[];
  suggestedStage: BuilderStage;
}

export interface SiteScan {
  repositoryFullName: string;
  scannedRef: string;
  scannedAt: string;
  maturity: SiteMaturity;
  score: number;
  routes: string[];
  buildCommands: string[];
  dependencies: string[];
  deploymentUrls: string[];
  findings: BuilderFinding[];
}

export interface BuilderAction {
  id: string;
  priority: BuilderPriority;
  stage: BuilderStage;
  area: BuilderArea;
  title: string;
  acceptance: string[];
  requiresReview: boolean;
  sourceFindingId: string;
}

export interface BuilderPlan {
  repositoryFullName: string;
  targetMaturity: SiteMaturity;
  identity: PublicSiteIdentity;
  actions: BuilderAction[];
  generatedAt: string;
  publishPolicy: 'review-required';
}

const severityPriority: Record<BuilderFinding['severity'], BuilderPriority> = {
  blocker: 'P0',
  major: 'P1',
  minor: 'P2',
  opportunity: 'P3',
};

const priorityOrder: Record<BuilderPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export function domainCandidate(productName: string): string {
  const compact = productName.replace(/[^a-z0-9]/gi, '');
  return `${compact || 'InfinitySite'}.com`;
}

export function suggestPublicIdentity(input: {
  repositoryFullName: string;
  productName?: string;
  tagline?: string;
}): PublicSiteIdentity {
  const repositoryName = input.repositoryFullName.split('/').pop() || 'Infinity Site';
  const productName = input.productName ?? repositoryName.replace(/[-_]+/g, ' ').trim();
  const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return {
    repositoryFullName: input.repositoryFullName,
    productName,
    suggestedDomain: domainCandidate(productName),
    domainStatus: 'suggested',
    aliases: [repositoryName, productName, domainCandidate(productName)],
    tagline: input.tagline ?? 'Built and continuously improved through the Infinity Builder.',
    publicPath: `/sites/${slug}`,
  };
}

function acceptanceFor(finding: BuilderFinding): string[] {
  const base = [
    `Resolve: ${finding.detail}`,
    'Add automated coverage where the behavior can be tested.',
    'Record the changed files and validation evidence.',
  ];

  if (finding.area === 'accessibility') {
    base.push('Verify keyboard operation, readable contrast, labels, and mobile text sizing.');
  }
  if (finding.area === 'security') {
    base.push('Complete a security review before the change can be published.');
  }
  if (finding.area === 'deployment') {
    base.push('Verify the public route in a real browser after deployment.');
  }
  return base;
}

export function createBuilderPlan(
  scan: SiteScan,
  identity = suggestPublicIdentity({ repositoryFullName: scan.repositoryFullName })
): BuilderPlan {
  const actions = scan.findings
    .map((finding): BuilderAction => ({
      id: `action:${finding.id}`,
      priority: severityPriority[finding.severity],
      stage: finding.suggestedStage,
      area: finding.area,
      title: finding.title,
      acceptance: acceptanceFor(finding),
      requiresReview: true,
      sourceFindingId: finding.id,
    }))
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    repositoryFullName: scan.repositoryFullName,
    targetMaturity: 'production',
    identity,
    actions,
    generatedAt: scan.scannedAt,
    publishPolicy: 'review-required',
  };
}

export function nextBuilderStage(plan: BuilderPlan): BuilderStage {
  return plan.actions[0]?.stage ?? 'verify';
}

export function canPublish(input: {
  plan: BuilderPlan;
  testsPassed: boolean;
  buildPassed: boolean;
  browserPassed: boolean;
  securityReviewed: boolean;
  ownerApproved: boolean;
}): boolean {
  return (
    input.plan.publishPolicy === 'review-required' &&
    input.testsPassed &&
    input.buildPassed &&
    input.browserPassed &&
    input.securityReviewed &&
    input.ownerApproved
  );
}

export const bitcoinCrusherIdentity = suggestPublicIdentity({
  repositoryFullName: 'www-infinity4/Bitcoin-Crusher',
  productName: 'Bitcoin Crusher',
  tagline: 'Turn a question into sourced research, a durable record, and a growing knowledge network.',
});

export const bitcoinCrusherScan: SiteScan = {
  repositoryFullName: 'www-infinity4/Bitcoin-Crusher',
  scannedRef: 'main',
  scannedAt: '2026-08-06T00:00:00.000Z',
  maturity: 'functional',
  score: 64,
  routes: ['/', '/research-workspace.html', '/token-network.html'],
  buildCommands: ['Static site: no build command required'],
  dependencies: ['Browser JavaScript', 'OpenAlex', 'Crossref'],
  deploymentUrls: ['GitHub Pages URL requires owner/path verification'],
  findings: [
    {
      id: 'bitcoin-owner-links',
      area: 'provenance',
      severity: 'blocker',
      title: 'Correct legacy repository and Pages links',
      detail: 'The current page still points to the earlier www-infinity owner instead of www-infinity4.',
      evidence: ['index.html navigation links', 'admin owner placeholder'],
      suggestedStage: 'verify',
    },
    {
      id: 'bitcoin-public-name',
      area: 'identity',
      severity: 'major',
      title: 'Separate the polished public identity from the repository slug',
      detail: 'Present Bitcoin Crusher consistently and treat BitcoinCrusher.com as a domain suggestion until ownership and DNS are verified.',
      evidence: ['repository name Bitcoin-Crusher', 'mixed title and Infinity Slot Machine labels'],
      suggestedStage: 'shape',
    },
    {
      id: 'bitcoin-navigation',
      area: 'navigation',
      severity: 'major',
      title: 'Turn research tools into a coherent product journey',
      detail: 'Connect search, evidence review, article storage, brain catalog, and token history with clear next actions.',
      evidence: ['separate research workspace', 'token network', 'session history'],
      suggestedStage: 'fatten',
    },
    {
      id: 'bitcoin-mobile',
      area: 'layout',
      severity: 'minor',
      title: 'Complete mobile and desktop browser validation',
      detail: 'Verify reels, research panels, modals, drawer navigation, and long articles without clipped controls.',
      evidence: ['large single-page interface', 'modal-heavy workflow'],
      suggestedStage: 'format',
    },
    {
      id: 'bitcoin-deployment',
      area: 'deployment',
      severity: 'minor',
      title: 'Record and verify the canonical deployment',
      detail: 'Connect the verified public domain or Pages URL and add it to Crown Index.',
      evidence: ['deployment URL not verified by scanner'],
      suggestedStage: 'publish',
    },
  ],
};

export const bitcoinCrusherPlan = createBuilderPlan(
  bitcoinCrusherScan,
  bitcoinCrusherIdentity
);
