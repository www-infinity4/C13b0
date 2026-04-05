/**
 * Token Engine — Named Patterns
 *
 * A "pattern" is a named sequence of input events (keystroke codes or MIDI
 * note numbers) that, when matched, triggers a named animation scene.
 *
 * Keystroke patterns: match a rolling window of KeyboardEvent.code values.
 * MIDI chord patterns: match a set of simultaneously held MIDI note numbers.
 *
 * Adding a new pattern is a one-liner — no other files need changing.
 * The listener reads this registry at runtime to decide what to fire.
 */

// ---------------------------------------------------------------------------
// Keystroke patterns
// ---------------------------------------------------------------------------

export interface KeyPattern {
  /** Unique pattern name (used as scene trigger key). */
  name: string;
  description: string;
  /**
   * Ordered sequence of KeyboardEvent.code values to match.
   * The listener checks the tail of the rolling sequence buffer.
   */
  sequence: string[];
  /** Scene identifier passed to the TriggerCallback. */
  scene: string;
  /** Character to use when generating the triggered scene. */
  character_id: string;
}

export const KEY_PATTERNS: readonly KeyPattern[] = [
  {
    name: 'rescue',
    description:
      'Type R-E-S-C-U-E to trigger the Investor Gadget parking lot rescue scene.',
    sequence: ['KeyR', 'KeyE', 'KeyS', 'KeyC', 'KeyU', 'KeyE'],
    scene: 'parking_lot_rescue',
    character_id: 'investor_gadget',
  },
  {
    name: 'cheese',
    description: 'Type C-H-E-E-S-E to trigger the mouse cheese discovery scene.',
    sequence: ['KeyC', 'KeyH', 'KeyE', 'KeyE', 'KeyS', 'KeyE'],
    scene: 'cheese_discovery',
    character_id: 'mouse_01',
  },
  {
    name: 'gadget',
    description: 'Type G-A-D-G-E-T to trigger an Investor Gadget establishing shot.',
    sequence: ['KeyG', 'KeyA', 'KeyD', 'KeyG', 'KeyE', 'KeyT'],
    scene: 'gadget_establishing',
    character_id: 'investor_gadget',
  },
] as const;

// ---------------------------------------------------------------------------
// MIDI chord patterns
// ---------------------------------------------------------------------------

export interface MidiChordPattern {
  /** Unique pattern name. */
  name: string;
  description: string;
  /**
   * MIDI note numbers (0–127) that must be held simultaneously.
   * Stored in ascending order; matching is order-independent.
   */
  chord: readonly number[];
  scene: string;
  character_id: string;
}

export const MIDI_CHORD_PATTERNS: readonly MidiChordPattern[] = [
  {
    name: 'gadget_rescue_chord',
    description:
      'C major chord (C4=60, E4=64, G4=67) triggers the Investor Gadget rescue scene. ' +
      'MIDI velocity controls movement speed; higher pitch maps to further right on screen.',
    chord: [60, 64, 67],
    scene: 'parking_lot_rescue',
    character_id: 'investor_gadget',
  },
  {
    name: 'mouse_cheese_chord',
    description: 'G major chord (G3=55, B3=59, D4=62) triggers the mouse cheese scene.',
    chord: [55, 59, 62],
    scene: 'cheese_discovery',
    character_id: 'mouse_01',
  },
  {
    name: 'gadget_arm_chord',
    description:
      'D minor chord (D4=62, F4=65, A4=69) triggers Gadget arm-extension animation. ' +
      'Pitch maps to extension length; velocity maps to extension speed.',
    chord: [62, 65, 69],
    scene: 'gadget_arm_extension',
    character_id: 'investor_gadget',
  },
] as const;

// ---------------------------------------------------------------------------
// Pattern matching (pure functions — no side effects)
// ---------------------------------------------------------------------------

/**
 * matchKeySequence
 *
 * Checks whether the tail of the rolling keystroke buffer matches any
 * registered KeyPattern.  Returns the first match, or null.
 *
 * @param sequence  Rolling buffer of KeyboardEvent.code values.
 */
export function matchKeySequence(sequence: readonly string[]): KeyPattern | null {
  for (const pattern of KEY_PATTERNS) {
    const len = pattern.sequence.length;
    if (sequence.length >= len) {
      const tail = sequence.slice(-len);
      if (tail.every((code, i) => code === pattern.sequence[i])) {
        return pattern;
      }
    }
  }
  return null;
}

/**
 * matchMidiChord
 *
 * Checks whether the set of currently held MIDI notes matches any
 * registered MidiChordPattern (order-independent).  Returns first match.
 *
 * @param heldNotes  Array of MIDI note numbers currently depressed.
 */
export function matchMidiChord(heldNotes: readonly number[]): MidiChordPattern | null {
  const sorted = [...heldNotes].sort((a, b) => a - b);
  for (const pattern of MIDI_CHORD_PATTERNS) {
    const chord = [...pattern.chord].sort((a, b) => a - b);
    if (
      sorted.length === chord.length &&
      sorted.every((n, i) => n === chord[i])
    ) {
      return pattern;
    }
  }
  return null;
}
