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
// Bézier motion smoothing
// ---------------------------------------------------------------------------

/**
 * smoothMotionBezier
 *
 * Replaces the linear frame_sequence in a PhysicsMap with a cubic
 * Bézier-smoothed path of the same length.
 *
 * A linear sequence has constant velocity — the character moves at the same
 * speed every frame.  A Bézier-smoothed sequence has ease-in / ease-out:
 * the character accelerates from rest, reaches peak speed at mid-path, then
 * decelerates to a stop.  This matches how objects move in real animation.
 *
 * Control points:
 *   P0 — initial_position          (start, stationary)
 *   P1 — initial_position + 1/3 Δ  (ease-in tangent)
 *   P2 — target_position  − 1/3 Δ  (ease-out tangent)
 *   P3 — target_position            (end, stationary)
 *
 * The original PhysicsMap is not mutated; a new map is returned.
 * All other motion fields (delta_x, delta_y, distance, etc.) are preserved.
 *
 * Self-correction: if any Bézier frame falls outside [0, 1] on either axis
 * the value is clamped, preventing characters from leaving the safe frame.
 *
 * @param map  A PhysicsMap produced by buildPhysicsMap.
 * @returns    A new PhysicsMap with a Bézier-smoothed frame_sequence.
 */
export function smoothMotionBezier(map: PhysicsMap): PhysicsMap {
  const { initial_position: p0, target_position: p3 } = map;
  const n = map.motion.frames_to_target;

  if (n === 0) return map; // already at target — nothing to smooth

  // Cubic Bézier control points
  const p1: Vector2D = {
    x: p0.x + (p3.x - p0.x) / 3,
    y: p0.y + (p3.y - p0.y) / 3,
  };
  const p2: Vector2D = {
    x: p3.x - (p3.x - p0.x) / 3,
    y: p3.y - (p3.y - p0.y) / 3,
  };

  const frame_sequence: Vector2D[] = [];
  for (let f = 0; f <= n; f++) {
    const t  = f / n;
    const mt = 1 - t;
    // Standard cubic Bézier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    frame_sequence.push({
      x: r4(clamp(mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x, 0, 1)),
      y: r4(clamp(mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y, 0, 1)),
    });
  }

  return {
    ...map,
    motion: { ...map.motion, frame_sequence },
  };
}

/**
 * motionToleranceCheck
 *
 * Validates that no consecutive pair of frames in a PhysicsMap's sequence
 * moves more than `tolerancePct` of the frame (default 10 %).
 *
 * Returns an array of frame indices where the tolerance is exceeded.
 * An empty array means the sequence passes validation.
 *
 * This is the "Observer" self-correction check: if frames exceed tolerance,
 * pass the map through smoothMotionBezier() to correct the curve.
 *
 * @param map           PhysicsMap to validate.
 * @param tolerancePct  Maximum allowed per-frame displacement (0.0–1.0). Default 0.10.
 * @returns             Array of offending frame indices (empty = clean).
 */
export function motionToleranceCheck(
  map: PhysicsMap,
  tolerancePct = 0.10
): number[] {
  const seq      = map.motion.frame_sequence;
  const offenders: number[] = [];

  for (let f = 1; f < seq.length; f++) {
    const dx = seq[f].x - seq[f - 1].x;
    const dy = seq[f].y - seq[f - 1].y;
    const step = Math.sqrt(dx * dx + dy * dy);
    if (step > tolerancePct) offenders.push(f);
  }

  return offenders;
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
