/**
 * Cartoon Prompt Engine — Core Generator (v1)
 *
 * Takes a simple text premise and produces deterministic blueprint artifacts
 * for one 30-second stitchable tile (4 shots @ 24 fps = 720 frames).
 *
 * Extended with:
 *  - characterStyles()    : auto-injects CharacterDNA into every frame prompt
 *  - buildPhysicsMap()    : Cartesian movement calculator (deltaX/deltaY/frames)
 *  - buildVerificationEnvelope(): 4-hash tamper-evident verification chain
 */

import {
  TileBlueprint,
  Tile,
  Style,
  Character,
  Prop,
  Shot,
  Stitching,
  VisemesFile,
  VisemeSegment,
  EDLFile,
  EDLEntry,
  PhysicsMap,
  VerificationEnvelope,
} from './types';
import { getDNA } from './characters';
import { buildPhysicsMap } from './physics';
import { buildVerificationEnvelope } from './verify';

export { characterStyles } from './characters';
export { buildPhysicsMap, positionAtFrame, parkingLotRescuePhysics } from './physics';
export { buildVerificationEnvelope, verifyEnvelope } from './verify';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_FPS = 24;
export const TILE_DURATION_S = 30;
export const TOTAL_FRAMES = DEFAULT_FPS * TILE_DURATION_S; // 720

/** Shot durations (seconds) — must sum to TILE_DURATION_S. */
export const SHOT_DURATIONS_S: readonly [number, number, number, number] = [
  3, 9, 9, 9,
];

/** Drift-prevention consistency checksum repeated verbatim in every shot. */
export const CONSISTENCY_CHECKSUM =
  'STYLE:2Dcel|OUTLINE:black_clean|SHADING:2tone|CHAR:mouse_round_ears_long_tail|PROP:swiss_wedge_holes';

/** Default example character archetype. */
export const DEFAULT_CHARACTER: Character = {
  id: 'mouse_01',
  archetype: 'character.mouse.cartoon.v1',
  consistency_checksum: CONSISTENCY_CHECKSUM,
};

/** Default example prop archetype. */
export const DEFAULT_PROP: Prop = {
  id: 'cheese_01',
  archetype: 'prop.cheese_wedge_holes.v1',
};

/** Default style. */
export const DEFAULT_STYLE: Style = {
  family: '2d_cel_shaded_flat',
  render_notes:
    'Clean black outlines, 2-tone shading, limited gradients, TV cartoon palette.',
};

// ---------------------------------------------------------------------------
// Frame prompt builder
// ---------------------------------------------------------------------------

/**
 * buildFramePrompt
 *
 * Composes a full ComfyUI-ready prompt for a single frame by
 * auto-injecting the character's visual DNA descriptor.
 * No downstream tool ever needs to describe the character — it is
 * calculated here from the hard-coded CharacterDNA constant.
 *
 * @param characterId  Registered character key.
 * @param scenePrompt  Scene-specific description (action, background, etc.).
 * @returns            Full prompt string with DNA appended.
 */
export function buildFramePrompt(characterId: string, scenePrompt: string): string {
  const styleDescriptor = getDNA(characterId).prompt_descriptor;
  return `${scenePrompt}, ${styleDescriptor}`;
}

// ---------------------------------------------------------------------------
// Tile builder
// ---------------------------------------------------------------------------

/** Build the four shots for a single tile, computing frame counts from fps. */
function buildShots(
  fps: number,
  tileId: string,
  premise: string,
  characterId: string
): Shot[] {
  let frameOffset = 0;
  const shots: Shot[] = [];
  const consistency = getDNA(characterId).prompt_descriptor;

  const shotDefs = [
    {
      id: 'shot_01',
      camera: { framing: 'wide', angle: 'eye_level' },
      background: 'Sunny kitchen — warm yellows, tiled floor',
      blocking: { start: { x: 0.8, y: 0.5 }, end: { x: 0.5, y: 0.5 } },
      action: `Establishing: ${premise}. Character enters frame and spots prop.`,
      lipsync: null,
    },
    {
      id: 'shot_02',
      camera: { framing: 'medium', angle: 'eye_level' },
      background: 'Kitchen counter close-up, cheese wedge centre',
      blocking: { start: { x: 0.5, y: 0.5 }, end: { x: 0.5, y: 0.5 } },
      action: 'Character reacts with surprise, eyes widen.',
      lipsync: {
        enabled: true,
        viseme_track: `${tileId}.visemes.json`,
        segment: 'shot_02',
      },
    },
    {
      id: 'shot_03',
      camera: { framing: 'medium_close', angle: 'slight_low' },
      background: 'Kitchen counter, same as shot_02 — match cut',
      blocking: { start: { x: 0.5, y: 0.5 }, end: { x: 0.45, y: 0.5 } },
      action: 'Character delivers second dialogue line, leans forward.',
      lipsync: {
        enabled: true,
        viseme_track: `${tileId}.visemes.json`,
        segment: 'shot_03',
      },
    },
    {
      id: 'shot_04',
      camera: { framing: 'wide', angle: 'eye_level' },
      background: 'Kitchen, full view — continuous from shot_01',
      blocking: { start: { x: 0.5, y: 0.5 }, end: { x: 0.6, y: 0.5 } },
      action:
        'Action beat / gag. Character takes a bite; crumbs fall. Ends on HOOK POSE facing camera-right.',
      lipsync: null,
    },
  ] as const;

  for (let i = 0; i < SHOT_DURATIONS_S.length; i++) {
    const dur = SHOT_DURATIONS_S[i];
    const def = shotDefs[i];
    const frameCount = fps * dur;

    shots.push({
      ...def,
      duration_s: dur,
      frame_count: frameCount,
      consistency,
    });

    frameOffset += frameCount;
  }

  void frameOffset; // acknowledged — used implicitly in EDL
  return shots;
}

// ---------------------------------------------------------------------------
// Physics map builder for a tile's characters
// ---------------------------------------------------------------------------

/**
 * buildTilePhysicsMaps
 *
 * Computes one PhysicsMap per character for the default tile motion:
 * character enters frame from the right and walks to centre.
 */
function buildTilePhysicsMaps(fps: number, characters: Character[]): PhysicsMap[] {
  return characters.map((char) =>
    buildPhysicsMap({
      character_id: char.id,
      initial_position: { x: 0.8, y: 0.5 },
      target_position: { x: 0.5, y: 0.5 },
      velocity_units_per_s: 0.2,
      fps,
    })
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Extended return type that includes physics maps and verification. */
export interface GeneratedTile {
  blueprint: TileBlueprint;
  physics_maps: PhysicsMap[];
  verification: VerificationEnvelope;
}

/**
 * generateTileBlueprint
 *
 * Generates a complete TileBlueprint, associated PhysicsMaps, and a
 * 4-hash VerificationEnvelope from a short text premise.
 *
 * @param tileId      Tile identifier (e.g. "tile_0001").
 * @param premise     One-sentence story premise.
 * @param fps         Frames per second (default 24).
 * @param characterId Character key from the DNA registry (default "mouse_01").
 */
export function generateTileBlueprint(
  tileId: string,
  premise: string,
  fps = DEFAULT_FPS,
  characterId = 'mouse_01'
): GeneratedTile {
  const duration_s = TILE_DURATION_S;
  const total_frames = fps * duration_s;

  const tile: Tile = { id: tileId, fps, duration_s, total_frames };
  const dna = getDNA(characterId);
  const characters: Character[] = [{
    id: characterId,
    archetype: dna.archetype,
    consistency_checksum: dna.prompt_descriptor,
  }];
  const shots = buildShots(fps, tileId, premise, characterId);
  const physics_maps = buildTilePhysicsMaps(fps, characters);

  const stitching: Stitching = {
    end_hook_frame: 'shot_04:last_frame',
    next_tile_start_matches: true,
  };

  const blueprint: TileBlueprint = {
    tile,
    style: DEFAULT_STYLE,
    characters,
    props: [DEFAULT_PROP],
    shots,
    stitching,
  };

  const verification = buildVerificationEnvelope({
    tileId,
    premise,
    physicsMaps: physics_maps,
    dnaList: [getDNA(characterId)],
  });

  return { blueprint, physics_maps, verification };
}

/** Generate dialogue text for a tile, using character-appropriate lines. */
export function generateDialogue(tileId: string, premise: string, characterId = 'mouse_01'): string {
  const charLabel = characterId.toUpperCase().replace(/_/g, ' ').trim();

  const lines: Record<string, [string, string]> = {
    investor_gadget: [
      'Don\'t worry — Gadget\'s on the case!',
      'Antenna: extend. Problem: solved.',
    ],
    mouse_01: [
      'Oh wow… CHEESE!',
      'Just one tiny bite. No one will notice.',
    ],
  };

  const [line1, line2] = lines[characterId] ?? lines['mouse_01'];

  return [
    `# ${tileId} — Dialogue`,
    `# Premise: ${premise}`,
    '',
    'SHOT_02',
    `${charLabel}: ${line1}`,
    '',
    'SHOT_03',
    `${charLabel}: ${line2}`,
    '',
  ].join('\n');
}

/** Generate a visemes JSON skeleton for lip-sync shots (shot_02, shot_03). */
export function generateVisemes(
  tileId: string,
  blueprint: TileBlueprint
): VisemesFile {
  const { fps } = blueprint.tile;
  let frameOffset = 0;

  const segments: VisemeSegment[] = [];
  for (const shot of blueprint.shots) {
    if (shot.lipsync?.enabled) {
      segments.push({
        segment: shot.lipsync.segment,
        shot_id: shot.id,
        frame_start: frameOffset,
        frame_end: frameOffset + shot.frame_count - 1,
        visemes: [],
      });
    }
    frameOffset += shot.frame_count;
  }

  return { tile_id: tileId, fps, segments };
}

/** Generate an Edit Decision List for the tile. */
export function generateEDL(
  tileId: string,
  blueprint: TileBlueprint
): EDLFile {
  const { fps, total_frames } = blueprint.tile;
  let frameOffset = 0;
  const entries: EDLEntry[] = [];

  for (let i = 0; i < blueprint.shots.length; i++) {
    const shot = blueprint.shots[i];
    entries.push({
      index: i + 1,
      shot_id: shot.id,
      frame_start: frameOffset,
      frame_end: frameOffset + shot.frame_count - 1,
      duration_frames: shot.frame_count,
    });
    frameOffset += shot.frame_count;
  }

  return { tile_id: tileId, fps, total_frames, entries };
}
