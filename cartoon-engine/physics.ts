/**
 * Cartoon Prompt Engine — Physics Engine
 *
 * Deterministic Cartesian coordinate calculator.
 * No randomness, no AI inference — pure arithmetic.
 *
 * The screen is modelled as a normalised [0, 1] × [0, 1] Cartesian plane:
 *   X = 0  →  left edge
 *   X = 1  →  right edge
 *   Y = 0  →  top edge
 *   Y = 1  →  bottom edge
 *
 * Usage:
 *   import { buildPhysicsMap, positionAtFrame } from './physics';
 *
 *   const map = buildPhysicsMap({
 *     character_id: 'investor_gadget',
 *     initial_position: { x: 0.1, y: 0.8 },
 *     target_position:  { x: 0.5, y: 0.8 },
 *     velocity_units_per_s: 0.2,
 *     fps: 24,
 *   });
 *   // map.motion.delta_x          === 0.4
 *   // map.motion.frames_to_target === 48
 *   // map.motion.frame_sequence[0] ≈ { x: 0.1, y: 0.8 }
 *   // map.motion.frame_sequence[48] ≈ { x: 0.5, y: 0.8 }
 */

import { Vector2D, MotionVector, PhysicsMap } from './types';

// ---------------------------------------------------------------------------
// Core math helpers
// ---------------------------------------------------------------------------

/** Round to 4 decimal places to keep JSON output readable. */
function r4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Clamp a value to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Euclidean distance between two 2-D points. */
export function euclidean(a: Vector2D, b: Vector2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// ---------------------------------------------------------------------------
// PhysicsMap builder
// ---------------------------------------------------------------------------

/**
 * Input parameters for `buildPhysicsMap`.
 * The `motion` field is always calculated — do not supply it.
 */
export type PhysicsMapInput = Omit<PhysicsMap, 'motion'>;

/**
 * buildPhysicsMap
 *
 * Given a character's start/end position and a constant velocity,
 * calculates every derived value for a 24 fps (or custom fps) animation:
 *
 *  - deltaX / deltaY      : signed displacement
 *  - distance             : Euclidean length of the path
 *  - travel_time_s        : wall-clock seconds at the given velocity
 *  - frames_to_target     : integer frame count
 *  - frame_sequence       : per-frame (x, y) position vectors
 *
 * @param input  Character ID, positions, velocity, and fps.
 * @returns      Fully populated PhysicsMap (immutable).
 */
export function buildPhysicsMap(input: PhysicsMapInput): PhysicsMap {
  const { initial_position: ip, target_position: tp } = input;
  const vel = input.velocity_units_per_s;
  const fps = input.fps;

  if (vel <= 0) {
    throw new RangeError(
      `velocity_units_per_s must be > 0 (got ${vel})`
    );
  }
  if (fps <= 0) {
    throw new RangeError(`fps must be > 0 (got ${fps})`);
  }

  const delta_x = r4(tp.x - ip.x);
  const delta_y = r4(tp.y - ip.y);
  const distance = r4(euclidean(ip, tp));

  // If character is already at target, return a zero-length sequence.
  if (distance === 0) {
    const motion: MotionVector = {
      delta_x: 0,
      delta_y: 0,
      distance: 0,
      travel_time_s: 0,
      frames_to_target: 0,
      frame_sequence: [{ x: r4(ip.x), y: r4(ip.y) }],
    };
    return { ...input, motion };
  }

  const travel_time_s = r4(distance / vel);
  const frames_to_target = Math.round(travel_time_s * fps);

  // Linear interpolation: position at frame f ∈ [0, frames_to_target]
  const frame_sequence: Vector2D[] = [];
  for (let f = 0; f <= frames_to_target; f++) {
    const t = frames_to_target === 0 ? 1 : f / frames_to_target;
    frame_sequence.push({
      x: r4(clamp(ip.x + delta_x * t, 0, 1)),
      y: r4(clamp(ip.y + delta_y * t, 0, 1)),
    });
  }

  const motion: MotionVector = {
    delta_x,
    delta_y,
    distance,
    travel_time_s,
    frames_to_target,
    frame_sequence,
  };

  return { ...input, motion };
}

/**
 * positionAtFrame
 *
 * Returns the character's (x, y) position at an arbitrary frame number,
 * clamping to the target once travel is complete.
 *
 * @param map    A fully built PhysicsMap.
 * @param frame  Zero-based frame index within the shot.
 */
export function positionAtFrame(map: PhysicsMap, frame: number): Vector2D {
  const seq = map.motion.frame_sequence;
  if (frame <= 0) return seq[0];
  if (frame >= seq.length - 1) return seq[seq.length - 1];
  return seq[frame];
}

// ---------------------------------------------------------------------------
// Convenience: build a parking-lot rescue PhysicsMap for Investor Gadget
// ---------------------------------------------------------------------------

/**
 * parkingLotRescuePhysics
 *
 * Pre-calculated physics for the canonical "Investor Gadget rescues someone
 * in a parking lot" scenario:
 *
 *   Gadget enters from the left [0.1, 0.8],
 *   crosses to the rescue point   [0.5, 0.8],
 *   at a brisk trot of 0.2 normalised units/second.
 *
 * At 24 fps this produces 48 frames of travel (2 s), matching the
 * opening 3-second action block with 1 s of hold/reaction remaining.
 */
export function parkingLotRescuePhysics(fps = 24): PhysicsMap {
  return buildPhysicsMap({
    character_id: 'investor_gadget',
    initial_position: { x: 0.1, y: 0.8 },
    target_position: { x: 0.5, y: 0.8 },
    velocity_units_per_s: 0.2,
    fps,
  });
}
