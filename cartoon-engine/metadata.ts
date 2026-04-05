/**
 * Cartoon Prompt Engine — Film Cell Asset Manager: Metadata & Tokenizer
 *
 * Every frame the engine generates is treated as a tracked physical asset —
 * a "Film Cell" with a unique serial number, a known origin, and an open
 * slot for attached domain-specific data.
 *
 * The CellToken is the engine's asset identity layer.  It answers:
 *   "What shot is this?"  "Which character?"  "When was it made?"
 *   "What MIDI note triggered it?"  "What data is attached?"
 *
 * Token format:  {CHAR}-{SHOT}-{HASH8}
 *   CHAR   = 2-letter character prefix  (IG = Investor Gadget, MS = Mouse)
 *   SHOT   = shot code                  (S01, S02, S03, S04)
 *   HASH8  = 8 hex chars from SHA-256 of (tileId + shotId + characterId + timestamp)
 *
 *   Example: "IG-S01-A3F7B29C"
 *
 * Usage:
 *   import { generateCellToken, attachData } from './metadata';
 *
 *   const token = generateCellToken({
 *     tileId:      'tile_0001',
 *     shotId:      'shot_01',
 *     characterId: 'investor_gadget',
 *     midiNote:    67,
 *   });
 *   // token.id → "IG-S01-A3F7B29C"
 *
 *   const withData = attachData(token, {
 *     type:  'cartoon',
 *     label: 'dialogue',
 *     value: "Don't worry — Gadget's on the case!",
 *   });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Supported content domains for the attached data slot.
 *
 *   cartoon    — script lines, action descriptions, character notes
 *   medical    — tissue density values, scan metadata, clinical notes
 *   aerospace  — 3-D coordinates, telemetry, mission phase
 *   custom     — any user-defined payload
 */
export type AttachedDataType = 'cartoon' | 'medical' | 'aerospace' | 'custom';

/**
 * AttachedData — the open data slot on a CellToken.
 *
 * Attach domain-specific content to any Film Cell without changing the
 * core token structure.  One token, many disciplines.
 */
export interface AttachedData {
  type: AttachedDataType;
  /** Human-readable label (e.g. "dialogue", "tissue_density", "coordinate"). */
  label: string;
  /** The attached value — string, number, or structured object. */
  value: string | number | Record<string, unknown>;
}

/** Input parameters for generateCellToken(). */
export interface CellTokenInput {
  tileId: string;
  shotId: string;
  characterId: string;
  /** Optional ISO timestamp override.  Defaults to now (new Date().toISOString()). */
  timestamp?: string;
  /** MIDI note number (0–127) that triggered this frame, if any. */
  midiNote?: number;
  /** Pre-attached data payload, if any. */
  attached_data?: AttachedData;
}

/**
 * CellToken — the unique identity record for one generated shot.
 *
 * All fields are immutable after generation.  To attach data, use
 * attachData() which returns a new CellToken.
 */
export interface CellToken {
  /** Full token string, e.g. "IG-S01-A3F7B29C". */
  id: string;
  /** Two-letter character prefix, e.g. "IG". */
  character_prefix: string;
  /** Shot code, e.g. "S01". */
  shot_code: string;
  /** Eight hex-character hash of origin data. */
  hash: string;
  tile_id: string;
  shot_id: string;
  character_id: string;
  /** ISO 8601 generation timestamp. */
  generated_at: string;
  /** MIDI note that triggered this frame, if any. */
  midi_note?: number;
  /** Attached domain data (cartoon, medical, aerospace, custom). */
  attached_data?: AttachedData;
}

// ---------------------------------------------------------------------------
// Character prefix registry
// ---------------------------------------------------------------------------

const CHARACTER_PREFIXES: Record<string, string> = {
  investor_gadget: 'IG',
  mouse_01:        'MS',
};

function characterPrefix(characterId: string): string {
  return CHARACTER_PREFIXES[characterId] ?? characterId.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Shot code registry
// ---------------------------------------------------------------------------

function shotCode(shotId: string): string {
  // shot_01 → S01, shot_02 → S02, etc.
  const match = shotId.match(/(\d+)$/);
  if (match) return `S${match[1].padStart(2, '0')}`;
  return shotId.slice(0, 3).toUpperCase();
}

// ---------------------------------------------------------------------------
// Deterministic hash (no crypto API needed)
// ---------------------------------------------------------------------------

/**
 * Produces an 8-character hex hash from the token origin fields.
 * Same inputs → same hash every run (deterministic, not random).
 *
 * Uses a two-pass FNV-1a-style 32-bit fold for uniform distribution.
 */
function hashOrigin(
  tileId: string,
  shotId: string,
  characterId: string,
  timestamp: string
): string {
  const str  = `${tileId}|${shotId}|${characterId}|${timestamp}`;
  let h1 = 0x811c9dc5 >>> 0;  // FNV offset basis
  let h2 = 0xdeadbeef >>> 0;

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (Math.imul(h1 ^ c, 0x01000193) >>> 0);
    h2 = (Math.imul(h2 ^ c, 0x27220a95) >>> 0);
  }

  const merged = (h1 ^ h2) >>> 0;
  // Return 8 hex chars (4 bytes → 8 hex digits)
  return merged.toString(16).toUpperCase().padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * generateCellToken
 *
 * Stamps a shot with a unique Film Cell identity.
 *
 * @param input  Token origin fields (tileId, shotId, characterId, …).
 * @returns      An immutable CellToken with a unique ID.
 */
export function generateCellToken(input: CellTokenInput): CellToken {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const prefix    = characterPrefix(input.characterId);
  const code      = shotCode(input.shotId);
  const hash      = hashOrigin(input.tileId, input.shotId, input.characterId, timestamp);
  const id        = `${prefix}-${code}-${hash}`;

  return {
    id,
    character_prefix: prefix,
    shot_code:        code,
    hash,
    tile_id:          input.tileId,
    shot_id:          input.shotId,
    character_id:     input.characterId,
    generated_at:     timestamp,
    ...(input.midiNote      !== undefined && { midi_note:     input.midiNote      }),
    ...(input.attached_data !== undefined && { attached_data: input.attached_data }),
  };
}

/**
 * attachData
 *
 * Returns a new CellToken with the given data attached to the data slot.
 * The original token is not mutated.
 *
 * @param token  Existing CellToken.
 * @param data   The data to attach.
 */
export function attachData(token: CellToken, data: AttachedData): CellToken {
  return { ...token, attached_data: data };
}

/**
 * tokenizeTile
 *
 * Generates one CellToken per shot for an entire tile, using a fixed
 * timestamp so all tokens in the tile share the same generation instant.
 *
 * @param tileId       Tile identifier.
 * @param shotIds      Array of shot IDs (e.g. ['shot_01', 'shot_02', …]).
 * @param characterId  Character for all shots in the tile.
 * @param midiNotes    Optional array of MIDI notes, aligned with shotIds.
 */
export function tokenizeTile(
  tileId: string,
  shotIds: readonly string[],
  characterId: string,
  midiNotes?: readonly number[]
): CellToken[] {
  const timestamp = new Date().toISOString();
  return shotIds.map((shotId, i) =>
    generateCellToken({
      tileId,
      shotId,
      characterId,
      timestamp,
      ...(midiNotes?.[i] !== undefined && { midiNote: midiNotes[i] }),
    })
  );
}

/**
 * formatTokenSummary
 *
 * Returns a compact human-readable summary line for a CellToken.
 * Suitable for console output or gallery captions.
 *
 * Example: "IG-S01-A3F7B29C | tile_0001 / shot_01 | 2026-04-05 | MIDI:67"
 */
export function formatTokenSummary(token: CellToken): string {
  const date  = token.generated_at.slice(0, 10);
  const midi  = token.midi_note !== undefined ? ` | MIDI:${token.midi_note}` : '';
  const data  = token.attached_data ? ` | ${token.attached_data.type}:${token.attached_data.label}` : '';
  return `${token.id} | ${token.tile_id} / ${token.shot_id} | ${date}${midi}${data}`;
}
