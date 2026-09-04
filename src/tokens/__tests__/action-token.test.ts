import {
  actionColor,
  canBuildPage,
  compilePageIntent,
  createActionToken,
} from '../action-token';

const baseToken = createActionToken({
  id: 'GKKGKGXDGKXGKGXGXK',
  value: 1,
  kind: 'build',
  status: 'token-generated',
  occurredAt: '2026-08-23T22:30:00.000Z',
  actorId: 'kris',
  repository: 'www-infinity4/C13b0',
  pagePath: '/research/action-tokens',
  inputSummary: 'Turn every useful conversation action into a connected page.',
});

describe('action tokens', () => {
  test('uses the established color routing', () => {
    expect(actionColor).toEqual({
      'chat-input': 'blue',
      search: 'pink',
      research: 'yellow',
      import: 'blue',
      decision: 'orange',
      route: 'red',
      build: 'green',
      publish: 'purple',
    });
  });

  test('does not build directly from an unprocessed input', () => {
    expect(canBuildPage({ ...baseToken, status: 'input' })).toBe(false);
  });

  test('updates the same machine when its repository route already exists', () => {
    const existing = new Set(['www-infinity4/c13b0:/research/action-tokens']);
    expect(compilePageIntent(baseToken, existing).updateMode).toBe('update');
  });

  test('carries parent tokens into page provenance', () => {
    const intent = compilePageIntent({ ...baseToken, parentTokenIds: ['search-1', 'decision-1'] });
    expect(intent.sourceTokenIds).toEqual([baseToken.id, 'search-1', 'decision-1']);
  });
});

