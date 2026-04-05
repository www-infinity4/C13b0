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

// ---------------------------------------------------------------------------
// Diatonic Chord Library — full chromatic coverage (12 keys × 7 degrees ×
// triads + 7th chords = 168 voicings)
// ---------------------------------------------------------------------------

/** Chord quality for a diatonic chord voicing. */
export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'major_7'
  | 'minor_7'
  | 'dominant_7'
  | 'half_diminished_7';

/** Camera/lighting guidance associated with a chord's emotional character. */
export interface SceneHint {
  /** Suggested lighting style, e.g. "warm golden". */
  lighting: string;
  /** Suggested camera move/framing, e.g. "wide, elevated". */
  camera: string;
  /** Short mood tag for downstream lookup, e.g. "triumphant". */
  mood_tag: string;
}

/**
 * ChordVoicing — one entry in the diatonic chord library.
 *
 * Identifies a chord by its root, quality, and the key/degree context
 * that produced it.  The pitch_classes set (mod 12, sorted ascending)
 * is used for order-independent matching against live MIDI input.
 */
export interface ChordVoicing {
  /** Unique name, e.g. "C_I_major" or "G_V_dominant_7". */
  name: string;
  /** Root note name, e.g. "D". */
  root: string;
  quality: ChordQuality;
  /** Roman-numeral scale degree in the parent key, e.g. "V". */
  degree: string;
  /**
   * Pitch-class set (0 = C, 1 = C#, …, 11 = B).
   * Stored in ascending order; matching is order-independent.
   */
  pitch_classes: readonly number[];
  /** Human-readable emotional character, e.g. "Heroic, Driving". */
  emotion: string;
  scene_hint: SceneHint;
}

/**
 * AnimationMood — the result of analysing a set of held MIDI notes.
 *
 * Returned by ChordAnalyzer.analyze().  All fields are ready to pass
 * directly to the prompt generator or timeline engine.
 */
export interface AnimationMood {
  chord_name: string;
  chord_quality: ChordQuality;
  /** 0 = root position, 1 = first inversion, 2 = second, 3 = third. */
  inversion: number;
  /** Human-readable inversion label: "Root", "1st", "2nd", "3rd". */
  inversion_label: string;
  /**
   * Sentiment score from −1.0 (darkest) to +1.0 (brightest).
   *
   *   +0.80  major (I, IV)
   *   +0.70  major 7th
   *   +0.30  dominant 7th
   *   −0.30  minor
   *   −0.40  minor 7th
   *   −0.80  half-diminished 7th
   *   −0.90  diminished
   */
  sentiment_score: number;
  lighting: string;
  camera: string;
  mood_tag: string;
  emotion: string;
}

// ---------------------------------------------------------------------------
// Library builder (runs once at module load — pure computation)
// ---------------------------------------------------------------------------

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;

const DEGREE_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** Triad intervals (from degree root) for each of the 7 diatonic scale degrees. */
const TRIAD_INTERVALS_BY_DEGREE: readonly [number, number, number][] = [
  [0, 4, 7], // I:   major
  [0, 3, 7], // II:  minor
  [0, 3, 7], // III: minor
  [0, 4, 7], // IV:  major
  [0, 4, 7], // V:   major
  [0, 3, 7], // VI:  minor
  [0, 3, 6], // VII: diminished
] as const;

/** 7th-chord intervals (from degree root) for each diatonic degree. */
const SEVENTH_INTERVALS_BY_DEGREE: readonly [number, number, number, number][] = [
  [0, 4, 7, 11], // I:   Maj7
  [0, 3, 7, 10], // II:  m7
  [0, 3, 7, 10], // III: m7
  [0, 4, 7, 11], // IV:  Maj7
  [0, 4, 7, 10], // V:   dom7
  [0, 3, 7, 10], // VI:  m7
  [0, 3, 6, 10], // VII: half-diminished (m7♭5)
] as const;

const TRIAD_QUALITIES: readonly ChordQuality[] = [
  'major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished',
] as const;

const SEVENTH_QUALITIES: readonly ChordQuality[] = [
  'major_7', 'minor_7', 'minor_7', 'major_7', 'dominant_7', 'minor_7', 'half_diminished_7',
] as const;

/** Emotion + scene guidance for each scale degree (triads). */
const TRIAD_SCENE_DATA = [
  { emotion: 'Bright, Triumphant',       lighting: 'warm golden',        camera: 'wide, elevated',       mood_tag: 'triumphant'    }, // I
  { emotion: 'Pensive, Introspective',   lighting: 'neutral, soft',      camera: 'medium',               mood_tag: 'contemplative' }, // II
  { emotion: 'Tense, Uneasy',            lighting: 'cool, desaturated',  camera: 'close-up',             mood_tag: 'uneasy'        }, // III
  { emotion: 'Yearning, Expansive',      lighting: 'golden hour',        camera: 'wide, crane',          mood_tag: 'searching'     }, // IV
  { emotion: 'Heroic, Driving',          lighting: 'dramatic contrast',  camera: 'low angle, action',    mood_tag: 'decisive'      }, // V
  { emotion: 'Melancholic, Bittersweet', lighting: 'blue tint, dusk',    camera: 'slow pan, medium',     mood_tag: 'bittersweet'   }, // VI
  { emotion: 'Dark, Suspenseful',        lighting: 'low-key, shadow',    camera: 'dutch angle',          mood_tag: 'ominous'       }, // VII
] as const;

/** Emotion + scene guidance for each scale degree (7th chords). */
const SEVENTH_SCENE_DATA = [
  { emotion: 'Lush, Cinematic',             lighting: 'warm, diffuse',      camera: 'dolly in, wide',       mood_tag: 'cinematic'    }, // IMaj7
  { emotion: 'Cool, Smooth',               lighting: 'neutral, clean',     camera: 'medium, steady',       mood_tag: 'smooth'       }, // IIm7
  { emotion: 'Mysterious, Brooding',       lighting: 'cool, dramatic',     camera: 'tight, low angle',     mood_tag: 'brooding'     }, // IIIm7
  { emotion: 'Nostalgic, Romantic',        lighting: 'warm, soft',         camera: 'rack focus',           mood_tag: 'nostalgic'    }, // IVMaj7
  { emotion: 'Tense, Bluesy, Driving',     lighting: 'high contrast',      camera: 'push in',              mood_tag: 'driving'      }, // V7
  { emotion: 'Wistful, Introspective',     lighting: 'blue, twilight',     camera: 'slow zoom out',        mood_tag: 'wistful'      }, // VIm7
  { emotion: 'Ominous, Darkly Suspenseful',lighting: 'near black, shadow', camera: 'extreme close-up',     mood_tag: 'ominous_deep' }, // VIIm7b5
] as const;

function buildDiatonicChordLibrary(): readonly ChordVoicing[] {
  const voicings: ChordVoicing[] = [];

  for (let rootPc = 0; rootPc < 12; rootPc++) {
    const keyName = NOTE_NAMES[rootPc];

    for (let degIdx = 0; degIdx < 7; degIdx++) {
      const degRootPc   = (rootPc + MAJOR_SCALE_INTERVALS[degIdx]) % 12;
      const degRootName = NOTE_NAMES[degRootPc];
      const degreeName  = DEGREE_NAMES[degIdx];

      // Triad
      const triadPCs = TRIAD_INTERVALS_BY_DEGREE[degIdx]
        .map(i => (degRootPc + i) % 12)
        .sort((a, b) => a - b);
      voicings.push({
        name:         `${keyName}_${degreeName}_${TRIAD_QUALITIES[degIdx]}`,
        root:         degRootName,
        quality:      TRIAD_QUALITIES[degIdx],
        degree:       degreeName,
        pitch_classes: triadPCs,
        emotion:      TRIAD_SCENE_DATA[degIdx].emotion,
        scene_hint: {
          lighting: TRIAD_SCENE_DATA[degIdx].lighting,
          camera:   TRIAD_SCENE_DATA[degIdx].camera,
          mood_tag: TRIAD_SCENE_DATA[degIdx].mood_tag,
        },
      });

      // 7th chord
      const seventhPCs = SEVENTH_INTERVALS_BY_DEGREE[degIdx]
        .map(i => (degRootPc + i) % 12)
        .sort((a, b) => a - b);
      voicings.push({
        name:         `${keyName}_${degreeName}_${SEVENTH_QUALITIES[degIdx]}`,
        root:         degRootName,
        quality:      SEVENTH_QUALITIES[degIdx],
        degree:       degreeName,
        pitch_classes: seventhPCs,
        emotion:      SEVENTH_SCENE_DATA[degIdx].emotion,
        scene_hint: {
          lighting: SEVENTH_SCENE_DATA[degIdx].lighting,
          camera:   SEVENTH_SCENE_DATA[degIdx].camera,
          mood_tag: SEVENTH_SCENE_DATA[degIdx].mood_tag,
        },
      });
    }
  }

  return Object.freeze(voicings);
}

/**
 * DIATONIC_CHORD_LIBRARY
 *
 * 168 chord voicings: all 7 diatonic triads + 7th chords in every chromatic
 * root (12 × 14 = 168). Computed once at module load; never mutated.
 *
 * Iteration order: root C → B, degree I → VII, triad before 7th.
 */
export const DIATONIC_CHORD_LIBRARY: readonly ChordVoicing[] =
  buildDiatonicChordLibrary();

// ---------------------------------------------------------------------------
// Chord classification (pure function — no side effects)
// ---------------------------------------------------------------------------

/**
 * classifyChord
 *
 * Identifies the first matching ChordVoicing for a set of held MIDI notes.
 * Matching is order-independent and octave-independent (pitch classes only).
 *
 * Duplicate notes and out-of-range values are handled gracefully.
 * Returns null when the note set does not match any library voicing.
 *
 * @param heldNotes  Array of MIDI note numbers (0–127) currently depressed.
 */
export function classifyChord(heldNotes: readonly number[]): ChordVoicing | null {
  if (heldNotes.length === 0) return null;

  // Normalise to unique pitch classes, ascending.
  const pcs = [...new Set(heldNotes.map(n => ((n % 12) + 12) % 12))].sort(
    (a, b) => a - b
  );

  for (const voicing of DIATONIC_CHORD_LIBRARY) {
    const lib = [...voicing.pitch_classes].sort((a, b) => a - b);
    if (pcs.length === lib.length && pcs.every((pc, i) => pc === lib[i])) {
      return voicing;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Inversion helpers (module-private)
// ---------------------------------------------------------------------------

/** Sentiment scores indexed by chord quality. */
const SENTIMENT_BY_QUALITY: Record<ChordQuality, number> = {
  major:              0.80,
  minor:             -0.30,
  diminished:        -0.90,
  major_7:            0.70,
  minor_7:           -0.40,
  dominant_7:         0.30,
  half_diminished_7: -0.80,
};

/** Ordered chord tones (pitch classes) from the root, for inversion detection. */
function chordToneOrder(rootPc: number, quality: ChordQuality): number[] {
  const INTERVALS: Record<ChordQuality, number[]> = {
    major:              [0, 4, 7],
    minor:              [0, 3, 7],
    diminished:         [0, 3, 6],
    major_7:            [0, 4, 7, 11],
    minor_7:            [0, 3, 7, 10],
    dominant_7:         [0, 4, 7, 10],
    half_diminished_7:  [0, 3, 6, 10],
  };
  return (INTERVALS[quality] ?? [0, 4, 7]).map(i => (rootPc + i) % 12);
}

// ---------------------------------------------------------------------------
// ChordAnalyzer — stateful wrapper for a single moment of held notes
// ---------------------------------------------------------------------------

const INVERSION_LABELS = ['Root', '1st', '2nd', '3rd'] as const;

/**
 * ChordAnalyzer
 *
 * Takes an array of held MIDI note numbers and provides:
 *   - identifyChord()  : chord voicing from DIATONIC_CHORD_LIBRARY
 *   - inversion()      : 0=root, 1=first, 2=second, 3=third
 *   - analyze()        : full AnimationMood (lighting, camera, sentiment)
 *
 * Instantiate once per MIDI event; all methods are pure.
 */
export class ChordAnalyzer {
  private readonly _notes: readonly number[];

  constructor(heldNotes: readonly number[]) {
    this._notes = heldNotes;
  }

  /** The lowest-pitch note in the held set (bass note), or null if empty. */
  get bassNote(): number | null {
    if (this._notes.length === 0) return null;
    return Math.min(...this._notes);
  }

  /** Unique pitch classes (0–11) from the held notes, sorted ascending. */
  get pitchClasses(): number[] {
    return [
      ...new Set(this._notes.map(n => ((n % 12) + 12) % 12)),
    ].sort((a, b) => a - b);
  }

  /**
   * Identify the chord voicing from DIATONIC_CHORD_LIBRARY.
   * Returns null if the held notes do not match any known voicing.
   */
  identifyChord(): ChordVoicing | null {
    return classifyChord(this._notes);
  }

  /**
   * Determine the inversion by comparing the bass note to the chord-tone order.
   *
   *   0  root position  — root in bass
   *   1  first inversion — 3rd in bass
   *   2  second inversion — 5th in bass
   *   3  third inversion  — 7th in bass (7th chords only)
   *
   * Returns 0 when the chord is unrecognised or the bass note is not in the chord.
   */
  inversion(): number {
    const voicing = this.identifyChord();
    const bass    = this.bassNote;
    if (!voicing || bass === null) return 0;

    const rootPc = (NOTE_NAMES as readonly string[]).indexOf(voicing.root);
    if (rootPc === -1) return 0;

    const bassPc = ((bass % 12) + 12) % 12;
    const tones  = chordToneOrder(rootPc, voicing.quality);
    const idx    = tones.indexOf(bassPc);
    return idx === -1 ? 0 : idx;
  }

  /**
   * Return a complete AnimationMood for the held chord.
   * Returns null when the held notes do not match any library voicing.
   */
  analyze(): AnimationMood | null {
    const voicing = this.identifyChord();
    if (!voicing) return null;

    const inv = this.inversion();

    return {
      chord_name:      voicing.name,
      chord_quality:   voicing.quality,
      inversion:       inv,
      inversion_label: INVERSION_LABELS[inv] ?? 'Root',
      sentiment_score: SENTIMENT_BY_QUALITY[voicing.quality],
      lighting:        voicing.scene_hint.lighting,
      camera:          voicing.scene_hint.camera,
      mood_tag:        voicing.scene_hint.mood_tag,
      emotion:         voicing.emotion,
    };
  }
}
