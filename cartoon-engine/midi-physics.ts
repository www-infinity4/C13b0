/**
 * Cartoon Prompt Engine — MIDI → Physics Bridge
 *
 * Maps raw MIDI note data to deterministic PhysicsMapInput values.
 * No audio hardware is accessed here — this is pure arithmetic that
 * converts the integer ranges of the MIDI protocol into the normalised
 * (0..1) coordinate space used by buildPhysicsMap().
 *
 *   MIDI pitch  (0–127)  →  normalised X position (0.05–0.95)
 *   MIDI velocity (1–127) →  velocity_units_per_s  (0.05–0.50)
 *
 * When a performer plays a melody, these functions translate each note
 * into a specific character position and movement speed — no guessing,
 * no AI inference, just numbers.
 *
 * Usage (Node.js or browser):
 *   import { midiNoteToPhysicsInput, buildPhysicsMap } from '...';
 *
 *   const input = midiNoteToPhysicsInput({
 *     characterId:   'investor_gadget',
 *     pitchStart:    48,   // C3 → x ≈ 0.39
 *     pitchTarget:   72,   // C5 → x ≈ 0.56
 *     velocity:      100,  // hard hit → speed ≈ 0.40 units/s
 *     yPosition:     0.8,
 *     fps:           24,
 *   });
 *   const map = buildPhysicsMap(input);
 */

import { PhysicsMapInput } from './physics';

// ---------------------------------------------------------------------------
// MIDI range constants
// ---------------------------------------------------------------------------

const MIDI_MIN = 0;
const MIDI_MAX = 127;
const MIDI_VEL_MIN = 1;   // velocity 0 = note-off; skip it

// ---------------------------------------------------------------------------
// Mapping functions (all pure, deterministic)
// ---------------------------------------------------------------------------

/**
 * midiPitchToX
 *
 * Converts a MIDI pitch (0–127) to a normalised screen X coordinate (0.05–0.95).
 * Lower pitches map to the left side of the frame; higher pitches to the right.
 *
 * The 5 % margin on each side keeps characters inside the safe frame area.
 *
 * @param pitch  MIDI note number, clamped to 0–127.
 * @returns      Normalised X in [0.05, 0.95].
 */
export function midiPitchToX(pitch: number): number {
  const p = Math.max(MIDI_MIN, Math.min(MIDI_MAX, pitch));
  return Math.round((0.05 + (p / MIDI_MAX) * 0.90) * 1_000) / 1_000;
}

/**
 * midiVelocityToSpeed
 *
 * Converts a MIDI velocity (1–127) to a movement speed in normalised
 * units per second (0.05–0.50).
 *
 *   velocity   1 →  0.050 u/s  (pianissimo — slow drift)
 *   velocity  64 →  0.276 u/s  (mezzo-forte — brisk walk)
 *   velocity 127 →  0.500 u/s  (fortissimo — sprint)
 *
 * @param velocity  MIDI velocity, clamped to 1–127.
 * @returns         Speed in [0.05, 0.50] normalised units per second.
 */
export function midiVelocityToSpeed(velocity: number): number {
  const v = Math.max(MIDI_VEL_MIN, Math.min(MIDI_MAX, velocity));
  return Math.round((0.05 + ((v - 1) / (MIDI_MAX - 1)) * 0.45) * 1_000) / 1_000;
}

// ---------------------------------------------------------------------------
// Main bridge: MIDI note pair → PhysicsMapInput
// ---------------------------------------------------------------------------

export interface MidiPhysicsParams {
  /** Registered character key (e.g. "investor_gadget"). */
  characterId: string;
  /** MIDI note number for the initial X position (lower = left). */
  pitchStart: number;
  /** MIDI note number for the target X position. */
  pitchTarget: number;
  /** MIDI velocity — controls movement speed. */
  velocity: number;
  /** Fixed Y position in normalised coords (0 = top, 1 = bottom). */
  yPosition: number;
  /** Animation frame rate. */
  fps: number;
}

/**
 * midiNoteToPhysicsInput
 *
 * Converts a pair of MIDI pitches and a velocity into a PhysicsMapInput
 * ready to be fed to buildPhysicsMap().
 *
 * This is the core bridge between a MIDI performance and the Cartesian
 * animation engine: the performer's intent (pitch choice, key pressure)
 * deterministically controls where the character starts, where they end
 * up, and how quickly they move.
 */
export function midiNoteToPhysicsInput(params: MidiPhysicsParams): PhysicsMapInput {
  return {
    character_id: params.characterId,
    initial_position: {
      x: midiPitchToX(params.pitchStart),
      y: params.yPosition,
    },
    target_position: {
      x: midiPitchToX(params.pitchTarget),
      y: params.yPosition,
    },
    velocity_units_per_s: midiVelocityToSpeed(params.velocity),
    fps: params.fps,
  };
}

// ---------------------------------------------------------------------------
// Gadget arm-extension helper
// ---------------------------------------------------------------------------

/**
 * gadgetArmExtension
 *
 * A specialised bridge for Investor Gadget's arm/gadget extension action.
 * Maps MIDI pitch to how far the arm extends (0 = fully retracted, 1 = fully
 * extended) and velocity to the extension speed.
 *
 * This produces a Y-axis motion: arm extends upward (lower Y) from the
 * default resting position.
 *
 * @param pitch     MIDI pitch — controls extension length.
 * @param velocity  MIDI velocity — controls extension speed.
 * @param fps       Frame rate.
 * @returns         PhysicsMapInput for the arm-extension motion.
 */
export function gadgetArmExtension(
  pitch: number,
  velocity: number,
  fps: number
): PhysicsMapInput {
  const extensionRatio = midiPitchToX(pitch); // repurposed: 0.05 = retracted, 0.95 = fully extended
  return {
    character_id: 'investor_gadget',
    initial_position: { x: 0.5, y: 0.8 },                           // resting position
    target_position:  { x: 0.5, y: 0.8 - extensionRatio * 0.6 },    // extends upward
    velocity_units_per_s: midiVelocityToSpeed(velocity),
    fps,
  };
}
