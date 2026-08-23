export type InfinityTokenColor =
  | 'blue'
  | 'yellow'
  | 'red'
  | 'green'
  | 'purple'
  | 'orange'
  | 'pink';

export type ActionKind =
  | 'chat-input'
  | 'search'
  | 'research'
  | 'import'
  | 'decision'
  | 'route'
  | 'build'
  | 'publish';

export type ActionStatus =
  | 'input'
  | 'token-generated'
  | 'inspecting'
  | 'repairing'
  | 'finished'
  | 'live';

export interface ActionToken {
  id: string;
  value: number;
  kind: ActionKind;
  color: InfinityTokenColor;
  status: ActionStatus;
  occurredAt: string;
  actorId: string;
  conversationId?: string;
  parentTokenIds: string[];
  repository?: string;
  pagePath?: string;
  inputSummary: string;
  sourceUrls: string[];
  outputSummary?: string;
  receiptIds: string[];
}

export interface PageBuildIntent {
  machineId: string;
  repository: string;
  route: string;
  title: string;
  purpose: string;
  sourceTokenIds: string[];
  updateMode: 'create' | 'update';
}

export const actionColor: Record<ActionKind, InfinityTokenColor> = {
  'chat-input': 'blue',
  search: 'pink',
  research: 'yellow',
  import: 'blue',
  decision: 'orange',
  route: 'red',
  build: 'green',
  publish: 'purple',
};

export function createActionToken(
  input: Omit<ActionToken, 'color' | 'parentTokenIds' | 'sourceUrls' | 'receiptIds'> &
    Partial<Pick<ActionToken, 'parentTokenIds' | 'sourceUrls' | 'receiptIds'>>
): ActionToken {
  return {
    ...input,
    color: actionColor[input.kind],
    parentTokenIds: input.parentTokenIds ?? [],
    sourceUrls: input.sourceUrls ?? [],
    receiptIds: input.receiptIds ?? [],
  };
}

export function canBuildPage(token: ActionToken): boolean {
  return token.status !== 'input' &&
    token.inputSummary.trim().length > 0 &&
    Boolean(token.repository) &&
    Boolean(token.pagePath);
}

export function compilePageIntent(
  token: ActionToken,
  existingMachineIds: ReadonlySet<string> = new Set()
): PageBuildIntent {
  if (!canBuildPage(token) || !token.repository || !token.pagePath) {
    throw new Error('Action token is missing the repository, route, or usable input required to build a page.');
  }

  const machineId = `${token.repository}:${token.pagePath}`.toLowerCase();
  return {
    machineId,
    repository: token.repository,
    route: token.pagePath,
    title: token.inputSummary.slice(0, 80),
    purpose: token.outputSummary ?? token.inputSummary,
    sourceTokenIds: [token.id, ...token.parentTokenIds],
    updateMode: existingMachineIds.has(machineId) ? 'update' : 'create',
  };
}

