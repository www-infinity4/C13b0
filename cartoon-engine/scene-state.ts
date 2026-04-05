/**
 * Cartoon Prompt Engine — Global Scene State (Continuity Manager)
 *
 * Ensures visual consistency across multiple tiles and camera angles by
 * storing and recalling "Environmental Tokens" — the set of lighting,
 * weather, and background landmark descriptors that define a scene.
 *
 * The problem it solves: when generating 10 different camera angles of the
 * same parking lot scene, each tile is generated independently and AI models
 * have no memory of the previous frame.  Without a shared seed, backgrounds
 * drift — the lot becomes a garage becomes a street.
 *
 * GlobalSceneState is the solution: a single source of truth for every
 * environmental descriptor, injected into every shot prompt that belongs to
 * the same scene segment.
 *
 * Usage:
 *   import { GlobalSceneState } from './scene-state';
 *
 *   const scene = new GlobalSceneState({
 *     scene_id: 'parking_lot_rescue',
 *     environment: {
 *       background:  'municipal parking lot, faded yellow lines, chain-link fence',
 *       lighting:    'overcast midday, flat shadows, fluorescent spill from garage',
 *       weather:     'dry, light wind',
 *       time_of_day: 'midday',
 *       palette:     'desaturated grey-green, concrete tones',
 *       landmarks:   ['dented blue sedan', 'overhead CCTV camera', 'cracked asphalt'],
 *     },
 *   });
 *
 *   // Append environment tokens to any shot prompt
 *   const fullPrompt = scene.appendToPrompt('Investor Gadget runs toward the car');
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * EnvironmentTokens — the immutable descriptors that define a scene location.
 *
 * Every field contributes to the background seed that is appended to shot
 * prompts.  Changing a field mid-scene will cause visual drift.
 */
export interface EnvironmentTokens {
  /** Primary background description — the most influential field. */
  background: string;
  /** Lighting conditions: source, direction, intensity. */
  lighting: string;
  /** Weather / atmosphere. */
  weather: string;
  /** Time of day — drives colour temperature. */
  time_of_day: string;
  /** Dominant colour palette in plain language. */
  palette: string;
  /**
   * Named landmark objects that anchor the background across cuts.
   * Each landmark is a plain-text descriptor injected verbatim into prompts.
   * Keep to 3–7 entries for prompt efficiency.
   */
  landmarks: readonly string[];
}

export interface SceneStateOptions {
  /** Unique identifier for this scene segment, e.g. "parking_lot_rescue". */
  scene_id: string;
  environment: EnvironmentTokens;
  /**
   * Consistency strength: 1.0 = all environment tokens appended every shot.
   * Lower values suppress less-important tokens when the prompt is long.
   * Valid range: 0.0–1.0.  Default: 1.0.
   */
  consistency_strength?: number;
}

/** A record of one shot that was processed by this scene state. */
export interface SceneHistoryEntry {
  shot_id: string;
  tile_id: string;
  prompt_seed: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// GlobalSceneState
// ---------------------------------------------------------------------------

/**
 * GlobalSceneState
 *
 * Stores environment tokens for a scene segment and injects them into shot
 * prompts to maintain visual continuity across multiple tiles and angles.
 *
 * Design principle: a scene state is created once per scene segment and
 * shared across all generateTileBlueprint() calls that belong to that segment.
 * The promptSeed is deterministic — same scene_id + environment → same seed.
 */
export class GlobalSceneState {
  readonly scene_id: string;
  readonly environment: Readonly<EnvironmentTokens>;
  readonly consistency_strength: number;

  private readonly _history: SceneHistoryEntry[] = [];

  constructor(options: SceneStateOptions) {
    this.scene_id             = options.scene_id;
    this.environment          = Object.freeze({ ...options.environment });
    this.consistency_strength = Math.max(0, Math.min(1, options.consistency_strength ?? 1.0));
  }

  // ── Environment descriptor builders ────────────────────────────────────────

  /**
   * Returns the full environment descriptor string: all tokens joined in a
   * deterministic order, ready to append to a frame prompt.
   *
   * When consistency_strength < 1.0, the landmark list is truncated
   * proportionally to reduce prompt length without losing anchors.
   */
  environmentDescriptor(): string {
    const { background, lighting, weather, time_of_day, palette, landmarks } =
      this.environment;

    const landmarkCount = Math.max(
      1,
      Math.round(landmarks.length * this.consistency_strength)
    );
    const activeLandmarks = [...landmarks].slice(0, landmarkCount);

    const parts: string[] = [
      background,
      lighting,
      weather,
      time_of_day,
      palette,
      ...activeLandmarks,
    ];

    return parts.join(', ');
  }

  /**
   * Returns only the landmark tokens as a single comma-separated string.
   * Useful when you want to inject just the anchoring objects.
   */
  landmarkDescriptor(): string {
    return [...this.environment.landmarks].join(', ');
  }

  // ── Prompt injection ────────────────────────────────────────────────────────

  /**
   * Appends the full environment descriptor to a base prompt string.
   * Also records the shot in the scene history log.
   *
   * @param basePrompt  The shot-specific portion of the prompt.
   * @param shotId      Shot identifier for history tracking (e.g. "shot_02").
   * @param tileId      Tile identifier for history tracking.
   * @returns           Full prompt with environment tokens appended.
   */
  appendToPrompt(
    basePrompt: string,
    shotId = 'unknown',
    tileId = 'unknown'
  ): string {
    const env = this.environmentDescriptor();
    const full = `${basePrompt}, ${env}`;

    this._history.push({
      shot_id:    shotId,
      tile_id:    tileId,
      prompt_seed: env,
      timestamp:  new Date().toISOString(),
    });

    return full;
  }

  // ── Consistency validation ──────────────────────────────────────────────────

  /**
   * promptSeed
   *
   * A short 8-character hex identifier derived from the scene environment.
   * Two scenes with identical environments produce the same seed.
   *
   * Can be passed to downstream image generators as a fixed seed to
   * reinforce background consistency.
   */
  get promptSeed(): string {
    return hashEnvironment(this.environment).toString(16).padStart(8, '0');
  }

  /**
   * validate
   *
   * Checks whether a given prompt string already contains the core
   * background token.  Returns true if the environment is represented,
   * false if it needs to be injected.
   */
  validate(prompt: string): boolean {
    const core = this.environment.background.split(',')[0].trim().toLowerCase();
    return prompt.toLowerCase().includes(core);
  }

  // ── History ─────────────────────────────────────────────────────────────────

  /** Returns a copy of the processing history for this scene state. */
  get history(): readonly SceneHistoryEntry[] {
    return [...this._history];
  }

  /** Number of shots processed through this scene state. */
  get shotCount(): number {
    return this._history.length;
  }

  // ── Serialisation ───────────────────────────────────────────────────────────

  /**
   * toJSON
   *
   * Serialises the scene state configuration to a plain object.
   * Save this alongside your tile blueprints to reconstruct the scene
   * state in a future session.
   */
  toJSON(): {
    scene_id: string;
    environment: EnvironmentTokens;
    consistency_strength: number;
    prompt_seed: string;
  } {
    return {
      scene_id:             this.scene_id,
      environment:          { ...this.environment },
      consistency_strength: this.consistency_strength,
      prompt_seed:          this.promptSeed,
    };
  }
}

// ---------------------------------------------------------------------------
// Pre-built scene states for the canonical locations
// ---------------------------------------------------------------------------

/**
 * PARKING_LOT_SCENE
 *
 * The canonical Investor Gadget parking lot environment.
 * Use this instance for all tiles set in this location.
 */
export const PARKING_LOT_SCENE = new GlobalSceneState({
  scene_id: 'parking_lot_rescue',
  environment: {
    background:  'municipal parking lot, faded yellow parking lines, chain-link fence in background',
    lighting:    'overcast midday, flat even shadows, fluorescent spill from nearby garage entrance',
    weather:     'dry, light wind from the west',
    time_of_day: 'midday',
    palette:     'desaturated grey-green, concrete tones, muted asphalt',
    landmarks:   [
      'dented blue sedan, mid-frame left',
      'overhead CCTV camera on pole, background centre',
      'cracked asphalt with oil stain, foreground',
      'yellow speed-bump stripe, lower third',
    ],
  },
});

/**
 * KITCHEN_SCENE
 *
 * The canonical mouse kitchen environment.
 */
export const KITCHEN_SCENE = new GlobalSceneState({
  scene_id: 'kitchen_cheese_discovery',
  environment: {
    background:  'sunny domestic kitchen, cream-coloured walls, terracotta floor tiles',
    lighting:    'warm morning sunlight from left window, golden hour glow, soft fill from above',
    weather:     'interior, no weather',
    time_of_day: 'morning',
    palette:     'warm yellows and creams, terracotta floor, sky-blue accents',
    landmarks:   [
      'cheese wedge with round holes, centre counter',
      'copper pot hanging on wall hook, background right',
      'striped tea towel over oven handle, left mid-ground',
    ],
  },
});

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic hash of an EnvironmentTokens object.
 * Returns a 32-bit unsigned integer.
 */
function hashEnvironment(env: EnvironmentTokens): number {
  const str = [
    env.background,
    env.lighting,
    env.weather,
    env.time_of_day,
    env.palette,
    ...env.landmarks,
  ].join('|');

  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h;
}
