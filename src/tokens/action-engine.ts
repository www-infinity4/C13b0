import {
  canBuildPage,
  compilePageIntent,
  createActionToken,
  type ActionKind,
  type ActionStatus,
  type ActionToken,
  type PageBuildIntent,
} from './action-token';

export interface ActionIntake {
  id: string;
  idempotencyKey: string;
  value?: number;
  kind: ActionKind;
  occurredAt: string;
  actorId: string;
  conversationId?: string;
  parentTokenIds?: string[];
  repository?: string;
  pagePath?: string;
  inputSummary: string;
  sourceUrls?: string[];
  outputSummary?: string;
  status?: ActionStatus;
}

export interface PageBuildJob extends PageBuildIntent {
  id: string;
  status: 'queued' | 'building' | 'preview-ready' | 'blocked' | 'published';
  createdAt: string;
  approvalRequired: boolean;
}

export interface BuildReceipt {
  id: string;
  actionTokenId: string;
  buildJobId: string;
  createdAt: string;
  outcome: 'preview-ready' | 'blocked' | 'published';
  commitSha?: string;
  deploymentUrl?: string;
  checks: ReadonlyArray<{ name: string; passed: boolean }>;
}

export interface ActionEngineStore {
  findTokenByIdempotencyKey(key: string): Promise<ActionToken | undefined>;
  appendToken(key: string, token: ActionToken): Promise<void>;
  machineExists(machineId: string): Promise<boolean>;
  enqueueBuild(job: PageBuildJob): Promise<void>;
  appendReceipt(receipt: BuildReceipt): Promise<void>;
}

export interface IntakeResult {
  token: ActionToken;
  buildJob?: PageBuildJob;
  duplicate: boolean;
}

export class ActionEngine {
  constructor(private readonly store: ActionEngineStore) {}

  async ingest(input: ActionIntake): Promise<IntakeResult> {
    const existing = await this.store.findTokenByIdempotencyKey(input.idempotencyKey);
    if (existing) return { token: existing, duplicate: true };

    const token = createActionToken({
      id: input.id,
      value: input.value ?? 1,
      kind: input.kind,
      status: input.status ?? 'token-generated',
      occurredAt: input.occurredAt,
      actorId: input.actorId,
      conversationId: input.conversationId,
      parentTokenIds: input.parentTokenIds,
      repository: input.repository,
      pagePath: input.pagePath,
      inputSummary: input.inputSummary,
      sourceUrls: input.sourceUrls,
      outputSummary: input.outputSummary,
    });

    await this.store.appendToken(input.idempotencyKey, token);
    if (!canBuildPage(token)) return { token, duplicate: false };

    const candidateMachineId = `${token.repository}:${token.pagePath}`.toLowerCase();
    const machineExists = await this.store.machineExists(candidateMachineId);
    const intent = compilePageIntent(token, machineExists ? new Set([candidateMachineId]) : new Set());
    const buildJob: PageBuildJob = {
      ...intent,
      id: `build:${token.id}`,
      status: 'queued',
      createdAt: token.occurredAt,
      approvalRequired: true,
    };
    await this.store.enqueueBuild(buildJob);
    return { token, buildJob, duplicate: false };
  }

  async recordReceipt(receipt: BuildReceipt): Promise<void> {
    if (receipt.outcome === 'published' && !receipt.commitSha) {
      throw new Error('A published receipt requires a commit SHA.');
    }
    await this.store.appendReceipt(Object.freeze({
      ...receipt,
      checks: Object.freeze(receipt.checks.map(check => Object.freeze({ ...check }))),
    }));
  }
}

