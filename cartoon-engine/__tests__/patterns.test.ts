/**
 * Tests — Token Engine: Pattern Matching
 *
 * These are pure functions with no browser API deps — testable in Node.js.
 */

import {
  matchKeySequence,
  matchMidiChord,
  KEY_PATTERNS,
  MIDI_CHORD_PATTERNS,
} from '../../src/token-engine/patterns';

describe('KEY_PATTERNS registry', () => {
  test('each pattern has a unique name', () => {
    const names = KEY_PATTERNS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('each pattern sequence is non-empty', () => {
    KEY_PATTERNS.forEach((p) => expect(p.sequence.length).toBeGreaterThan(0));
  });
});

describe('MIDI_CHORD_PATTERNS registry', () => {
  test('each chord is non-empty', () => {
    MIDI_CHORD_PATTERNS.forEach((p) => expect(p.chord.length).toBeGreaterThan(0));
  });

  test('each chord note is a valid MIDI note (0–127)', () => {
    MIDI_CHORD_PATTERNS.forEach((p) => {
      p.chord.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(127);
      });
    });
  });
});

describe('matchKeySequence', () => {
  test('matches "rescue" pattern at tail of buffer', () => {
    const seq = ['KeyR', 'KeyE', 'KeyS', 'KeyC', 'KeyU', 'KeyE'];
    const match = matchKeySequence(seq);
    expect(match).not.toBeNull();
    expect(match?.name).toBe('rescue');
    expect(match?.character_id).toBe('investor_gadget');
    expect(match?.scene).toBe('parking_lot_rescue');
  });

  test('matches at the tail even with prefix noise', () => {
    const seq = ['KeyA', 'KeyB', 'KeyC', 'KeyR', 'KeyE', 'KeyS', 'KeyC', 'KeyU', 'KeyE'];
    expect(matchKeySequence(seq)?.name).toBe('rescue');
  });

  test('does not match partial sequence', () => {
    expect(matchKeySequence(['KeyR', 'KeyE', 'KeyS'])).toBeNull();
  });

  test('does not match wrong order', () => {
    expect(matchKeySequence(['KeyE', 'KeyR', 'KeyS', 'KeyC', 'KeyU', 'KeyE'])).toBeNull();
  });

  test('returns null for empty sequence', () => {
    expect(matchKeySequence([])).toBeNull();
  });

  test('matches "cheese" pattern', () => {
    const seq = ['KeyC', 'KeyH', 'KeyE', 'KeyE', 'KeyS', 'KeyE'];
    expect(matchKeySequence(seq)?.name).toBe('cheese');
    expect(matchKeySequence(seq)?.character_id).toBe('mouse_01');
  });

  test('matches "gadget" pattern', () => {
    const seq = ['KeyG', 'KeyA', 'KeyD', 'KeyG', 'KeyE', 'KeyT'];
    expect(matchKeySequence(seq)?.name).toBe('gadget');
  });
});

describe('matchMidiChord', () => {
  test('matches C major chord (rescue scene)', () => {
    const match = matchMidiChord([60, 64, 67]);
    expect(match).not.toBeNull();
    expect(match?.name).toBe('gadget_rescue_chord');
    expect(match?.scene).toBe('parking_lot_rescue');
  });

  test('matching is order-independent', () => {
    expect(matchMidiChord([67, 60, 64])?.name).toBe('gadget_rescue_chord');
    expect(matchMidiChord([64, 67, 60])?.name).toBe('gadget_rescue_chord');
  });

  test('matches G major chord (mouse/cheese scene)', () => {
    const match = matchMidiChord([55, 59, 62]);
    expect(match?.name).toBe('mouse_cheese_chord');
    expect(match?.character_id).toBe('mouse_01');
  });

  test('does not match incomplete chord', () => {
    expect(matchMidiChord([60, 64])).toBeNull();
  });

  test('does not match wrong notes', () => {
    expect(matchMidiChord([60, 64, 68])).toBeNull(); // Caug, not C major
  });

  test('returns null for empty array', () => {
    expect(matchMidiChord([])).toBeNull();
  });

  test('matches arm extension chord (D minor)', () => {
    const match = matchMidiChord([62, 65, 69]);
    expect(match?.name).toBe('gadget_arm_chord');
    expect(match?.scene).toBe('gadget_arm_extension');
  });
});
