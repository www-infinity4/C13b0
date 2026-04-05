/**
 * Tests — Physics Engine
 *
 * Validates: delta calculation, distance, frame sequence, edge cases.
 */

import { buildPhysicsMap, positionAtFrame, euclidean } from '../physics';

describe('buildPhysicsMap', () => {
  const map = buildPhysicsMap({
    character_id: 'investor_gadget',
    initial_position: { x: 0.1, y: 0.8 },
    target_position:  { x: 0.5, y: 0.8 },
    velocity_units_per_s: 0.2,
    fps: 24,
  });

  test('delta_x is correct', () => {
    expect(map.motion.delta_x).toBeCloseTo(0.4, 4);
  });

  test('delta_y is zero for horizontal motion', () => {
    expect(map.motion.delta_y).toBe(0);
  });

  test('distance is correct', () => {
    expect(map.motion.distance).toBeCloseTo(0.4, 4);
  });

  test('travel_time_s = distance / velocity', () => {
    expect(map.motion.travel_time_s).toBeCloseTo(0.4 / 0.2, 4);
  });

  test('frames_to_target = round(travel_time_s * fps)', () => {
    // 0.4 / 0.2 = 2.0 s × 24 fps = 48 frames
    expect(map.motion.frames_to_target).toBe(48);
  });

  test('frame_sequence has frames_to_target + 1 entries', () => {
    expect(map.motion.frame_sequence).toHaveLength(49); // frames 0..48
  });

  test('first frame_sequence entry equals initial_position', () => {
    const first = map.motion.frame_sequence[0];
    expect(first.x).toBeCloseTo(0.1, 4);
    expect(first.y).toBeCloseTo(0.8, 4);
  });

  test('last frame_sequence entry equals target_position', () => {
    const last = map.motion.frame_sequence[map.motion.frame_sequence.length - 1];
    expect(last.x).toBeCloseTo(0.5, 4);
    expect(last.y).toBeCloseTo(0.8, 4);
  });

  test('intermediate positions are linearly interpolated', () => {
    const mid = map.motion.frame_sequence[24]; // halfway
    expect(mid.x).toBeCloseTo(0.3, 2);
  });
});

describe('buildPhysicsMap — edge cases', () => {
  test('throws when velocity <= 0', () => {
    expect(() =>
      buildPhysicsMap({
        character_id: 'test',
        initial_position: { x: 0, y: 0 },
        target_position:  { x: 1, y: 1 },
        velocity_units_per_s: 0,
        fps: 24,
      })
    ).toThrow(RangeError);
  });

  test('throws when fps <= 0', () => {
    expect(() =>
      buildPhysicsMap({
        character_id: 'test',
        initial_position: { x: 0, y: 0 },
        target_position:  { x: 1, y: 1 },
        velocity_units_per_s: 0.2,
        fps: 0,
      })
    ).toThrow(RangeError);
  });

  test('zero-distance map has frames_to_target = 0', () => {
    const map = buildPhysicsMap({
      character_id: 'test',
      initial_position: { x: 0.5, y: 0.5 },
      target_position:  { x: 0.5, y: 0.5 },
      velocity_units_per_s: 0.2,
      fps: 24,
    });
    expect(map.motion.frames_to_target).toBe(0);
    expect(map.motion.distance).toBe(0);
  });

  test('positions are clamped to [0, 1]', () => {
    const map = buildPhysicsMap({
      character_id: 'test',
      initial_position: { x: 0.0, y: 0.0 },
      target_position:  { x: 1.0, y: 0.0 },
      velocity_units_per_s: 0.5,
      fps: 24,
    });
    map.motion.frame_sequence.forEach((pos) => {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(1);
    });
  });
});

describe('positionAtFrame', () => {
  const map = buildPhysicsMap({
    character_id: 'test',
    initial_position: { x: 0.0, y: 0.5 },
    target_position:  { x: 1.0, y: 0.5 },
    velocity_units_per_s: 1.0,
    fps: 24,
  });

  test('frame 0 returns initial position', () => {
    const pos = positionAtFrame(map, 0);
    expect(pos.x).toBeCloseTo(0.0, 3);
  });

  test('frame beyond sequence returns target', () => {
    const pos = positionAtFrame(map, 9999);
    expect(pos.x).toBeCloseTo(1.0, 3);
  });
});

describe('euclidean', () => {
  test('horizontal distance', () => {
    expect(euclidean({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(1.0);
  });

  test('diagonal distance (3-4-5 triangle)', () => {
    expect(euclidean({ x: 0, y: 0 }, { x: 0.3, y: 0.4 })).toBeCloseTo(0.5, 4);
  });

  test('same point = 0', () => {
    expect(euclidean({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(0);
  });
});
