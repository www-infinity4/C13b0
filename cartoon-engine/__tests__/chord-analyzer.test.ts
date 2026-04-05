/**
 * Tests — Diatonic Chord Library & ChordAnalyzer
 */

import {
  DIATONIC_CHORD_LIBRARY,
  classifyChord,
  ChordAnalyzer,
  ChordVoicing,
} from '../../src/token-engine/patterns';

// ---------------------------------------------------------------------------
// Library structure
// ---------------------------------------------------------------------------

describe('DIATONIC_CHORD_LIBRARY', () => {
  test('has exactly 168 entries (12 keys × 7 degrees × 2 types)', () => {
    expect(DIATONIC_CHORD_LIBRARY).toHaveLength(168);
  });

  test('every entry has required fields', () => {
    DIATONIC_CHORD_LIBRARY.forEach((v: ChordVoicing) => {
      expect(v.name).toBeTruthy();
      expect(v.root).toBeTruthy();
      expect(v.quality).toBeTruthy();
      expect(v.degree).toBeTruthy();
      expect(v.pitch_classes.length).toBeGreaterThanOrEqual(3);
      expect(v.emotion).toBeTruthy();
      expect(v.scene_hint.lighting).toBeTruthy();
      expect(v.scene_hint.camera).toBeTruthy();
      expect(v.scene_hint.mood_tag).toBeTruthy();
    });
  });

  test('all pitch classes are in range 0–11', () => {
    DIATONIC_CHORD_LIBRARY.forEach(v => {
      v.pitch_classes.forEach(pc => {
        expect(pc).toBeGreaterThanOrEqual(0);
        expect(pc).toBeLessThanOrEqual(11);
      });
    });
  });

  test('triads have 3 pitch classes', () => {
    const triads = DIATONIC_CHORD_LIBRARY.filter(v =>
      ['major', 'minor', 'diminished'].includes(v.quality)
    );
    triads.forEach(v => expect(v.pitch_classes).toHaveLength(3));
  });

  test('seventh chords have 4 pitch classes', () => {
    const sevenths = DIATONIC_CHORD_LIBRARY.filter(v =>
      ['major_7', 'minor_7', 'dominant_7', 'half_diminished_7'].includes(v.quality)
    );
    sevenths.forEach(v => expect(v.pitch_classes).toHaveLength(4));
  });
});

// ---------------------------------------------------------------------------
// classifyChord
// ---------------------------------------------------------------------------

describe('classifyChord', () => {
  test('identifies C major triad (60, 64, 67)', () => {
    const v = classifyChord([60, 64, 67]);
    expect(v).not.toBeNull();
    expect(v?.quality).toBe('major');
    expect(v?.root).toBe('C');
  });

  test('identifies D minor triad (62, 65, 69)', () => {
    const v = classifyChord([62, 65, 69]);
    expect(v).not.toBeNull();
    expect(v?.quality).toBe('minor');
    expect(v?.root).toBe('D');
  });

  test('identifies C major 7th (60, 64, 67, 71)', () => {
    const v = classifyChord([60, 64, 67, 71]);
    expect(v).not.toBeNull();
    expect(v?.quality).toBe('major_7');
    expect(v?.root).toBe('C');
  });

  test('identifies G dominant 7 (55, 59, 62, 65)', () => {
    const v = classifyChord([55, 59, 62, 65]);
    expect(v).not.toBeNull();
    expect(v?.quality).toBe('dominant_7');
    expect(v?.root).toBe('G');
  });

  test('matching is order-independent', () => {
    const v1 = classifyChord([60, 64, 67]);
    const v2 = classifyChord([67, 60, 64]);
    const v3 = classifyChord([64, 67, 60]);
    expect(v1?.name).toBe(v2?.name);
    expect(v2?.name).toBe(v3?.name);
  });

  test('matching is octave-independent (MIDI pitch classes)', () => {
    const v1 = classifyChord([60, 64, 67]);   // C4 E4 G4
    const v2 = classifyChord([48, 52, 55]);   // C3 E3 G3
    const v3 = classifyChord([72, 76, 79]);   // C5 E5 G5
    expect(v1?.quality).toBe(v2?.quality);
    expect(v2?.quality).toBe(v3?.quality);
  });

  test('returns null for an empty array', () => {
    expect(classifyChord([])).toBeNull();
  });

  test('returns null for an unrecognised chord', () => {
    // Chromatic cluster — not in any diatonic key
    expect(classifyChord([60, 61, 62, 63])).toBeNull();
  });

  test('duplicate notes are collapsed before matching', () => {
    // Same note in different octaves should resolve to the same triad
    const v = classifyChord([60, 60, 64, 67]);
    expect(v?.quality).toBe('major');
  });
});

// ---------------------------------------------------------------------------
// ChordAnalyzer
// ---------------------------------------------------------------------------

describe('ChordAnalyzer — bassNote and pitchClasses', () => {
  test('bassNote returns lowest note', () => {
    const a = new ChordAnalyzer([67, 60, 64]);
    expect(a.bassNote).toBe(60);
  });

  test('bassNote returns null for empty array', () => {
    expect(new ChordAnalyzer([]).bassNote).toBeNull();
  });

  test('pitchClasses deduplicates and sorts', () => {
    const a = new ChordAnalyzer([60, 64, 67, 60]);
    expect(a.pitchClasses).toEqual([0, 4, 7]);
  });
});

describe('ChordAnalyzer — identifyChord', () => {
  test('identifies C major', () => {
    const a = new ChordAnalyzer([60, 64, 67]);
    expect(a.identifyChord()?.quality).toBe('major');
  });

  test('returns null for unrecognised chord', () => {
    expect(new ChordAnalyzer([61, 63, 65]).identifyChord()).toBeNull();
  });
});

describe('ChordAnalyzer — inversion', () => {
  test('C major root position: C in bass → 0', () => {
    // C4=60, E4=64, G4=67 — C is lowest
    expect(new ChordAnalyzer([60, 64, 67]).inversion()).toBe(0);
  });

  test('C major first inversion: E in bass → 1', () => {
    // E3=52, C4=60, G4=67 — E is lowest
    expect(new ChordAnalyzer([52, 60, 67]).inversion()).toBe(1);
  });

  test('C major second inversion: G in bass → 2', () => {
    // G3=55, C4=60, E4=64 — G is lowest
    expect(new ChordAnalyzer([55, 60, 64]).inversion()).toBe(2);
  });

  test('unknown chord returns 0 (safe default)', () => {
    expect(new ChordAnalyzer([61, 63, 65]).inversion()).toBe(0);
  });
});

describe('ChordAnalyzer — analyze', () => {
  test('C major → sentiment ≈ +0.80, mood "triumphant"', () => {
    const mood = new ChordAnalyzer([60, 64, 67]).analyze();
    expect(mood).not.toBeNull();
    expect(mood?.sentiment_score).toBeCloseTo(0.80, 2);
    expect(mood?.mood_tag).toBe('triumphant');
    expect(mood?.chord_quality).toBe('major');
  });

  test('D minor → negative sentiment', () => {
    const mood = new ChordAnalyzer([62, 65, 69]).analyze();
    expect(mood?.sentiment_score).toBeLessThan(0);
  });

  test('B diminished → most negative sentiment (−0.90)', () => {
    // B=11, D=2, F=5 → [2, 5, 11] in C_VII_diminished
    const mood = new ChordAnalyzer([71, 74, 77]).analyze();
    expect(mood?.chord_quality).toBe('diminished');
    expect(mood?.sentiment_score).toBeCloseTo(-0.90, 2);
  });

  test('analyze returns null for unrecognised chord', () => {
    expect(new ChordAnalyzer([61, 63, 65]).analyze()).toBeNull();
  });

  test('analyze returns null for empty array', () => {
    expect(new ChordAnalyzer([]).analyze()).toBeNull();
  });

  test('inversion_label matches inversion number', () => {
    const labels = ['Root', '1st', '2nd', '3rd'];
    const mood   = new ChordAnalyzer([60, 64, 67]).analyze()!;
    expect(labels[mood.inversion]).toBe(mood.inversion_label);
  });

  test('lighting and camera fields are non-empty strings', () => {
    const mood = new ChordAnalyzer([60, 64, 67]).analyze()!;
    expect(mood.lighting.length).toBeGreaterThan(0);
    expect(mood.camera.length).toBeGreaterThan(0);
  });
});
