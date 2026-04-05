/**
 * Cartoon Prompt Engine — Data Models (v1)
 *
 * Blueprint-first: all artifacts are deterministic YAML/JSON, never raw video.
 * One 30-second tile = 4 shots at 24 fps = 720 total frames.
 *
 * Extended with:
 *  - PhysicsMap  : deterministic Cartesian coordinate engine
 *  - CharacterDNA: hard-coded visual constants (hex codes, geometry)
 *  - FrameHashes : 4-hash tamper-evident verification chain
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

// ---------------------------------------------------------------------------
// Physics — Cartesian coordinate engine
// ---------------------------------------------------------------------------

/** A normalised 2-D position on screen (0..1 on each axis). */
export interface Vector2D {
  x: number;
  y: number;
}

/** Calculated motion between two positions at a given velocity. */
export interface MotionVector {
  /** Change in X (target.x − initial.x). */
  delta_x: number;
  /** Change in Y (target.y − initial.y). */
  delta_y: number;
  /** Euclidean distance in normalised units. */
  distance: number;
  /** Wall-clock time (seconds) to reach target at the given velocity. */
  travel_time_s: number;
  /** Number of animation frames to reach target at fps. */
  frames_to_target: number;
  /** Per-frame position vectors from frame 0 to frames_to_target. */
  frame_sequence: Vector2D[];
}

/**
 * PhysicsMap — the Cartesian engine for a single character movement.
 *
 * The generator calculates all derived fields; callers only supply
 * `character_id`, `initial_position`, `target_position`, `velocity_units_per_s`,
 * and `fps`.
 */
export interface PhysicsMap {
  character_id: string;
  initial_position: Vector2D;
  target_position: Vector2D;
  /** Speed in normalised units per second (e.g. 0.2 = crosses 20 % of screen/s). */
  velocity_units_per_s: number;
  fps: number;
  /** Fully calculated — do not set by hand. */
  motion: MotionVector;
}

// ---------------------------------------------------------------------------
// CharacterDNA — hard-coded visual constants (no AI guessing)
// ---------------------------------------------------------------------------

/**
 * CharacterDNA — the immutable visual fingerprint for a character.
 * Every field must be present; the `prompt_descriptor` string is
 * auto-injected into every generated frame prompt.
 */
export interface CharacterDNA {
  character_id: string;
  archetype: string;
  /** Full ComfyUI-ready prompt descriptor, auto-appended to every frame. */
  prompt_descriptor: string;
  /** Primary coat / body colour as CSS hex. */
  coat_hex: string;
  /**
   * Geometric description of the hat antenna in plain text:
   * radius, height, finish, taper angle, telescoping sections.
   */
  hat_antenna_geometry: string;
  glove_hex: string;
  outline_hex: string;
  shading_mode: string;
}

// ---------------------------------------------------------------------------
// 4-Hash verification chain
// ---------------------------------------------------------------------------

/**
 * FrameHashes — tamper-evident verification chain for a tile.
 *
 * Hash 1 (story)    : SHA-256 of the story / premise JSON.
 * Hash 2 (geometry) : SHA-256 of the PhysicsMap JSON array.
 * Hash 3 (dna)      : SHA-256 of the CharacterDNA JSON.
 * Hash 4 (master)   : SHA-256 of ( story_hash + geometry_hash + dna_hash ).
 *
 * A tile is "pure" if and only if masterHash matches the content hashes.
 */
export interface FrameHashes {
  story_hash: string;
  geometry_hash: string;
  dna_hash: string;
  master_hash: string;
}

/**
 * Full verification envelope emitted alongside the tile blueprint.
 * Store this as `tile_XXXX.verify.json`.
 */
export interface VerificationEnvelope {
  tile_id: string;
  hashes: FrameHashes;
  algorithm: 'sha256';
  generated_at: string;
}

