/**
 * Tests — MIDI Physics Bridge
 */

import {
  midiPitchToX,
  midiVelocityToSpeed,
  midiNoteToPhysicsInput,
  gadgetArmExtension,
} from '../midi-physics';

describe('midiPitchToX', () => {
  test('pitch 0 maps to the left edge (≈ 0.05)', () => {
    expect(midiPitchToX(0)).toBeCloseTo(0.05, 3);
  });

  test('pitch 127 maps to the right edge (≈ 0.95)', () => {
    expect(midiPitchToX(127)).toBeCloseTo(0.95, 3);
  });

  test('pitch 63/64 maps near the centre (≈ 0.5)', () => {
    const x = midiPitchToX(63);
    expect(x).toBeGreaterThan(0.44);
    expect(x).toBeLessThan(0.56);
  });

  test('out-of-range pitch is clamped', () => {
    expect(midiPitchToX(-10)).toBe(midiPitchToX(0));
    expect(midiPitchToX(200)).toBe(midiPitchToX(127));
  });

  test('result is always within [0.05, 0.95]', () => {
    for (let p = 0; p <= 127; p++) {
      const x = midiPitchToX(p);
      expect(x).toBeGreaterThanOrEqual(0.05);
      expect(x).toBeLessThanOrEqual(0.95);
    }
  });
});

describe('midiVelocityToSpeed', () => {
  test('velocity 1 maps to minimum speed (≈ 0.05)', () => {
    expect(midiVelocityToSpeed(1)).toBeCloseTo(0.05, 3);
  });

  test('velocity 127 maps to maximum speed (≈ 0.50)', () => {
    expect(midiVelocityToSpeed(127)).toBeCloseTo(0.50, 3);
  });

  test('velocity 0 is treated as 1 (note-off guard)', () => {
    expect(midiVelocityToSpeed(0)).toBe(midiVelocityToSpeed(1));
  });

  test('result is always within [0.05, 0.50]', () => {
    for (let v = 0; v <= 127; v++) {
      const s = midiVelocityToSpeed(v);
      expect(s).toBeGreaterThanOrEqual(0.05);
      expect(s).toBeLessThanOrEqual(0.50);
    }
  });
});

describe('midiNoteToPhysicsInput', () => {
  const input = midiNoteToPhysicsInput({
    characterId:  'investor_gadget',
    pitchStart:   36,   // C2 — left of frame
    pitchTarget:  84,   // C6 — right of frame
    velocity:     100,
    yPosition:    0.8,
    fps:          24,
  });

  test('character_id is preserved', () => {
    expect(input.character_id).toBe('investor_gadget');
  });

  test('Y positions match yPosition param', () => {
    expect(input.initial_position.y).toBe(0.8);
    expect(input.target_position.y).toBe(0.8);
  });

  test('initial X is less than target X (low pitch → left)', () => {
    expect(input.initial_position.x).toBeLessThan(input.target_position.x);
  });

  test('fps is preserved', () => {
    expect(input.fps).toBe(24);
  });

  test('velocity > 0 produces a positive speed', () => {
    expect(input.velocity_units_per_s).toBeGreaterThan(0);
  });
});

describe('gadgetArmExtension', () => {
  const input = gadgetArmExtension(60, 100, 24);

  test('character is investor_gadget', () => {
    expect(input.character_id).toBe('investor_gadget');
  });

  test('initial and target X are both 0.5 (vertical move)', () => {
    expect(input.initial_position.x).toBe(0.5);
    expect(input.target_position.x).toBe(0.5);
  });

  test('target Y is less than initial Y (arm extends upward)', () => {
    expect(input.target_position.y).toBeLessThan(input.initial_position.y);
  });
});
