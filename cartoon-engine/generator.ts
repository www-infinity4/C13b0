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
  PhysicsMap3D,
  VerificationEnvelope,
  DimensionMode,
  ComfyUIWorkflow,
  ComfyUINode,
} from './types';
import { getDNA } from './characters';
import { buildPhysicsMap } from './physics';
import { buildVerificationEnvelope } from './verify';
import { buildPhysicsMap3D, PhysicsMap3DInput } from './physics3d';

export { characterStyles } from './characters';
export { buildPhysicsMap, positionAtFrame, parkingLotRescuePhysics, smoothMotionBezier, motionToleranceCheck } from './physics';
export { buildVerificationEnvelope, verifyEnvelope } from './verify';
export { buildPhysicsMap3D, positionAtFrame3D, gadgetCameraDolly, euclidean3D } from './physics3d';

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

// ---------------------------------------------------------------------------
// ComfyUI workflow emitter
// ---------------------------------------------------------------------------

/**
 * emitComfyUIWorkflow
 *
 * Converts a TileBlueprint into a ComfyUI API-format workflow (workflow_api.json).
 * The output can be posted directly to the ComfyUI `/prompt` endpoint or saved
 * as a JSON file and loaded into the ComfyUI editor.
 *
 * Graph layout per tile (25 nodes total for a 4-shot tile):
 *   Node 1   : CheckpointLoaderSimple (shared model)
 *   Nodes 2–7  : Shot 1 — positive CLIP, negative CLIP, latent, KSampler, VAEDecode, SaveImage
 *   Nodes 8–13 : Shot 2 — same pattern
 *   Nodes 14–19: Shot 3
 *   Nodes 20–25: Shot 4
 *
 * Seeds are deterministic: same tileId + shotId → same seed every run.
 *
 * @param tileId     Tile identifier.
 * @param blueprint  The tile blueprint to convert.
 * @param options    Optional overrides for checkpoint, steps, CFG, negative prompt.
 */
export function emitComfyUIWorkflow(
  tileId: string,
  blueprint: TileBlueprint,
  options: {
    checkpoint?: string;
    steps?: number;
    cfg?: number;
    negativePrompt?: string;
  } = {}
): ComfyUIWorkflow {
  const {
    checkpoint    = 'v1-5-pruned-emaonly.safetensors',
    steps         = 20,
    cfg           = 7.0,
    negativePrompt = 'ugly, blurry, low quality, deformed, watermark',
  } = options;

  const workflow: ComfyUIWorkflow = {};

  // Node 1: shared checkpoint loader
  workflow['1'] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: checkpoint },
    _meta: { title: 'Load Checkpoint' },
  };

  blueprint.shots.forEach((shot, i) => {
    const base   = 2 + i * 6;
    const posId  = String(base);
    const negId  = String(base + 1);
    const latId  = String(base + 2);
    const kId    = String(base + 3);
    const vaeId  = String(base + 4);
    const saveId = String(base + 5);

    const characterId = blueprint.characters[0]?.id ?? 'mouse_01';
    const prompt = buildFramePrompt(characterId, [
      shot.action,
      shot.background,
      `${shot.camera.framing} shot`,
      `${shot.camera.angle} angle`,
      blueprint.style.render_notes,
    ].join(', '));

    const ref = (id: string, slot: number): [string, number] => [id, slot];

    const posNode: ComfyUINode = {
      class_type: 'CLIPTextEncode',
      inputs: { text: prompt, clip: ref('1', 1) },
      _meta: { title: `Positive — ${shot.id}` },
    };
    const negNode: ComfyUINode = {
      class_type: 'CLIPTextEncode',
      inputs: { text: negativePrompt, clip: ref('1', 1) },
      _meta: { title: `Negative — ${shot.id}` },
    };
    const latNode: ComfyUINode = {
      class_type: 'EmptyLatentImage',
      inputs: { width: 768, height: 432, batch_size: 1 },
      _meta: { title: `Latent — ${shot.id}` },
    };
    const kNode: ComfyUINode = {
      class_type: 'KSampler',
      inputs: {
        seed:          deterministicSeed(tileId, shot.id),
        steps,
        cfg,
        sampler_name:  'euler_ancestral',
        scheduler:     'karras',
        denoise:       1.0,
        model:         ref('1',   0),
        positive:      ref(posId, 0),
        negative:      ref(negId, 0),
        latent_image:  ref(latId, 0),
      },
      _meta: { title: `KSampler — ${shot.id}` },
    };
    const vaeNode: ComfyUINode = {
      class_type: 'VAEDecode',
      inputs: { samples: ref(kId, 0), vae: ref('1', 2) },
      _meta: { title: `VAEDecode — ${shot.id}` },
    };
    const saveNode: ComfyUINode = {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: `${tileId}_${shot.id}`,
        images:          ref(vaeId, 0),
      },
      _meta: { title: `Save — ${shot.id}` },
    };

    workflow[posId]  = posNode;
    workflow[negId]  = negNode;
    workflow[latId]  = latNode;
    workflow[kId]    = kNode;
    workflow[vaeId]  = vaeNode;
    workflow[saveId] = saveNode;
  });

  return workflow;
}

/**
 * Deterministic integer seed derived from tile + shot IDs.
 * Identical inputs always produce the same 32-bit unsigned integer.
 */
function deterministicSeed(tileId: string, shotId: string): number {
  const str = `${tileId}:${shotId}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ---------------------------------------------------------------------------
// ASCII storyboard preview
// ---------------------------------------------------------------------------

const BOARD_INNER_W = 48; // characters between │ borders
const BOARD_INNER_H = 5;  // rows of character space per shot

/**
 * renderStoryboardCLI
 *
 * Renders an ASCII art storyboard for all shots in a tile blueprint.
 * Each shot becomes a bordered frame showing:
 *   - Shot ID, camera framing/angle, and lip-sync marker
 *   - Character position "[C]" with a movement arrow to the end blocking
 *   - Normalised start/end coordinates and frame/time count
 *   - Action description
 *
 * The output is a plain string — print it to stdout or write it to a file.
 *
 * @param tileId     Tile identifier (shown in the header).
 * @param blueprint  The tile blueprint to render.
 * @returns          Multi-line ASCII string.
 */
export function renderStoryboardCLI(
  tileId: string,
  blueprint: TileBlueprint
): string {
  const lines: string[] = [
    '',
    `${tileId}  ·  ASCII Storyboard Preview`,
    '═'.repeat(BOARD_INNER_W + 4),
    '',
  ];

  for (const shot of blueprint.shots) {
    const { camera, blocking, action, duration_s, frame_count, lipsync } = shot;
    const lipsyncMark = lipsync?.enabled ? ' ♫' : '';

    // ── Header ─────────────────────────────────────────────────────────────
    const headerContent = ` ${shot.id.toUpperCase()} · ${camera.framing} / ${camera.angle}${lipsyncMark} `;
    const headerFill    = '─'.repeat(Math.max(0, BOARD_INNER_W + 2 - headerContent.length));
    lines.push(`┌─${headerContent}${headerFill}┐`);

    // ── Character grid ──────────────────────────────────────────────────────
    const grid: string[][] = Array.from({ length: BOARD_INNER_H }, () =>
      Array(BOARD_INNER_W).fill(' ')
    );

    const startCol = Math.min(
      Math.round(blocking.start.x * (BOARD_INNER_W - 3)),
      BOARD_INNER_W - 3
    );
    const endCol  = Math.min(
      Math.round(blocking.end.x * (BOARD_INNER_W - 3)),
      BOARD_INNER_W - 1
    );
    const charRow = Math.min(
      Math.round(blocking.start.y * (BOARD_INNER_H - 1)),
      BOARD_INNER_H - 1
    );

    // Draw movement arrow when there is significant horizontal displacement
    const dxCols = endCol - startCol;
    if (Math.abs(dxCols) > 3) {
      const arrowHead  = dxCols > 0 ? '►' : '◄';
      const arrowStart = dxCols > 0 ? startCol + 3 : endCol + 1;
      const arrowEnd   = dxCols > 0 ? endCol - 1   : startCol - 1;
      for (let c = Math.min(arrowStart, arrowEnd);
               c <= Math.max(arrowStart, arrowEnd) && c < BOARD_INNER_W;
               c++) {
        if (c >= 0) grid[charRow][c] = '─';
      }
      const headCol = Math.max(0, Math.min(BOARD_INNER_W - 1, endCol));
      grid[charRow][headCol] = arrowHead;
    }

    // Draw character marker (painted last so it is never overwritten)
    if (startCol >= 0 && startCol + 2 < BOARD_INNER_W) {
      grid[charRow][startCol]     = '[';
      grid[charRow][startCol + 1] = 'C';
      grid[charRow][startCol + 2] = ']';
    }

    for (const row of grid) {
      lines.push(`│ ${row.join('')} │`);
    }

    // ── Footer ──────────────────────────────────────────────────────────────
    const startStr  = `(${blocking.start.x.toFixed(2)},${blocking.start.y.toFixed(2)})`;
    const endStr    = `(${blocking.end.x.toFixed(2)},${blocking.end.y.toFixed(2)})`;
    const footerContent = ` ${startStr} → ${endStr} · ${frame_count}f · ${duration_s}s `;
    const footerFill    = '─'.repeat(Math.max(0, BOARD_INNER_W + 2 - footerContent.length));
    lines.push(`└${footerContent}${footerFill}┘`);

    // ── Action text ─────────────────────────────────────────────────────────
    const maxLen    = BOARD_INNER_W + 2;
    const actionStr = action.length > maxLen ? action.slice(0, maxLen - 1) + '…' : action;
    lines.push(`  → ${actionStr}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 3-D dimension toggle
// ---------------------------------------------------------------------------

/**
 * GeneratedTile3D — a GeneratedTile with an additional 3-D physics layer.
 *
 * When dimension_mode is MESH_3D, physics_maps_3d contains one PhysicsMap3D
 * per character, derived from the original 2-D maps by adding a Z coordinate.
 * When dimension_mode is FLAT_2D, physics_maps_3d is an empty array.
 *
 * The original physics_maps (2-D) are always preserved for backward
 * compatibility with downstream consumers that only understand 2-D.
 */
export interface GeneratedTile3D extends GeneratedTile {
  dimension_mode: DimensionMode;
  physics_maps_3d: PhysicsMap3D[];
}

/**
 * toggleDimensionMode
 *
 * Switches a GeneratedTile between FLAT_2D and MESH_3D modes.
 *
 * In MESH_3D mode each 2-D PhysicsMap is upgraded to a PhysicsMap3D by
 * adding a constant Z coordinate (defaultZ) to both start and target.
 * The resulting motion path lies in a horizontal plane at that depth.
 *
 * In FLAT_2D mode no 3-D maps are produced (physics_maps_3d is empty).
 *
 * @param tile      A tile produced by generateTileBlueprint.
 * @param mode      Target DimensionMode: 'FLAT_2D' or 'MESH_3D'.
 * @param defaultZ  Default depth (0 = foreground, 1 = background). Default 0.5.
 */
export function toggleDimensionMode(
  tile: GeneratedTile,
  mode: DimensionMode,
  defaultZ = 0.5
): GeneratedTile3D {
  const physics_maps_3d: PhysicsMap3D[] =
    mode === 'MESH_3D'
      ? tile.physics_maps.map((map) => {
          const input: PhysicsMap3DInput = {
            character_id:        map.character_id,
            initial_position:    { ...map.initial_position, z: defaultZ },
            target_position:     { ...map.target_position,  z: defaultZ },
            velocity_units_per_s: map.velocity_units_per_s,
            fps:                 map.fps,
          };
          return buildPhysicsMap3D(input);
        })
      : [];

  return { ...tile, dimension_mode: mode, physics_maps_3d };
}
