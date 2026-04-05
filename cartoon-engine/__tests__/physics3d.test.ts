/**
 * Tests — 3-D Physics Engine
 */

import {
  buildPhysicsMap3D,
  positionAtFrame3D,
  euclidean3D,
  gadgetCameraDolly,
} from '../physics3d';

describe('euclidean3D', () => {
  test('pure X move', () => {
    expect(euclidean3D({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(1.0);
  });

  test('3-4-5 right triangle in XY plane', () => {
    expect(euclidean3D({ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0.4, z: 0 })).toBeCloseTo(0.5, 4);
  });

  test('unit cube diagonal = sqrt(3)', () => {
    expect(euclidean3D({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })).toBeCloseTo(
      Math.sqrt(3), 4
    );
  });

  test('same point = 0', () => {
    expect(euclidean3D({ x: 0.5, y: 0.5, z: 0.5 }, { x: 0.5, y: 0.5, z: 0.5 })).toBe(0);
  });
});

describe('buildPhysicsMap3D', () => {
  const map = buildPhysicsMap3D({
    character_id: 'investor_gadget',
    initial_position: { x: 0.1, y: 0.8, z: 0.9 },
    target_position:  { x: 0.5, y: 0.8, z: 0.2 },
    velocity_units_per_s: 0.3,
    fps: 24,
  });

  test('dimension_mode is MESH_3D', () => {
    expect(map.dimension_mode).toBe('MESH_3D');
  });

  test('delta_x is correct', () => {
    expect(map.motion.delta_x).toBeCloseTo(0.4, 4);
  });

  test('delta_y is zero for horizontal move', () => {
    expect(map.motion.delta_y).toBe(0);
  });

  test('delta_z is correct (moving toward camera)', () => {
    expect(map.motion.delta_z).toBeCloseTo(-0.7, 4);
  });

  test('distance uses 3-D Euclidean', () => {
    const expected = Math.sqrt(0.4 ** 2 + 0 ** 2 + (-0.7) ** 2);
    expect(map.motion.distance).toBeCloseTo(expected, 3);
  });

  test('frames_to_target is positive', () => {
    expect(map.motion.frames_to_target).toBeGreaterThan(0);
  });

  test('frame_sequence has frames_to_target + 1 entries', () => {
    expect(map.motion.frame_sequence).toHaveLength(map.motion.frames_to_target + 1);
  });

  test('first frame_sequence entry equals initial_position', () => {
    const first = map.motion.frame_sequence[0];
    expect(first.x).toBeCloseTo(0.1, 4);
    expect(first.y).toBeCloseTo(0.8, 4);
    expect(first.z).toBeCloseTo(0.9, 4);
  });

  test('last frame_sequence entry equals target_position', () => {
    const last = map.motion.frame_sequence[map.motion.frame_sequence.length - 1];
    expect(last.x).toBeCloseTo(0.5, 4);
    expect(last.y).toBeCloseTo(0.8, 4);
    expect(last.z).toBeCloseTo(0.2, 4);
  });

  test('all frame positions are clamped to [0, 1]', () => {
    map.motion.frame_sequence.forEach((pos) => {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(1);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(1);
      expect(pos.z).toBeGreaterThanOrEqual(0);
      expect(pos.z).toBeLessThanOrEqual(1);
    });
  });
});

describe('buildPhysicsMap3D — edge cases', () => {
  test('throws on velocity <= 0', () => {
    expect(() =>
      buildPhysicsMap3D({
        character_id: 'test',
        initial_position: { x: 0, y: 0, z: 0 },
        target_position:  { x: 1, y: 1, z: 1 },
        velocity_units_per_s: 0,
        fps: 24,
      })
    ).toThrow(RangeError);
  });

  test('zero-distance map has frames_to_target = 0', () => {
    const map = buildPhysicsMap3D({
      character_id: 'test',
      initial_position: { x: 0.5, y: 0.5, z: 0.5 },
      target_position:  { x: 0.5, y: 0.5, z: 0.5 },
      velocity_units_per_s: 0.2,
      fps: 24,
    });
    expect(map.motion.frames_to_target).toBe(0);
    expect(map.motion.distance).toBe(0);
  });
});

describe('positionAtFrame3D', () => {
  const map = buildPhysicsMap3D({
    character_id: 'test',
    initial_position: { x: 0.0, y: 0.5, z: 1.0 },
    target_position:  { x: 1.0, y: 0.5, z: 0.0 },
    velocity_units_per_s: 1.0,
    fps: 24,
  });

  test('frame 0 returns initial position', () => {
    const pos = positionAtFrame3D(map, 0);
    expect(pos.x).toBeCloseTo(0.0, 3);
    expect(pos.z).toBeCloseTo(1.0, 3);
  });

  test('frame beyond sequence returns target', () => {
    const pos = positionAtFrame3D(map, 99999);
    expect(pos.x).toBeCloseTo(1.0, 3);
    expect(pos.z).toBeCloseTo(0.0, 3);
  });
});

describe('gadgetCameraDolly', () => {
  const dolly = gadgetCameraDolly(24);

  test('dimension_mode is MESH_3D', () => {
    expect(dolly.dimension_mode).toBe('MESH_3D');
  });

  test('character is investor_gadget', () => {
    expect(dolly.character_id).toBe('investor_gadget');
  });

  test('Z moves from far (0.9) toward near (0.15)', () => {
    expect(dolly.initial_position.z).toBeCloseTo(0.9, 3);
    expect(dolly.target_position.z).toBeCloseTo(0.15, 3);
    expect(dolly.motion.delta_z).toBeLessThan(0); // negative = toward camera
  });

  test('X and Y stay centred', () => {
    expect(dolly.initial_position.x).toBe(0.5);
    expect(dolly.initial_position.y).toBe(0.5);
    expect(dolly.target_position.x).toBe(0.5);
    expect(dolly.target_position.y).toBe(0.5);
  });
});
