/**
 * Cartoon Prompt Engine — Core Generator (v1)
 *
 * Takes a simple text premise and produces deterministic blueprint artifacts
 * for one 30-second stitchable tile (4 shots @ 24 fps = 720 frames).
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
} from './types';

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
// Tile builder
// ---------------------------------------------------------------------------

/** Build the four shots for a single tile, computing frame counts from fps. */
function buildShots(
  fps: number,
  tileId: string,
  premise: string
): Shot[] {
  let frameOffset = 0;
  const shots: Shot[] = [];

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
      consistency: CONSISTENCY_CHECKSUM,
    });

    frameOffset += frameCount;
  }

  void frameOffset; // acknowledged — used implicitly in EDL
  return shots;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate a complete TileBlueprint from a short text premise. */
export function generateTileBlueprint(
  tileId: string,
  premise: string,
  fps = DEFAULT_FPS
): TileBlueprint {
  const duration_s = TILE_DURATION_S;
  const total_frames = fps * duration_s;

  const tile: Tile = { id: tileId, fps, duration_s, total_frames };
  const shots = buildShots(fps, tileId, premise);

  const stitching: Stitching = {
    end_hook_frame: 'shot_04:last_frame',
    next_tile_start_matches: true,
  };

  return {
    tile,
    style: DEFAULT_STYLE,
    characters: [DEFAULT_CHARACTER],
    props: [DEFAULT_PROP],
    shots,
    stitching,
  };
}

/** Generate dialogue text for a tile. */
export function generateDialogue(tileId: string, premise: string): string {
  return [
    `# ${tileId} — Dialogue`,
    `# Premise: ${premise}`,
    '',
    'SHOT_02',
    'MOUSE_01: Oh wow… CHEESE!',
    '',
    'SHOT_03',
    'MOUSE_01: Just one tiny bite. No one will notice.',
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
