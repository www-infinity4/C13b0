export type UserDataScope = 'private' | 'shared' | 'public';
export type StarEditAction = 'star' | 'unstar' | 'feature' | 'hide' | 'restore' | 'annotate';

export interface EncryptedEnvelope<T = unknown> {
  id: string;
  ownerId: string;
  algorithm: 'AES-GCM';
  keyReference: string;
  nonce: string;
  ciphertext: string;
  contentType: string;
  scope: UserDataScope;
  createdAt: string;
  updatedAt: string;
  versionId: string;
  metadata?: T;
}

export interface VersionRecord<T = unknown> {
  versionId: string;
  entityId: string;
  parentVersionId?: string;
  createdAt: string;
  createdBy: string;
  reason: string;
  reversible: true;
  snapshot: T;
  checksum: string;
}

export interface StarEditRecord {
  id: string;
  userId: string;
  targetId: string;
  action: StarEditAction;
  note?: string;
  createdAt: string;
  reversibleVersionId: string;
}

export interface EngineerStationJob {
  id: string;
  repository: string;
  branch: string;
  tool: 'gitpal' | 'gitpub';
  action: 'inventory' | 'preserve' | 'strengthen' | 'merge-purpose' | 'archive-review' | 'test' | 'propose-merge';
  status: 'queued' | 'running' | 'blocked' | 'failed' | 'passed' | 'approval-required';
  filesChanged: string[];
  tests: Array<{ name: string; status: 'not-run' | 'passed' | 'failed'; details?: string }>;
  createdAt: string;
  updatedAt: string;
}

export function canExposeParticipationRecord(proof: {
  provider?: string;
  recordId?: string;
  verifiedAt?: string;
  verifier?: string;
}): boolean {
  return Boolean(
    (proof.provider === 'git-coin' || proof.provider === 'infinity') &&
    proof.recordId &&
    proof.verifiedAt &&
    proof.verifier
  );
}

export function createReversibleVersion<T>(input: {
  entityId: string;
  parentVersionId?: string;
  createdBy: string;
  reason: string;
  snapshot: T;
  checksum: string;
  now?: string;
}): VersionRecord<T> {
  const createdAt = input.now ?? new Date().toISOString();
  return {
    versionId: `${input.entityId}:${createdAt}`,
    entityId: input.entityId,
    parentVersionId: input.parentVersionId,
    createdAt,
    createdBy: input.createdBy,
    reason: input.reason,
    reversible: true,
    snapshot: input.snapshot,
    checksum: input.checksum,
  };
}
