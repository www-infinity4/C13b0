export type MachineHealth = 'operational' | 'partial' | 'legacy' | 'unknown';
export type CloudflareRuntime = 'worker' | 'pages';

export interface CloudflareBindingSummary {
  name: string;
  type: 'd1' | 'secret_text' | 'unknown';
}

export interface CloudflareMachineRecord {
  id: string;
  runtime: CloudflareRuntime;
  accountLabel: string;
  publicHost?: string;
  repositories: string[];
  capabilities: string[];
  bindings: CloudflareBindingSummary[];
  health: MachineHealth;
  healthReason: string;
  inspectedAt: string;
  source: 'cloudflare-api';
}

export const cloudflareAccount = {
  label: 'Connected Cloudflare account',
  workersSubdomain: 'marvaseater',
} as const;

const inspectedAt = '2026-08-23T21:40:00.000Z';

/**
 * Evidence snapshot from the Cloudflare API. This is deliberately explicit:
 * a deployed Worker is not called operational merely because its name exists.
 * The live census job will replace this snapshot when C13b0 has a server-side
 * Cloudflare connection and durable deployment inventory.
 */
export const cloudflareMachineRegistry: CloudflareMachineRecord[] = [
  {
    id: 'infinity-ledger',
    runtime: 'worker',
    accountLabel: cloudflareAccount.label,
    publicHost: 'infinity-ledger.marvaseater.workers.dev',
    repositories: ['www-infinity4/Mint-For-Infinity', 'www-infinity4/C13b0'],
    capabilities: ['shared-ledger', 'transaction-receipts', 'wallet-foundation'],
    bindings: [{
      name: 'DB',
      type: 'd1',
    }],
    health: 'partial',
    healthReason: 'Deployed with D1 and logs, but repository ownership and end-to-end wallet clients still require verification.',
    inspectedAt,
    source: 'cloudflare-api',
  },
  {
    id: 'starquest-ledger',
    runtime: 'worker',
    accountLabel: cloudflareAccount.label,
    publicHost: 'starquest-ledger.marvaseater.workers.dev',
    repositories: ['www-infinity4/TV-Database'],
    capabilities: ['watch-events', 'share-events', 'star-coin-receipts', 'connector-authentication'],
    bindings: [
      {
        name: 'DB',
        type: 'd1',
      },
      { name: 'INFINITY_CONNECTOR_SECRET', type: 'secret_text' },
    ],
    health: 'partial',
    healthReason: 'Deployed with D1 and a connector secret; the StarQuest browser flow must still be verified against the live API.',
    inspectedAt,
    source: 'cloudflare-api',
  },
  {
    id: 'infinity-rogers',
    runtime: 'worker',
    accountLabel: cloudflareAccount.label,
    publicHost: 'infinity-rogers.marvaseater.workers.dev',
    repositories: ['www-infinity4/C13b0', 'www-infinity4/TV-Database'],
    capabilities: ['conversational-ai', 'project-assistance', 'durable-conversation-data'],
    bindings: [
      { name: 'ANTHROPIC_API_KEY', type: 'secret_text' },
      {
        name: 'DB',
        type: 'd1',
      },
    ],
    health: 'partial',
    healthReason: 'Model and D1 bindings exist; client integration, authorization boundaries, and response checks remain unverified.',
    inspectedAt,
    source: 'cloudflare-api',
  },
  {
    id: 'infinity-dashboard-watson-ai',
    runtime: 'worker',
    accountLabel: cloudflareAccount.label,
    publicHost: 'infinity-dashboard-watson-ai.marvaseater.workers.dev',
    repositories: [],
    capabilities: ['legacy-dashboard-shell'],
    bindings: [],
    health: 'legacy',
    healthReason: 'Deployed without service bindings and without a verified canonical repository mapping.',
    inspectedAt,
    source: 'cloudflare-api',
  },
];

export function machineHealthCounts(
  records: CloudflareMachineRecord[] = cloudflareMachineRegistry
): Record<MachineHealth, number> {
  return records.reduce<Record<MachineHealth, number>>(
    (counts, record) => {
      counts[record.health] += 1;
      return counts;
    },
    { operational: 0, partial: 0, legacy: 0, unknown: 0 }
  );
}

export function machinesForRepository(
  repositoryFullName: string,
  records: CloudflareMachineRecord[] = cloudflareMachineRegistry
): CloudflareMachineRecord[] {
  return records.filter(record => record.repositories.includes(repositoryFullName));
}

export function canClaimOperational(record: CloudflareMachineRecord): boolean {
  return record.health === 'operational' &&
    record.repositories.length > 0 &&
    record.capabilities.length > 0;
}
