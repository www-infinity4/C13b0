import {
  ActionEngine,
  type ActionEngineStore,
  type BuildReceipt,
  type PageBuildJob,
} from '../action-engine';
import type { ActionToken } from '../action-token';

class MemoryStore implements ActionEngineStore {
  tokens = new Map<string, ActionToken>();
  machines = new Set<string>();
  jobs: PageBuildJob[] = [];
  receipts: BuildReceipt[] = [];

  async findTokenByIdempotencyKey(key: string) { return this.tokens.get(key); }
  async appendToken(key: string, token: ActionToken) { this.tokens.set(key, token); }
  async machineExists(machineId: string) { return this.machines.has(machineId); }
  async enqueueBuild(job: PageBuildJob) { this.jobs.push(job); }
  async appendReceipt(receipt: BuildReceipt) { this.receipts.push(receipt); }
}

const intake = {
  id: 'token-1',
  idempotencyKey: 'conversation-1:message-1',
  kind: 'build' as const,
  occurredAt: '2026-08-23T23:30:00.000Z',
  actorId: 'kris',
  repository: 'www-infinity4/C13b0',
  pagePath: '/research/token-1',
  inputSummary: 'Build a connected research page from this conversation.',
};

describe('ActionEngine', () => {
  test('appends a token and queues one review-gated page build', async () => {
    const store = new MemoryStore();
    const result = await new ActionEngine(store).ingest(intake);

    expect(result.duplicate).toBe(false);
    expect(result.buildJob).toMatchObject({ status: 'queued', approvalRequired: true });
    expect(store.tokens.size).toBe(1);
    expect(store.jobs).toHaveLength(1);
  });

  test('returns the original result without duplicating work on retry', async () => {
    const store = new MemoryStore();
    const engine = new ActionEngine(store);
    await engine.ingest(intake);
    const retry = await engine.ingest(intake);

    expect(retry.duplicate).toBe(true);
    expect(store.tokens.size).toBe(1);
    expect(store.jobs).toHaveLength(1);
  });

  test('updates an existing repository route instead of creating a duplicate machine', async () => {
    const store = new MemoryStore();
    store.machines.add('www-infinity4/c13b0:/research/token-1');
    const result = await new ActionEngine(store).ingest(intake);
    expect(result.buildJob?.updateMode).toBe('update');
  });

  test('will not claim publication without a commit receipt', async () => {
    const store = new MemoryStore();
    const engine = new ActionEngine(store);
    await expect(engine.recordReceipt({
      id: 'receipt-1',
      actionTokenId: 'token-1',
      buildJobId: 'build:token-1',
      createdAt: intake.occurredAt,
      outcome: 'published',
      checks: [{ name: 'tests', passed: true }],
    })).rejects.toThrow('commit SHA');
  });
});

