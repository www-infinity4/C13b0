/**
 * Cartoon Prompt Engine — 3-D Physics Engine
 *
 * Extends the 2-D physics engine with a Z-axis (depth).
 * All calculations remain deterministic — no randomness, no AI inference.
 *
 * The coordinate system:
 *   X  0..1  left → right
 *   Y  0..1  top  → bottom
 *   Z  0..1  near (foreground) → far (background)
 *
 * Uses:
 *   - Camera dolly/truck paths (Z changes produce depth movement)
 *   - Character depth within a scene (foreground ↔ background layers)
 *   - Parallax layer animation
 *   - 3-D camera splines for complex shots
 *
 * DimensionMode.MESH_3D must be set in the blueprint when using this module.
 * In FLAT_2D mode, simply use the 2-D physics engine and ignore Z.
 *
 * Usage:
 *   import { buildPhysicsMap3D } from './physics3d';
 *
 *   const map = buildPhysicsMap3D({
 *     character_id:        'investor_gadget',
 *     initial_position:    { x: 0.1, y: 0.8, z: 0.9 },  // far background
 *     target_position:     { x: 0.5, y: 0.8, z: 0.2 },  // moves to foreground
 *     velocity_units_per_s: 0.3,
 *     fps:                 24,
 *   });
 *   // map.motion.delta_z           === -0.7  (moves toward camera)
 *   // map.motion.frames_to_target  === 61
 */

import { Vector3D, MotionVector3D, PhysicsMap3D, DimensionMode } from './types';

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function r4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 3-D Euclidean distance between two points. */
export function euclidean3D(a: Vector3D, b: Vector3D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

// ---------------------------------------------------------------------------
// PhysicsMap3D builder
// ---------------------------------------------------------------------------

export interface PhysicsMap3DInput {
  character_id: string;
  initial_position: Vector3D;
  target_position: Vector3D;
  velocity_units_per_s: number;
  fps: number;
}

/**
 * buildPhysicsMap3D
 *
 * Calculates deterministic 3-D motion from start to target at a constant
 * velocity, producing per-frame (x, y, z) position vectors.
 *
 * The result is a PhysicsMap3D with DimensionMode set to MESH_3D.
 * Every downstream consumer that reads this map knows it must interpret
 * Z as scene depth, not ignore it.
 *
 * @param input  Character ID, 3-D positions, velocity, and fps.
 * @returns      Fully populated PhysicsMap3D (immutable).
 */
export function buildPhysicsMap3D(input: PhysicsMap3DInput): PhysicsMap3D {
  const { initial_position: ip, target_position: tp } = input;
  const vel = input.velocity_units_per_s;
  const fps = input.fps;

  if (vel <= 0) throw new RangeError(`velocity_units_per_s must be > 0 (got ${vel})`);
  if (fps <= 0) throw new RangeError(`fps must be > 0 (got ${fps})`);

  const delta_x = r4(tp.x - ip.x);
  const delta_y = r4(tp.y - ip.y);
  const delta_z = r4(tp.z - ip.z);
  const distance = r4(euclidean3D(ip, tp));

  const dimension_mode: DimensionMode = 'MESH_3D';

  if (distance === 0) {
    const motion: MotionVector3D = {
      delta_x: 0, delta_y: 0, delta_z: 0,
      distance: 0, travel_time_s: 0, frames_to_target: 0,
      frame_sequence: [{ x: r4(ip.x), y: r4(ip.y), z: r4(ip.z) }],
    };
    return { ...input, dimension_mode, motion };
  }

  const travel_time_s    = r4(distance / vel);
  const frames_to_target = Math.round(travel_time_s * fps);

  const frame_sequence: Vector3D[] = [];
  for (let f = 0; f <= frames_to_target; f++) {
    const t = f / frames_to_target;
    frame_sequence.push({
      x: r4(clamp(ip.x + delta_x * t, 0, 1)),
      y: r4(clamp(ip.y + delta_y * t, 0, 1)),
      z: r4(clamp(ip.z + delta_z * t, 0, 1)),
    });
  }

  const motion: MotionVector3D = {
    delta_x, delta_y, delta_z,
    distance, travel_time_s, frames_to_target,
    frame_sequence,
  };

  return { ...input, dimension_mode, motion };
}

/**
 * positionAtFrame3D
 *
 * Returns the character's (x, y, z) position at an arbitrary frame,
 * clamping to target once travel is complete.
 */
export function positionAtFrame3D(map: PhysicsMap3D, frame: number): Vector3D {
  const seq = map.motion.frame_sequence;
  if (frame <= 0)             return seq[0];
  if (frame >= seq.length - 1) return seq[seq.length - 1];
  return seq[frame];
}

// ---------------------------------------------------------------------------
// Convenience: Gadget camera dolly (foreground approach)
// ---------------------------------------------------------------------------

/**
 * gadgetCameraDolly
 *
 * Pre-calculated 3-D physics for a camera dolly-in on Investor Gadget:
 * camera starts far back (z=0.9) and dollies forward (z=0.15) while
 * keeping X and Y centred.  This creates the classic "hero reveal" shot.
 *
 * At 24 fps / 0.3 u·s⁻¹ this produces ~60 frames (2.5 s) of movement.
 */
export function gadgetCameraDolly(fps = 24): PhysicsMap3D {
  return buildPhysicsMap3D({
    character_id:         'investor_gadget',
    initial_position:     { x: 0.5, y: 0.5, z: 0.9 },
    target_position:      { x: 0.5, y: 0.5, z: 0.15 },
    velocity_units_per_s: 0.3,
    fps,
  });
}
