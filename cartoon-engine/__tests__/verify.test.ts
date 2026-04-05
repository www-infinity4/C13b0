/**
 * Tests — 4-Hash Verification Chain
 */

import { buildVerificationEnvelope, verifyEnvelope } from '../verify';
import { buildPhysicsMap } from '../physics';
import { INVESTOR_GADGET_DNA, MOUSE_DNA } from '../characters';

const map = buildPhysicsMap({
  character_id: 'investor_gadget',
  initial_position: { x: 0.1, y: 0.8 },
  target_position:  { x: 0.5, y: 0.8 },
  velocity_units_per_s: 0.2,
  fps: 24,
});

const base = {
  tileId:      'tile_0001',
  premise:     'Investor Gadget rescues a bystander',
  physicsMaps: [map],
  dnaList:     [INVESTOR_GADGET_DNA],
};

describe('buildVerificationEnvelope', () => {
  const env = buildVerificationEnvelope(base);

  test('has correct tile_id', () => {
    expect(env.tile_id).toBe('tile_0001');
  });

  test('algorithm is sha256', () => {
    expect(env.algorithm).toBe('sha256');
  });

  test('all four hashes are 64-char hex strings', () => {
    const re = /^[0-9a-f]{64}$/;
    expect(env.hashes.story_hash).toMatch(re);
    expect(env.hashes.geometry_hash).toMatch(re);
    expect(env.hashes.dna_hash).toMatch(re);
    expect(env.hashes.master_hash).toMatch(re);
  });

  test('is deterministic — same input produces same hashes', () => {
    const env2 = buildVerificationEnvelope(base);
    expect(env.hashes.story_hash).toBe(env2.hashes.story_hash);
    expect(env.hashes.geometry_hash).toBe(env2.hashes.geometry_hash);
    expect(env.hashes.dna_hash).toBe(env2.hashes.dna_hash);
    expect(env.hashes.master_hash).toBe(env2.hashes.master_hash);
  });

  test('master_hash depends on all three sub-hashes', () => {
    const env2 = buildVerificationEnvelope({ ...base, premise: 'Different story' });
    expect(env.hashes.story_hash).not.toBe(env2.hashes.story_hash);
    expect(env.hashes.master_hash).not.toBe(env2.hashes.master_hash);
  });

  test('changing DNA changes dna_hash and master_hash', () => {
    const env2 = buildVerificationEnvelope({ ...base, dnaList: [MOUSE_DNA] });
    expect(env.hashes.dna_hash).not.toBe(env2.hashes.dna_hash);
    expect(env.hashes.master_hash).not.toBe(env2.hashes.master_hash);
  });

  test('changing geometry changes geometry_hash and master_hash', () => {
    const map2 = buildPhysicsMap({
      character_id: 'investor_gadget',
      initial_position: { x: 0.0, y: 0.0 },
      target_position:  { x: 1.0, y: 1.0 },
      velocity_units_per_s: 0.5,
      fps: 24,
    });
    const env2 = buildVerificationEnvelope({ ...base, physicsMaps: [map2] });
    expect(env.hashes.geometry_hash).not.toBe(env2.hashes.geometry_hash);
    expect(env.hashes.master_hash).not.toBe(env2.hashes.master_hash);
  });
});

describe('verifyEnvelope', () => {
  const env = buildVerificationEnvelope(base);

  test('returns true for unmodified data', () => {
    const { tileId: _, ...rest } = base;
    void _;
    expect(verifyEnvelope(env, rest)).toBe(true);
  });

  test('returns false when premise is altered', () => {
    expect(
      verifyEnvelope(env, { ...base, premise: 'tampered premise' })
    ).toBe(false);
  });

  test('returns false when DNA is altered', () => {
    expect(
      verifyEnvelope(env, { ...base, dnaList: [MOUSE_DNA] })
    ).toBe(false);
  });
});
