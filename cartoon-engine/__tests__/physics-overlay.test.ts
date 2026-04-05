/**
 * Tests — Secondary Motion Physics Overlay
 */

import {
  SecondaryMotion,
  secondaryMotionFromDelta,
  MOTION_THRESHOLDS,
} from '../physics-overlay';

describe('SecondaryMotion — still character', () => {
  const sm = new SecondaryMotion({ velocity_x: 0, velocity_y: 0, character_id: 'investor_gadget' });

  test('motionIntensity is "still"', () => {
    expect(sm.motionIntensity).toBe('still');
  });

  test('keywords() returns empty array', () => {
    expect(sm.keywords()).toHaveLength(0);
  });

  test('promptDescriptor() returns empty string', () => {
    expect(sm.promptDescriptor()).toBe('');
  });

  test('appendToPrompt returns basePrompt unchanged', () => {
    expect(sm.appendToPrompt('test prompt')).toBe('test prompt');
  });
});

describe('SecondaryMotion — gentle movement', () => {
  const sm = new SecondaryMotion({
    velocity_x: MOTION_THRESHOLDS.GENTLE + 0.01,
    velocity_y: 0,
    character_id: 'investor_gadget',
  });

  test('motionIntensity is "gentle"', () => {
    expect(sm.motionIntensity).toBe('gentle');
  });

  test('keywords() is non-empty', () => {
    expect(sm.keywords().length).toBeGreaterThan(0);
  });

  test('promptDescriptor() is a non-empty string', () => {
    expect(sm.promptDescriptor().length).toBeGreaterThan(0);
  });

  test('appendToPrompt appends to base', () => {
    const result = sm.appendToPrompt('base scene');
    expect(result.startsWith('base scene')).toBe(true);
    expect(result.length).toBeGreaterThan('base scene'.length);
  });
});

describe('SecondaryMotion — vigorous movement (investor_gadget)', () => {
  const sm = new SecondaryMotion({
    velocity_x: MOTION_THRESHOLDS.VIGOROUS + 0.05,
    velocity_y: 0,
    character_id: 'investor_gadget',
  });

  test('motionIntensity is "vigorous"', () => {
    expect(sm.motionIntensity).toBe('vigorous');
  });

  test('contains coat billowing keyword', () => {
    const kw = sm.keywords();
    expect(kw.some(k => k.includes('billowing') || k.includes('trailing'))).toBe(true);
  });
});

describe('SecondaryMotion — mouse character', () => {
  const sm = new SecondaryMotion({
    velocity_x: 0.20,
    velocity_y: 0,
    character_id: 'mouse_01',
  });

  test('returns mouse-specific keywords (tail / ears)', () => {
    const kw = sm.keywords();
    expect(kw.some(k => k.includes('tail') || k.includes('ear'))).toBe(true);
  });
});

describe('SecondaryMotion — unknown character uses generic keywords', () => {
  const sm = new SecondaryMotion({
    velocity_x: 0.25,
    velocity_y: 0,
    character_id: 'unknown_hero',
  });

  test('returns non-empty keywords for unknown character', () => {
    expect(sm.keywords().length).toBeGreaterThan(0);
  });
});

describe('secondaryMotionFromDelta', () => {
  test('constructs SecondaryMotion from physics delta values', () => {
    const sm = secondaryMotionFromDelta('investor_gadget', 0.4, 0.0, 2.0);
    expect(sm).toBeInstanceOf(SecondaryMotion);
    expect(sm.speedMagnitude).toBeCloseTo(0.2, 3); // 0.4 / 2.0
  });

  test('handles zero travel_time_s without division by zero', () => {
    expect(() => secondaryMotionFromDelta('investor_gadget', 0.4, 0.0, 0)).not.toThrow();
  });
});
