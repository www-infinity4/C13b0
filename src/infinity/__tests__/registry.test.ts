import { portals, repositoryRegistry } from '../portal-registry';
import { canExposeParticipationRecord, createReversibleVersion } from '../user-data-model';

describe('Infinity portal registry', () => {
  test('uses unique portal IDs and routes', () => {
    expect(new Set(portals.map(portal => portal.id)).size).toBe(portals.length);
    expect(new Set(portals.map(portal => portal.route)).size).toBe(portals.length);
  });

  test('keeps Mario Spin and Bitcoin Crusher prominent and expandable', () => {
    const mario = portals.find(portal => portal.id === 'mario-spin');
    const crusher = portals.find(portal => portal.id === 'bitcoin-crusher');
    expect(mario?.scale).toBe('hero');
    expect(mario?.expandable).toBe(true);
    expect(crusher?.scale).toBe('large');
    expect(crusher?.expandable).toBe(true);
  });

  test('treats Spacebook as a Synapses extension pending distinct-purpose review', () => {
    const spacebook = portals.find(portal => portal.id === 'spacebook');
    expect(spacebook?.parentPortal).toBe('infinity-synapses');
    expect(spacebook?.repositoryDecision).toBe('merge-purpose');
    expect(spacebook?.status).toBe('preservation-review');
  });

  test('does not archive a repository before preservation', () => {
    const invalid = repositoryRegistry.filter(record =>
      record.decision === 'archive-after-preservation' &&
      !['preserved', 'verified'].includes(record.preservationState)
    );
    expect(invalid).toEqual([]);
  });
});

describe('shared user-data rules', () => {
  test('requires a complete verified participation proof', () => {
    expect(canExposeParticipationRecord({
      provider: 'infinity',
      recordId: 'INF-123',
      verifiedAt: '2026-08-05T13:00:00.000Z',
      verifier: 'crown-index',
    })).toBe(true);

    expect(canExposeParticipationRecord({
      provider: 'git-coin',
      recordId: '',
      verifiedAt: '2026-08-05T13:00:00.000Z',
      verifier: 'gitpal',
    })).toBe(false);
  });

  test('creates parent-linked reversible versions', () => {
    const version = createReversibleVersion({
      entityId: 'portal:mario-spin',
      parentVersionId: 'portal:mario-spin:v1',
      createdBy: 'gitpal',
      reason: 'Add portal registry',
      snapshot: { enabled: true },
      checksum: 'abc123',
      now: '2026-08-05T13:00:00.000Z',
    });
    expect(version.reversible).toBe(true);
    expect(version.parentVersionId).toBe('portal:mario-spin:v1');
    expect(version.versionId).toContain('portal:mario-spin');
  });
});
