/**
 * Cartoon Prompt Engine — Secondary Motion Physics Overlay
 *
 * Deterministic secondary-motion descriptors driven by a character's
 * Cartesian velocity.  No randomness, no AI inference — pure arithmetic.
 *
 * "Secondary motion" refers to the incidental movement of costume elements
 * (trench coats, scarves, hair, ears) that lags behind primary body movement.
 * Including these descriptors in the frame prompt produces significantly more
 * realistic and cinematic output from downstream image generators.
 *
 * Usage:
 *   import { SecondaryMotion } from './physics-overlay';
 *
 *   const sm = new SecondaryMotion({
 *     velocity_x: 0.25,   // units per second, from PhysicsMap
 *     velocity_y: 0.0,
 *     character_id: 'investor_gadget',
 *   });
 *   const descriptor = sm.promptDescriptor();
 *   // → "trench coat billowing behind, hat brim fluttering, dynamic motion blur"
 *   const keywords = sm.keywords();
 *   // → ['trench coat billowing behind', 'hat brim fluttering', ...]
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SecondaryMotionInput {
  /** Horizontal velocity in normalised units per second (from PhysicsMap). */
  velocity_x: number;
  /** Vertical velocity in normalised units per second (from PhysicsMap). */
  velocity_y: number;
  /** Character identifier — controls which costume elements are evaluated. */
  character_id: string;
}

/** Speed thresholds (normalised u/s) that gate motion intensity bands. */
export const MOTION_THRESHOLDS = {
  /** Below this: no perceptible secondary motion. */
  STILL:    0.01,
  /** Slow drift / gentle sway. */
  GENTLE:   0.05,
  /** Brisk walk — moderate coat/hair movement. */
  MODERATE: 0.15,
  /** Fast movement — vigorous flapping, trailing fabric. */
  VIGOROUS: 0.30,
  /** Sprint — extreme trailing, fabric perpendicular to motion. */
  SPRINT:   0.50,
} as const;

export type MotionIntensity = 'still' | 'gentle' | 'moderate' | 'vigorous' | 'sprint';

/** A single secondary-motion keyword with its intensity requirement. */
export interface SecondaryKeyword {
  keyword: string;
  /** This keyword only activates at or above this intensity level. */
  min_intensity: MotionIntensity;
  /** Applies only when motion is primarily in this direction. */
  direction?: 'horizontal' | 'vertical' | 'any';
}

// ---------------------------------------------------------------------------
// Character costume registries
// ---------------------------------------------------------------------------

/**
 * Per-character secondary-motion keyword sets.
 * Each entry specifies which keywords activate at each intensity level.
 */
const COSTUME_KEYWORDS: Record<string, readonly SecondaryKeyword[]> = {
  investor_gadget: [
    { keyword: 'trench coat gently swaying',          min_intensity: 'gentle',   direction: 'any'        },
    { keyword: 'hat brim trembling',                   min_intensity: 'gentle',   direction: 'any'        },
    { keyword: 'trench coat trailing behind',          min_intensity: 'moderate', direction: 'horizontal' },
    { keyword: 'hat brim fluttering',                  min_intensity: 'moderate', direction: 'any'        },
    { keyword: 'coat lapels flapping outward',         min_intensity: 'moderate', direction: 'any'        },
    { keyword: 'antenna whipping in motion',           min_intensity: 'moderate', direction: 'any'        },
    { keyword: 'trench coat billowing dramatically',   min_intensity: 'vigorous', direction: 'horizontal' },
    { keyword: 'tie streaming horizontally',           min_intensity: 'vigorous', direction: 'horizontal' },
    { keyword: 'coat tails perpendicular to motion',  min_intensity: 'sprint',   direction: 'horizontal' },
    { keyword: 'trench coat rising with vertical speed', min_intensity: 'vigorous', direction: 'vertical'  },
    { keyword: 'dynamic motion blur on costume edges', min_intensity: 'vigorous', direction: 'any'        },
    { keyword: 'cinematic secondary motion, fabric physics', min_intensity: 'vigorous', direction: 'any'  },
  ],
  mouse_01: [
    { keyword: 'long tail swaying behind',            min_intensity: 'gentle',   direction: 'any'        },
    { keyword: 'round ears bouncing',                 min_intensity: 'moderate', direction: 'any'        },
    { keyword: 'tail streaming behind',               min_intensity: 'moderate', direction: 'horizontal' },
    { keyword: 'tail whipping vigorously',            min_intensity: 'vigorous', direction: 'horizontal' },
    { keyword: 'fur ruffled by motion',               min_intensity: 'vigorous', direction: 'any'        },
  ],
};

/** Fallback keywords used when the character is not in the registry. */
const GENERIC_KEYWORDS: readonly SecondaryKeyword[] = [
  { keyword: 'gentle cloth movement',              min_intensity: 'gentle',   direction: 'any' },
  { keyword: 'clothing trailing behind',           min_intensity: 'moderate', direction: 'horizontal' },
  { keyword: 'vigorous secondary motion on outfit',min_intensity: 'vigorous', direction: 'any' },
];

// ---------------------------------------------------------------------------
// Intensity ordering (for threshold comparisons)
// ---------------------------------------------------------------------------

const INTENSITY_ORDER: Record<MotionIntensity, number> = {
  still:    0,
  gentle:   1,
  moderate: 2,
  vigorous: 3,
  sprint:   4,
};

function meetsIntensity(actual: MotionIntensity, required: MotionIntensity): boolean {
  return INTENSITY_ORDER[actual] >= INTENSITY_ORDER[required];
}

// ---------------------------------------------------------------------------
// SecondaryMotion — the main class
// ---------------------------------------------------------------------------

/**
 * SecondaryMotion
 *
 * Calculates secondary motion keywords for a character based on its
 * current velocity vector from the Cartesian physics engine.
 *
 * The velocity values should be taken directly from PhysicsMap.motion:
 *   velocity_x = motion.delta_x / motion.travel_time_s
 *   velocity_y = motion.delta_y / motion.travel_time_s
 *
 * Or compute them from two consecutive frame_sequence entries.
 */
export class SecondaryMotion {
  private readonly input: SecondaryMotionInput;
  private readonly speed: number;
  private readonly intensity: MotionIntensity;
  private readonly dominantDirection: 'horizontal' | 'vertical';

  constructor(input: SecondaryMotionInput) {
    this.input = input;

    // Total speed (Euclidean magnitude of velocity vector)
    this.speed = Math.sqrt(input.velocity_x ** 2 + input.velocity_y ** 2);

    // Classify intensity band
    this.intensity = this.classifyIntensity(this.speed);

    // Determine dominant axis
    this.dominantDirection =
      Math.abs(input.velocity_x) >= Math.abs(input.velocity_y)
        ? 'horizontal'
        : 'vertical';
  }

  private classifyIntensity(speed: number): MotionIntensity {
    if (speed < MOTION_THRESHOLDS.STILL)    return 'still';
    if (speed < MOTION_THRESHOLDS.GENTLE)   return 'gentle';
    if (speed < MOTION_THRESHOLDS.MODERATE) return 'gentle';
    if (speed < MOTION_THRESHOLDS.VIGOROUS) return 'moderate';
    if (speed < MOTION_THRESHOLDS.SPRINT)   return 'vigorous';
    return 'sprint';
  }

  /** The computed speed magnitude (Euclidean, normalised u/s). */
  get speedMagnitude(): number {
    return Math.round(this.speed * 10_000) / 10_000;
  }

  /** The motion intensity band for the current velocity. */
  get motionIntensity(): MotionIntensity {
    return this.intensity;
  }

  /**
   * Returns the list of secondary-motion keywords active at the
   * current speed and direction.
   *
   * Returns an empty array when the character is effectively still.
   */
  keywords(): string[] {
    if (this.intensity === 'still') return [];

    const costumes =
      COSTUME_KEYWORDS[this.input.character_id] ?? GENERIC_KEYWORDS;

    return costumes
      .filter(kw => {
        if (!meetsIntensity(this.intensity, kw.min_intensity)) return false;
        if (!kw.direction || kw.direction === 'any') return true;
        return kw.direction === this.dominantDirection;
      })
      .map(kw => kw.keyword);
  }

  /**
   * Returns a comma-separated prompt descriptor string ready to append
   * to a frame prompt.  Returns an empty string when the character is still.
   */
  promptDescriptor(): string {
    return this.keywords().join(', ');
  }

  /**
   * Appends the secondary-motion descriptor to a base prompt string.
   * Does nothing (returns basePrompt unchanged) when the character is still.
   *
   * @param basePrompt  The existing frame prompt.
   * @returns           Enhanced prompt with secondary motion appended.
   */
  appendToPrompt(basePrompt: string): string {
    const descriptor = this.promptDescriptor();
    if (!descriptor) return basePrompt;
    return `${basePrompt}, ${descriptor}`;
  }
}

// ---------------------------------------------------------------------------
// Convenience: build SecondaryMotion from a PhysicsMap delta
// ---------------------------------------------------------------------------

/**
 * secondaryMotionFromDelta
 *
 * Constructs a SecondaryMotion from the delta values in a PhysicsMap.motion.
 *
 * @param characterId   Character key.
 * @param delta_x       motion.delta_x (signed displacement, 0..1 scale).
 * @param delta_y       motion.delta_y.
 * @param travel_time_s motion.travel_time_s (seconds to traverse the delta).
 */
export function secondaryMotionFromDelta(
  characterId: string,
  delta_x: number,
  delta_y: number,
  travel_time_s: number
): SecondaryMotion {
  const safeTime = travel_time_s > 0 ? travel_time_s : 1;
  return new SecondaryMotion({
    velocity_x: delta_x / safeTime,
    velocity_y: delta_y / safeTime,
    character_id: characterId,
  });
}
