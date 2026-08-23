import {
  canClaimOperational,
  cloudflareMachineRegistry,
  machineHealthCounts,
  machinesForRepository,
} from '../cloudflare-machine-registry';

describe('Cloudflare machine registry', () => {
  test('keeps deployed-but-unverified machines out of operational state', () => {
    expect(cloudflareMachineRegistry.every(machine => !canClaimOperational(machine))).toBe(true);
  });

  test('maps StarQuest to both its ledger and conversational AI machines', () => {
    expect(machinesForRepository('www-infinity4/TV-Database').map(machine => machine.id))
      .toEqual(['starquest-ledger', 'infinity-rogers']);
  });

  test('separates partial infrastructure from legacy shells', () => {
    expect(machineHealthCounts()).toEqual({
      operational: 0,
      partial: 3,
      legacy: 1,
      unknown: 0,
    });
  });
});
