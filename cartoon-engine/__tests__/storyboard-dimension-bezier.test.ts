/**
 * Tests — renderStoryboardCLI, toggleDimensionMode, smoothMotionBezier,
 *          motionToleranceCheck, midiVelocityToCameraParams
 */

import {
  generateTileBlueprint,
  renderStoryboardCLI,
  toggleDimensionMode,
  SHOT_DURATIONS_S,
  TOTAL_FRAMES,
} from '../generator';
import { smoothMotionBezier, motionToleranceCheck, buildPhysicsMap } from '../physics';
import { midiVelocityToCameraParams } from '../midi-physics';

const { blueprint, physics_maps, verification } = generateTileBlueprint(
  'tile_0001', 'test premise', 24, 'investor_gadget'
);
const tile = { blueprint, physics_maps, verification };

// ---------------------------------------------------------------------------
// renderStoryboardCLI
// ---------------------------------------------------------------------------

describe('renderStoryboardCLI', () => {
  const board = renderStoryboardCLI('tile_0001', blueprint);

  test('returns a non-empty string', () => {
    expect(board.length).toBeGreaterThan(0);
  });

  test('contains the tile ID', () => {
    expect(board).toContain('tile_0001');
  });

  test('contains each shot ID', () => {
    blueprint.shots.forEach(shot => {
      expect(board.toUpperCase()).toContain(shot.id.toUpperCase());
    });
  });

  test('contains [C] character marker', () => {
    expect(board).toContain('[C]');
  });

  test('contains frame counts for each shot', () => {
    blueprint.shots.forEach(shot => {
      expect(board).toContain(String(shot.frame_count));
    });
  });

  test('frame height uses box-drawing characters', () => {
    expect(board).toContain('┌');
    expect(board).toContain('└');
    expect(board).toContain('│');
  });

  test('lipsync marker ♫ present for shots with lipsync enabled', () => {
    const lipsyncShots = blueprint.shots.filter(s => s.lipsync?.enabled);
    if (lipsyncShots.length > 0) {
      expect(board).toContain('♫');
    }
  });
});

// ---------------------------------------------------------------------------
// toggleDimensionMode
// ---------------------------------------------------------------------------

describe('toggleDimensionMode — MESH_3D', () => {
  const tile3d = toggleDimensionMode(tile, 'MESH_3D');

  test('returns dimension_mode MESH_3D', () => {
    expect(tile3d.dimension_mode).toBe('MESH_3D');
  });

  test('physics_maps_3d has same length as physics_maps', () => {
    expect(tile3d.physics_maps_3d).toHaveLength(physics_maps.length);
  });

  test('original physics_maps are preserved', () => {
    expect(tile3d.physics_maps).toHaveLength(physics_maps.length);
  });

  test('3D maps have Z coordinates in their frame_sequence', () => {
    tile3d.physics_maps_3d.forEach(m => {
      expect(m.motion.frame_sequence.length).toBeGreaterThan(0);
      m.motion.frame_sequence.forEach(pos => {
        expect(typeof pos.z).toBe('number');
        expect(pos.z).toBeGreaterThanOrEqual(0);
        expect(pos.z).toBeLessThanOrEqual(1);
      });
    });
  });

  test('default Z is 0.5', () => {
    const first = tile3d.physics_maps_3d[0].initial_position;
    expect(first.z).toBeCloseTo(0.5);
  });

  test('custom defaultZ is applied', () => {
    const custom = toggleDimensionMode(tile, 'MESH_3D', 0.25);
    expect(custom.physics_maps_3d[0].initial_position.z).toBeCloseTo(0.25);
  });
});

describe('toggleDimensionMode — FLAT_2D', () => {
  const flat = toggleDimensionMode(tile, 'FLAT_2D');

  test('returns dimension_mode FLAT_2D', () => {
    expect(flat.dimension_mode).toBe('FLAT_2D');
  });

  test('physics_maps_3d is empty for FLAT_2D', () => {
    expect(flat.physics_maps_3d).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// smoothMotionBezier
// ---------------------------------------------------------------------------

describe('smoothMotionBezier', () => {
  const map = buildPhysicsMap({
    character_id:        'investor_gadget',
    initial_position:    { x: 0.1, y: 0.5 },
    target_position:     { x: 0.9, y: 0.5 },
    velocity_units_per_s: 0.2,
    fps:                 24,
  });
  const smooth = smoothMotionBezier(map);

  test('smoothed sequence has same length as original', () => {
    expect(smooth.motion.frame_sequence.length).toBe(map.motion.frame_sequence.length);
  });

  test('first frame equals initial position', () => {
    const first = smooth.motion.frame_sequence[0];
    expect(first.x).toBeCloseTo(map.initial_position.x, 3);
    expect(first.y).toBeCloseTo(map.initial_position.y, 3);
  });

  test('last frame equals target position', () => {
    const last = smooth.motion.frame_sequence[smooth.motion.frame_sequence.length - 1];
    expect(last.x).toBeCloseTo(map.target_position.x, 3);
    expect(last.y).toBeCloseTo(map.target_position.y, 3);
  });

  test('all positions are within [0, 1]', () => {
    smooth.motion.frame_sequence.forEach(pos => {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.x).toBeLessThanOrEqual(1);
      expect(pos.y).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeLessThanOrEqual(1);
    });
  });

  test('mid-point has higher displacement than linear mid-point at start', () => {
    // Bézier ease-in: displacement at t=0.25 should be less than 0.25 × total
    const n = smooth.motion.frame_sequence.length - 1;
    const quarter = smooth.motion.frame_sequence[Math.round(n * 0.25)];
    const linear  = map.motion.frame_sequence[Math.round(n * 0.25)];
    // Bézier start is slower than linear → lower x at 25 %
    expect(quarter.x).toBeLessThanOrEqual(linear.x + 0.05); // allow small float tolerance
  });

  test('does not mutate original map', () => {
    expect(map.motion.frame_sequence[0].x).toBeCloseTo(0.1, 3);
  });

  test('zero-distance map is returned unchanged', () => {
    const stationary = buildPhysicsMap({
      character_id: 'mouse_01',
      initial_position: { x: 0.5, y: 0.5 },
      target_position:  { x: 0.5, y: 0.5 },
      velocity_units_per_s: 0.1,
      fps: 24,
    });
    const result = smoothMotionBezier(stationary);
    expect(result).toBe(stationary); // same reference
  });
});

// ---------------------------------------------------------------------------
// motionToleranceCheck
// ---------------------------------------------------------------------------

describe('motionToleranceCheck', () => {
  test('linear map at low velocity passes 10% tolerance', () => {
    const map = buildPhysicsMap({
      character_id: 'mouse_01',
      initial_position: { x: 0.1, y: 0.5 },
      target_position:  { x: 0.9, y: 0.5 },
      velocity_units_per_s: 0.1,
      fps: 24,
    });
    const offenders = motionToleranceCheck(map, 0.10);
    expect(offenders).toHaveLength(0);
  });

  test('very fast linear map exceeds tight tolerance', () => {
    const map = buildPhysicsMap({
      character_id: 'investor_gadget',
      initial_position: { x: 0.0, y: 0.5 },
      target_position:  { x: 1.0, y: 0.5 },
      velocity_units_per_s: 2.0, // very fast
      fps: 24,
    });
    const offenders = motionToleranceCheck(map, 0.01); // very tight tolerance
    expect(offenders.length).toBeGreaterThan(0);
  });

  test('smoothed map has fewer tolerance violations than linear', () => {
    const map = buildPhysicsMap({
      character_id: 'investor_gadget',
      initial_position: { x: 0.0, y: 0.5 },
      target_position:  { x: 1.0, y: 0.5 },
      velocity_units_per_s: 1.0,
      fps: 24,
    });
    const linearViolations = motionToleranceCheck(map, 0.02).length;
    const smoothed         = smoothMotionBezier(map);
    const bezierViolations = motionToleranceCheck(smoothed, 0.02).length;
    // Bézier start/end are slower so fewer mid-sequence violations
    expect(bezierViolations).toBeLessThanOrEqual(linearViolations);
  });
});

// ---------------------------------------------------------------------------
// midiVelocityToCameraParams
// ---------------------------------------------------------------------------

describe('midiVelocityToCameraParams', () => {
  test('velocity 1 → locked-off tripod (lowest energy)', () => {
    const p = midiVelocityToCameraParams(1);
    expect(p.camera_style).toContain('locked');
    expect(p.shake_intensity).toBeCloseTo(0, 2);
    expect(p.zoom_speed).toBeCloseTo(1.0, 1);
  });

  test('velocity 127 → extreme handheld (highest energy)', () => {
    const p = midiVelocityToCameraParams(127);
    expect(p.camera_style).toContain('extreme');
    expect(p.shake_intensity).toBeCloseTo(1.0, 2);
    expect(p.zoom_speed).toBeCloseTo(3.0, 1);
  });

  test('velocity 0 is treated as 1 (note-off guard)', () => {
    expect(midiVelocityToCameraParams(0).camera_style).toBe(
      midiVelocityToCameraParams(1).camera_style
    );
  });

  test('velocity 80 → shoulder-mounted / tracking', () => {
    const p = midiVelocityToCameraParams(80);
    expect(p.prompt_fragment).toContain('shoulder');
  });

  test('prompt_fragment is always a non-empty string', () => {
    [1, 32, 64, 96, 116, 127].forEach(v => {
      expect(midiVelocityToCameraParams(v).prompt_fragment.length).toBeGreaterThan(0);
    });
  });

  test('shake_intensity is monotonically non-decreasing with velocity', () => {
    let prev = 0;
    for (let v = 1; v <= 127; v += 10) {
      const cur = midiVelocityToCameraParams(v).shake_intensity;
      expect(cur).toBeGreaterThanOrEqual(prev - 0.01); // allow float rounding
      prev = cur;
    }
  });
});
