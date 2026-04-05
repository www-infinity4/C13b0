/**
 * Cartoon Prompt Engine — Audio Engine: Motif Mapper
 *
 * Maps animation scene tokens to classical/cinematic musical motifs
 * expressed as MIDI data and prompt vocabulary.
 *
 * This is the TypeScript data and logic layer for the audio engine.
 * Actual audio synthesis requires an external MIDI sequencer, DAW, or
 * VST host connected to this engine's output.  The MotifMapper produces
 * deterministic, structured data — it never generates audio directly.
 *
 * "Mickey Mousing": the classic animation technique where music mimics
 * on-screen action beat-for-beat.  This mapper encodes that relationship
 * as data so the correct motif fires automatically from an animation token.
 *
 * Usage:
 *   import { MotifMapper } from './composer';
 *
 *   const mapper = new MotifMapper();
 *   const motif  = mapper.getMotif('rescue');
 *   // motif.midiNotes  → [67, 71, 74, 79]  (G major arpeggio)
 *   // motif.tempo_bpm  → 140
 *   // motif.promptFragment → "triumphant orchestral fanfare, brass stabs..."
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** MIDI channel message types used in motif sequences. */
export type MidiMessageType = 'note_on' | 'note_off' | 'control_change' | 'program_change';

/** A single MIDI event in a motif sequence. */
export interface MidiEvent {
  /** Position in the sequence (beats from start, e.g. 0.0, 0.5, 1.0). */
  beat: number;
  type: MidiMessageType;
  /** MIDI channel (1–16). */
  channel: number;
  /** MIDI note number (0–127) — used for note_on / note_off. */
  note?: number;
  /** MIDI velocity (1–127) — used for note_on. */
  velocity?: number;
  /** Controller number — used for control_change. */
  controller?: number;
  /** Controller value (0–127) — used for control_change. */
  value?: number;
}

/** Orchestration style for a motif. */
export type OrchestrationStyle =
  | 'brass_fanfare'
  | 'strings_suspense'
  | 'woodwind_comedy'
  | 'full_orchestra'
  | 'solo_piano'
  | 'percussion_action'
  | 'harp_glissando';

/** A complete musical motif linked to one or more animation scene tokens. */
export interface AnimationMotif {
  /** Internal motif identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Scene token(s) that trigger this motif. */
  triggers: readonly string[];
  /** Tempo in beats per minute. */
  tempo_bpm: number;
  /** Time signature numerator. */
  time_signature_numerator: number;
  /** Time signature denominator. */
  time_signature_denominator: number;
  /** MIDI note sequence (melody / top voice). */
  midiNotes: readonly number[];
  /** MIDI velocity per note; aligns with midiNotes by index. */
  midiVelocities: readonly number[];
  /** Note durations in beats; aligns with midiNotes by index. */
  noteDurations: readonly number[];
  /** Full MIDI event sequence (all voices, control changes, etc.). */
  midiSequence: readonly MidiEvent[];
  /** General MIDI program number (instrument). */
  gmProgram: number;
  orchestration: OrchestrationStyle;
  /** Prompt fragment to append to any frame prompt for this scene. */
  promptFragment: string;
  /**
   * CC11 (Expression) level as a fraction 0.0–1.0.
   * Map MIDI velocity to this value to scale orchestral volume.
   */
  expressionLevel: number;
}

// ---------------------------------------------------------------------------
// Motif registry
// ---------------------------------------------------------------------------

/**
 * MOTIF_REGISTRY
 *
 * Named musical motifs for the canonical Investor Gadget scenes.
 * Each motif encodes:
 *   - MIDI melody in the top voice
 *   - GM instrument (program number)
 *   - Prompt vocabulary for the visual frame
 *   - CC11 expression level for dynamic orchestral scaling
 *
 * MIDI program numbers follow General MIDI specification.
 */
export const MOTIF_REGISTRY: readonly AnimationMotif[] = [
  // ── Rescue / Action ────────────────────────────────────────────────────────
  {
    id:                          'gadget_rescue_fanfare',
    name:                        'Gadget Rescue Fanfare',
    triggers:                    ['rescue', 'parking_lot_rescue', 'gadget_establishing'],
    tempo_bpm:                   140,
    time_signature_numerator:    4,
    time_signature_denominator:  4,
    // G major arpeggio rising — Rossini-style heroic ascent
    midiNotes:      [67, 71, 74, 79, 74, 71, 67],
    midiVelocities: [90, 95, 100, 110, 95, 85, 80],
    noteDurations:  [0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 1.0],
    midiSequence: [
      { beat: 0.0, type: 'program_change', channel: 1, value: 56 }, // trumpet
      { beat: 0.0, type: 'control_change', channel: 1, controller: 11, value: 110 }, // CC11 expression
      { beat: 0.0, type: 'note_on',  channel: 1, note: 67, velocity: 90  },
      { beat: 0.5, type: 'note_off', channel: 1, note: 67                },
      { beat: 0.5, type: 'note_on',  channel: 1, note: 71, velocity: 95  },
      { beat: 1.0, type: 'note_off', channel: 1, note: 71                },
      { beat: 1.0, type: 'note_on',  channel: 1, note: 74, velocity: 100 },
      { beat: 1.5, type: 'note_off', channel: 1, note: 74                },
      { beat: 1.5, type: 'note_on',  channel: 1, note: 79, velocity: 110 },
      { beat: 2.5, type: 'note_off', channel: 1, note: 79                },
    ],
    gmProgram:       56, // trumpet
    orchestration:   'brass_fanfare',
    promptFragment:  'triumphant orchestral fanfare, brass stabs, full orchestra crescendo, Rossini-style heroic ascent, cinematic score',
    expressionLevel: 0.87,
  },

  // ── Cheese Discovery / Comedy ───────────────────────────────────────────────
  {
    id:                          'mouse_cheese_discovery',
    name:                        'Cheese Discovery Sting',
    triggers:                    ['cheese_discovery', 'cheese'],
    tempo_bpm:                   120,
    time_signature_numerator:    4,
    time_signature_denominator:  4,
    // C major comedic bounce — ascending thirds then a surprised fall
    midiNotes:      [60, 64, 67, 72, 67, 60, 55],
    midiVelocities: [70, 75, 80, 100, 70, 65, 60],
    noteDurations:  [0.25, 0.25, 0.25, 0.5, 0.25, 0.25, 1.0],
    midiSequence: [
      { beat: 0.0, type: 'program_change', channel: 1, value: 73 }, // piccolo
      { beat: 0.0, type: 'control_change', channel: 1, controller: 11, value: 85 },
      { beat: 0.0, type: 'note_on',  channel: 1, note: 60, velocity: 70 },
      { beat: 0.25, type: 'note_off', channel: 1, note: 60              },
      { beat: 0.25, type: 'note_on',  channel: 1, note: 64, velocity: 75 },
      { beat: 0.5,  type: 'note_off', channel: 1, note: 64              },
      { beat: 0.5,  type: 'note_on',  channel: 1, note: 67, velocity: 80 },
      { beat: 0.75, type: 'note_off', channel: 1, note: 67              },
      { beat: 0.75, type: 'note_on',  channel: 1, note: 72, velocity: 100 },
      { beat: 1.25, type: 'note_off', channel: 1, note: 72              },
    ],
    gmProgram:       73, // piccolo
    orchestration:   'woodwind_comedy',
    promptFragment:  'whimsical woodwind sting, comedic surprise stab, playful orchestration, cartoon bounce rhythm',
    expressionLevel: 0.67,
  },

  // ── Arm Extension / Gadget Tech ────────────────────────────────────────────
  {
    id:                          'gadget_arm_extension',
    name:                        'Gadget Arm Extension Whir',
    triggers:                    ['gadget_arm_extension'],
    tempo_bpm:                   100,
    time_signature_numerator:    4,
    time_signature_denominator:  4,
    // Chromatic ascending run — mechanical, tense
    midiNotes:      [48, 50, 52, 53, 55, 57, 59, 60],
    midiVelocities: [60, 65, 70, 75, 80, 85, 90, 95],
    noteDurations:  [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5],
    midiSequence: [
      { beat: 0.0, type: 'program_change', channel: 1, value: 38 }, // synth bass 1
      { beat: 0.0, type: 'control_change', channel: 1, controller: 11, value: 75 },
      { beat: 0.0, type: 'note_on',  channel: 1, note: 48, velocity: 60 },
      { beat: 0.25, type: 'note_off', channel: 1, note: 48             },
      { beat: 0.25, type: 'note_on',  channel: 1, note: 50, velocity: 65 },
      { beat: 0.5,  type: 'note_off', channel: 1, note: 50             },
      { beat: 0.5,  type: 'note_on',  channel: 1, note: 52, velocity: 70 },
      { beat: 0.75, type: 'note_off', channel: 1, note: 52             },
      { beat: 0.75, type: 'note_on',  channel: 1, note: 53, velocity: 75 },
      { beat: 1.0,  type: 'note_off', channel: 1, note: 53             },
    ],
    gmProgram:       38, // synth bass 1 — mechanical feel
    orchestration:   'percussion_action',
    promptFragment:  'mechanical whirring underscore, tension-building chromatic ascent, robotic SFX-music hybrid',
    expressionLevel: 0.59,
  },
] as const;

// ---------------------------------------------------------------------------
// MotifMapper class
// ---------------------------------------------------------------------------

/**
 * MotifMapper
 *
 * Looks up the appropriate AnimationMotif for a scene token and scales
 * the MIDI expression level (CC11) by the performer's MIDI velocity.
 *
 * This is the bridge between the animation token system and the MIDI
 * output bus: the mapper tells the audio pipeline what to play and
 * at what dynamic level.
 */
export class MotifMapper {
  private readonly registry: readonly AnimationMotif[];

  constructor(registry: readonly AnimationMotif[] = MOTIF_REGISTRY) {
    this.registry = registry;
  }

  /**
   * Returns the AnimationMotif whose triggers include the given scene token.
   * Returns null when no motif is registered for the token.
   *
   * @param sceneToken  Scene identifier, e.g. "rescue" or "cheese_discovery".
   */
  getMotif(sceneToken: string): AnimationMotif | null {
    return (
      this.registry.find(m => m.triggers.includes(sceneToken)) ?? null
    );
  }

  /**
   * Returns the prompt fragment for the given scene token.
   * Returns an empty string when the token is unregistered.
   */
  getPromptFragment(sceneToken: string): string {
    return this.getMotif(sceneToken)?.promptFragment ?? '';
  }

  /**
   * Scales a motif's CC11 expression level by the performer's MIDI velocity.
   *
   * Maps velocity (1–127) to a [0, 1] multiplier applied to the motif's
   * base expressionLevel.  Use this value to set CC11 on your MIDI bus.
   *
   * @param sceneToken  Scene trigger token.
   * @param velocity    MIDI velocity of the triggering note (1–127).
   * @returns           Scaled CC11 value (0–127 integer), or null if no motif found.
   */
  scaledExpression(sceneToken: string, velocity: number): number | null {
    const motif = this.getMotif(sceneToken);
    if (!motif) return null;
    const velRatio = Math.max(1, Math.min(127, velocity)) / 127;
    return Math.round(motif.expressionLevel * velRatio * 127);
  }

  /** Returns all registered motif IDs. */
  get motifIds(): string[] {
    return this.registry.map(m => m.id);
  }
}
