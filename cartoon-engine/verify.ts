/**
 * Cartoon Prompt Engine — 4-Hash Verification Chain
 *
 * Produces a tamper-evident VerificationEnvelope for every tile.
 * All four hashes are deterministic SHA-256 digests — no randomness.
 *
 *  Hash 1 — story_hash    : SHA-256 of the story/premise JSON
 *  Hash 2 — geometry_hash : SHA-256 of the PhysicsMap array JSON
 *  Hash 3 — dna_hash      : SHA-256 of the CharacterDNA array JSON
 *  Hash 4 — master_hash   : SHA-256 of ( story_hash + geometry_hash + dna_hash )
 *
 * A tile is "pure" when its master_hash can be reproduced from the
 * other three hashes.  Any mutation to premise, geometry, or DNA
 * will cascade to a different master_hash.
 *
 * Usage:
 *   import { buildVerificationEnvelope, verifyEnvelope } from './verify';
 *
 *   const env = buildVerificationEnvelope({ tileId, premise, physicsMaps, dnaList });
 *   const ok  = verifyEnvelope(env, { premise, physicsMaps, dnaList });
 */

import { createHash } from 'crypto';
import { PhysicsMap, CharacterDNA, VerificationEnvelope, FrameHashes } from './types';

// ---------------------------------------------------------------------------
// Hashing helpers
// ---------------------------------------------------------------------------

/** Compute a stable, deterministic SHA-256 hex digest of any JSON-serialisable value. */
function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface VerificationInput {
  tileId: string;
  /** The story premise (string) used to generate the tile. */
  premise: string;
  /** All PhysicsMaps computed for this tile. */
  physicsMaps: PhysicsMap[];
  /** CharacterDNA objects used in this tile. */
  dnaList: CharacterDNA[];
}

/**
 * buildVerificationEnvelope
 *
 * Computes all four hashes and returns a VerificationEnvelope
 * ready to be written as `tile_XXXX.verify.json`.
 */
export function buildVerificationEnvelope(
  input: VerificationInput
): VerificationEnvelope {
  const { tileId, premise, physicsMaps, dnaList } = input;

  // Hash 1 — Story Logic
  const story_hash = sha256({ premise });

  // Hash 2 — Geometry Calculation (X/Y math)
  const geometry_hash = sha256(physicsMaps);

  // Hash 3 — Visual Consistency (DNA)
  const dna_hash = sha256(dnaList);

  // Hash 4 — Master: SHA-256 of the three sub-hashes concatenated
  const master_hash = sha256(story_hash + geometry_hash + dna_hash);

  const hashes: FrameHashes = {
    story_hash,
    geometry_hash,
    dna_hash,
    master_hash,
  };

  return {
    tile_id: tileId,
    hashes,
    algorithm: 'sha256',
    generated_at: new Date().toISOString(),
  };
}

/**
 * verifyEnvelope
 *
 * Re-derives all four hashes from the source data and checks them
 * against a stored VerificationEnvelope.  Returns `true` only if
 * every hash matches (including master_hash).
 *
 * @param envelope   Stored envelope (e.g. loaded from `tile_XXXX.verify.json`).
 * @param input      The source data to verify against.
 * @returns          `true` if the tile is unmodified; `false` if any hash differs.
 */
export function verifyEnvelope(
  envelope: VerificationEnvelope,
  input: Omit<VerificationInput, 'tileId'>
): boolean {
  const recomputed = buildVerificationEnvelope({
    tileId: envelope.tile_id,
    ...input,
  });

  return (
    envelope.hashes.story_hash    === recomputed.hashes.story_hash    &&
    envelope.hashes.geometry_hash === recomputed.hashes.geometry_hash &&
    envelope.hashes.dna_hash      === recomputed.hashes.dna_hash      &&
    envelope.hashes.master_hash   === recomputed.hashes.master_hash
  );
}
