import {
  bitcoinCrusherPlan,
  canPublish,
  createBuilderPlan,
  domainCandidate,
  suggestPublicIdentity,
  SiteScan,
} from '../auto-builder';

describe('Infinity Auto Builder', () => {
  test('creates a clean public domain candidate without renaming the repository', () => {
    const identity = suggestPublicIdentity({
      repositoryFullName: 'www-infinity4/Bitcoin-Crusher',
      productName: 'Bitcoin Crusher',
    });

    expect(identity.repositoryFullName).toBe('www-infinity4/Bitcoin-Crusher');
    expect(identity.productName).toBe('Bitcoin Crusher');
    expect(identity.suggestedDomain).toBe('BitcoinCrusher.com');
    expect(domainCandidate('New Hope')).toBe('NewHope.com');
  });

  test('prioritizes blockers before improvements', () => {
    const scan: SiteScan = {
      repositoryFullName: 'www-infinity4/example',
      scannedRef: 'main',
      scannedAt: '2026-08-06T00:00:00.000Z',
      maturity: 'prototype',
      score: 30,
      routes: ['/'],
      buildCommands: [],
      dependencies: [],
      deploymentUrls: [],
      findings: [
        { id: 'later', area: 'content', severity: 'opportunity', title: 'Add page', detail: 'Add depth', evidence: [], suggestedStage: 'fatten' },
        { id: 'first', area: 'security', severity: 'blocker', title: 'Remove secret', detail: 'Credential exposed', evidence: [], suggestedStage: 'verify' },
      ],
    };

    expect(createBuilderPlan(scan).actions.map(action => action.priority)).toEqual(['P0', 'P3']);
  });

  test('never publishes without every validation and owner approval', () => {
    const valid = {
      plan: bitcoinCrusherPlan,
      testsPassed: true,
      buildPassed: true,
      browserPassed: true,
      securityReviewed: true,
      ownerApproved: true,
    };

    expect(canPublish(valid)).toBe(true);
    expect(canPublish({ ...valid, ownerApproved: false })).toBe(false);
    expect(canPublish({ ...valid, browserPassed: false })).toBe(false);
    expect(bitcoinCrusherPlan.publishPolicy).toBe('review-required');
  });
});
