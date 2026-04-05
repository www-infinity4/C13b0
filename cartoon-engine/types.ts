/**
 * Cartoon Prompt Engine — Data Models (v1)
 *
 * Blueprint-first: all artifacts are deterministic YAML/JSON, never raw video.
 * One 30-second tile = 4 shots at 24 fps = 720 total frames.
 */

/** Top-level tile container. */
export interface Tile {
  id: string;
  fps: number;
  duration_s: number;
  total_frames: number;
}

/** Visual style descriptor. */
export interface Style {
  family: string;
  render_notes: string;
}

/** Reusable character archetype with drift-prevention checksum. */
export interface Character {
  id: string;
  archetype: string;
  consistency_checksum: string;
}

/** Reusable prop archetype. */
export interface Prop {
  id: string;
  archetype: string;
}

/** Camera descriptor for a single shot. */
export interface Camera {
  framing: string;
  angle: string;
}

/** Blocking: start/end normalised positions (0..1) in frame. */
export interface BlockingPosition {
  x: number;
  y: number;
}

export interface Blocking {
  start: BlockingPosition;
  end: BlockingPosition;
}

/** Lip-sync reference bound to a named segment in the visemes file. */
export interface LipSync {
  enabled: boolean;
  viseme_track: string;
  segment: string;
}

/** One shot within a tile. */
export interface Shot {
  id: string;
  duration_s: number;
  frame_count: number;
  camera: Camera;
  background: string;
  blocking: Blocking;
  action: string;
  lipsync: LipSync | null;
  /** Consistency checksum repeated verbatim in every shot. */
  consistency: string;
}

/** Stitching metadata: hook-pose frame reference for tile chaining. */
export interface Stitching {
  end_hook_frame: string;
  next_tile_start_matches: boolean;
}

/** Complete tile blueprint emitted by the generator. */
export interface TileBlueprint {
  tile: Tile;
  style: Style;
  characters: Character[];
  props: Prop[];
  shots: Shot[];
  stitching: Stitching;
}

/** One segment entry in the visemes JSON file. */
export interface VisemeSegment {
  segment: string;
  shot_id: string;
  frame_start: number;
  frame_end: number;
  visemes: unknown[];
}

/** Full visemes file structure. */
export interface VisemesFile {
  tile_id: string;
  fps: number;
  segments: VisemeSegment[];
}

/** One entry in the Edit Decision List. */
export interface EDLEntry {
  index: number;
  shot_id: string;
  frame_start: number;
  frame_end: number;
  duration_frames: number;
}

/** Full EDL file structure. */
export interface EDLFile {
  tile_id: string;
  fps: number;
  total_frames: number;
  entries: EDLEntry[];
}
