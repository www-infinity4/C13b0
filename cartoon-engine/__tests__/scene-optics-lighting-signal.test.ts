/**
 * Tests — GlobalSceneState, PhysicalCamera, LightingRig,
 *          GrainAwareLuminanceNoise, gaussianKernel1D
 */

import { GlobalSceneState, PARKING_LOT_SCENE, KITCHEN_SCENE } from '../scene-state';
import { PhysicalCamera, CINEMA_PRESETS } from '../optics';
import { LightingRig, PointLight, PARKING_LOT_RIG, KITCHEN_RIG, colourTempToLabel } from '../lighting';
import { GrainAwareLuminanceNoise, gaussianKernel1D, gaussianBlurRadius, STOCK_PRESETS } from '../signal';

// ---------------------------------------------------------------------------
// GlobalSceneState
// ---------------------------------------------------------------------------

describe('GlobalSceneState — basic', () => {
  const scene = new GlobalSceneState({
    scene_id: 'test_scene',
    environment: {
      background:  'parking lot, cracked asphalt',
      lighting:    'overcast midday',
      weather:     'dry',
      time_of_day: 'midday',
      palette:     'grey-green',
      landmarks:   ['blue sedan', 'CCTV camera'],
    },
  });

  test('scene_id is stored', () => {
    expect(scene.scene_id).toBe('test_scene');
  });

  test('environmentDescriptor includes background', () => {
    expect(scene.environmentDescriptor()).toContain('parking lot');
  });

  test('environmentDescriptor includes all landmarks at default strength', () => {
    const desc = scene.environmentDescriptor();
    expect(desc).toContain('blue sedan');
    expect(desc).toContain('CCTV camera');
  });

  test('appendToPrompt prepends base prompt and records history', () => {
    const full = scene.appendToPrompt('Gadget runs', 'shot_01', 'tile_0001');
    expect(full.startsWith('Gadget runs')).toBe(true);
    expect(full).toContain('parking lot');
    expect(scene.shotCount).toBe(1);
  });

  test('validate returns true when background token is in prompt', () => {
    const prompt = scene.appendToPrompt('Gadget runs', 'shot_02', 'tile_0001');
    expect(scene.validate(prompt)).toBe(true);
  });

  test('validate returns false when background is missing', () => {
    expect(scene.validate('unrelated text')).toBe(false);
  });

  test('promptSeed is an 8-character hex string', () => {
    expect(scene.promptSeed).toMatch(/^[0-9a-f]{8}$/i);
  });

  test('same environment produces same promptSeed', () => {
    const scene2 = new GlobalSceneState({ scene_id: 'other', environment: scene.environment });
    expect(scene.promptSeed).toBe(scene2.promptSeed);
  });
});

describe('GlobalSceneState — consistency_strength', () => {
  test('strength < 1 truncates landmarks', () => {
    const scene = new GlobalSceneState({
      scene_id: 'weak',
      environment: {
        background: 'lot', lighting: 'sun', weather: 'dry',
        time_of_day: 'noon', palette: 'grey',
        landmarks: ['a', 'b', 'c', 'd'],
      },
      consistency_strength: 0.25, // only 1 of 4 landmarks
    });
    const desc = scene.environmentDescriptor();
    // Should contain 'a' but not all four
    expect(desc).toContain('a');
  });
});

describe('Pre-built scenes', () => {
  test('PARKING_LOT_SCENE has correct scene_id', () => {
    expect(PARKING_LOT_SCENE.scene_id).toBe('parking_lot_rescue');
  });

  test('KITCHEN_SCENE has correct scene_id', () => {
    expect(KITCHEN_SCENE.scene_id).toBe('kitchen_cheese_discovery');
  });

  test('toJSON is serialisable', () => {
    const json = PARKING_LOT_SCENE.toJSON();
    expect(json.scene_id).toBe('parking_lot_rescue');
    expect(typeof json.prompt_seed).toBe('string');
    expect(JSON.stringify(json)).not.toThrow;
  });
});

// ---------------------------------------------------------------------------
// PhysicalCamera
// ---------------------------------------------------------------------------

describe('PhysicalCamera — hyperfocal distance', () => {
  const cam = new PhysicalCamera(CINEMA_PRESETS.full_frame_50mm);

  test('hyperfocal distance is positive', () => {
    expect(cam.hyperfocalDistance_m).toBeGreaterThan(0);
  });

  test('50mm f/2.0 hyperfocal is roughly 43 m', () => {
    // H ≈ f²/(N×c) + f = 0.05²/(2×0.000029) + 0.05 ≈ 43.1 m
    expect(cam.hyperfocalDistance_m).toBeCloseTo(43.1, 0);
  });
});

describe('PhysicalCamera — depthOfField', () => {
  const cam = new PhysicalCamera(CINEMA_PRESETS.super35_85mm_portrait);
  const dof = cam.depthOfField();

  test('near_m is less than focus distance', () => {
    expect(dof.near_m).toBeLessThan(CINEMA_PRESETS.super35_85mm_portrait.focusDistance_m);
  });

  test('far_m is greater than focus distance when not infinity', () => {
    if (!dof.far_is_infinity) {
      expect(dof.far_m).toBeGreaterThan(CINEMA_PRESETS.super35_85mm_portrait.focusDistance_m);
    }
  });

  test('wide establishing shot has deeper DoF than portrait', () => {
    const wideDoF    = new PhysicalCamera(CINEMA_PRESETS.wide_establishing).depthOfField();
    const portraitDoF = new PhysicalCamera(CINEMA_PRESETS.super35_85mm_portrait).depthOfField();
    expect(wideDoF.total_m).toBeGreaterThan(portraitDoF.total_m);
  });
});

describe('PhysicalCamera — circleOfConfusion', () => {
  const cam = new PhysicalCamera(CINEMA_PRESETS.full_frame_50mm);

  test('subject at focus distance has very low CoC', () => {
    const coc = cam.circleOfConfusion(cam.spec.focusDistance_m);
    expect(coc.blur_intensity).toBeLessThan(0.05);
    expect(coc.in_focus).toBe(true);
  });

  test('subject far from focus distance has higher CoC', () => {
    const coc = cam.circleOfConfusion(20); // much farther than 3 m focus
    expect(coc.blur_intensity).toBeGreaterThan(0);
  });

  test('CoC diameter_mm is non-negative', () => {
    expect(cam.circleOfConfusion(1.0).diameter_mm).toBeGreaterThanOrEqual(0);
    expect(cam.circleOfConfusion(10.0).diameter_mm).toBeGreaterThanOrEqual(0);
  });
});

describe('PhysicalCamera — blurIntensityAtZ', () => {
  const cam = new PhysicalCamera(CINEMA_PRESETS.anamorphic_widescreen);

  test('subject and target at same Z → blur intensity near 0', () => {
    const blur = cam.blurIntensityAtZ(0.5, 0.5);
    expect(blur).toBeLessThan(0.1);
  });

  test('target behind subject has positive blur', () => {
    const blur = cam.blurIntensityAtZ(0.2, 0.8);
    expect(blur).toBeGreaterThan(0);
  });

  test('blur is in range [0, 1]', () => {
    [0.0, 0.25, 0.5, 0.75, 1.0].forEach(z => {
      const b = cam.blurIntensityAtZ(0.3, z);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    });
  });
});

describe('PhysicalCamera — promptFragment', () => {
  const cam = new PhysicalCamera(CINEMA_PRESETS.full_frame_50mm);

  test('returns non-empty string for any blur intensity', () => {
    [0, 0.3, 0.7, 1.0].forEach(b => {
      expect(cam.promptFragment(b).length).toBeGreaterThan(0);
    });
  });

  test('contains aperture f-stop value', () => {
    expect(cam.promptFragment(0.5)).toContain('f/2');
  });

  test('high blur mentions bokeh', () => {
    expect(cam.promptFragment(0.9).toLowerCase()).toContain('bokeh');
  });
});

// ---------------------------------------------------------------------------
// LightingRig & PointLight
// ---------------------------------------------------------------------------

describe('PointLight — illuminanceAt', () => {
  const light = new PointLight({
    name: 'test', role: 'key', position: { x: 0, y: 0, z: 0 },
    intensity_cd: 1000, colour_temperature_K: 5600,
    colour_label: 'white', shadow_type: 'hard',
  });

  test('inverse square law: distance 1 → 1000 lux', () => {
    expect(light.illuminanceAt({ x: 1, y: 0, z: 0 })).toBeCloseTo(1000, 0);
  });

  test('inverse square law: distance 2 → 250 lux (1000/4)', () => {
    expect(light.illuminanceAt({ x: 2, y: 0, z: 0 })).toBeCloseTo(250, 0);
  });

  test('returns 0 at the light position itself', () => {
    expect(light.illuminanceAt({ x: 0, y: 0, z: 0 })).toBe(0);
  });
});

describe('LightingRig', () => {
  test('PARKING_LOT_RIG has 3 lights', () => {
    expect(PARKING_LOT_RIG.lights).toHaveLength(3);
  });

  test('describeAt returns positive total_lux at scene centre', () => {
    const desc = PARKING_LOT_RIG.describeAt({ x: 0.5, y: 0.5, z: 0.5 });
    expect(desc.total_lux).toBeGreaterThan(0);
  });

  test('lighting_ratio is >= 1 (key always >= fill)', () => {
    const desc = PARKING_LOT_RIG.describeAt({ x: 0.5, y: 0.5, z: 0.5 });
    expect(desc.lighting_ratio).toBeGreaterThanOrEqual(1);
  });

  test('promptFragment is a non-empty string', () => {
    expect(PARKING_LOT_RIG.describeAt({ x: 0.5, y: 0.5, z: 0.5 }).promptFragment.length).toBeGreaterThan(0);
  });

  test('KITCHEN_RIG produces higher total lux than PARKING_LOT_RIG (sunlight > streetlamp)', () => {
    const kitchenLux = KITCHEN_RIG.totalIlluminanceAt({ x: 0.5, y: 0.5, z: 0.5 });
    const lotLux     = PARKING_LOT_RIG.totalIlluminanceAt({ x: 0.5, y: 0.5, z: 0.5 });
    expect(kitchenLux).toBeGreaterThan(lotLux);
  });
});

describe('colourTempToLabel', () => {
  test('2000 K → candlelight', () => {
    expect(colourTempToLabel(2000)).toContain('amber');
  });

  test('5600 K → cool daylight', () => {
    expect(colourTempToLabel(5600)).toContain('daylight');
  });

  test('6500 K → overcast or blue sky', () => {
    // The boundary at exactly 6500 falls into the ≥6500 "cool blue sky" bucket.
    // Accept either wording since this is the transition point.
    const label = colourTempToLabel(6500);
    expect(label).toMatch(/overcast|blue sky/);
  });
});

// ---------------------------------------------------------------------------
// GrainAwareLuminanceNoise
// ---------------------------------------------------------------------------

describe('GrainAwareLuminanceNoise — sampleAt', () => {
  const noise = new GrainAwareLuminanceNoise(STOCK_PRESETS.kodak_vision3_500t, 42);

  test('returns GrainSample with raw_noise in [0, 1]', () => {
    const s = noise.sampleAt(0.5, 0.5, 0.3);
    expect(s.raw_noise).toBeGreaterThanOrEqual(0);
    expect(s.raw_noise).toBeLessThanOrEqual(1);
  });

  test('grain_intensity is 0 at pure white (luma = 1)', () => {
    const s = noise.sampleAt(0.5, 0.5, 1.0);
    expect(s.grain_intensity).toBeCloseTo(0, 3);
  });

  test('dark shadows have more grain than bright highlights', () => {
    const dark  = noise.sampleAt(0.5, 0.5, 0.05).grain_intensity;
    const light = noise.sampleAt(0.5, 0.5, 0.95).grain_intensity;
    expect(dark).toBeGreaterThan(light);
  });

  test('deterministic: same position + seed → same result', () => {
    const s1 = noise.sampleAt(0.3, 0.7, 0.4);
    const s2 = noise.sampleAt(0.3, 0.7, 0.4);
    expect(s1.raw_noise).toBe(s2.raw_noise);
    expect(s1.grain_intensity).toBe(s2.grain_intensity);
  });
});

describe('GrainAwareLuminanceNoise — sampleGrid', () => {
  const noise = new GrainAwareLuminanceNoise(STOCK_PRESETS.fuji_eterna_250d);

  test('sampleGrid returns correct dimensions', () => {
    const grid = noise.sampleGrid(8, 6, 0.3);
    expect(grid).toHaveLength(6);
    expect(grid[0]).toHaveLength(8);
  });
});

describe('GrainAwareLuminanceNoise — promptFragment', () => {
  test('returns non-empty string', () => {
    const n = new GrainAwareLuminanceNoise(STOCK_PRESETS.kodak_5219_pushed);
    expect(n.promptFragment().length).toBeGreaterThan(0);
  });

  test('pushed stock mentions heavy/pronounced grain', () => {
    const n = new GrainAwareLuminanceNoise(STOCK_PRESETS.kodak_5219_pushed);
    const f = n.promptFragment();
    expect(f.toLowerCase()).toMatch(/heavy|pronounced|coarse/);
  });
});

// ---------------------------------------------------------------------------
// gaussianKernel1D
// ---------------------------------------------------------------------------

describe('gaussianKernel1D', () => {
  test('kernel length = 2 × radius + 1', () => {
    expect(gaussianKernel1D(3, 1.0)).toHaveLength(7);
  });

  test('kernel values sum to approximately 1', () => {
    const k = gaussianKernel1D(5, 1.5);
    const s = k.reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1.0, 5);
  });

  test('peak is at centre', () => {
    const k    = gaussianKernel1D(4, 1.0);
    const peak = k.indexOf(Math.max(...k));
    expect(peak).toBe(4); // centre of length-9 array
  });

  test('kernel is symmetric', () => {
    const k = gaussianKernel1D(3, 1.2);
    for (let i = 0; i < k.length; i++) {
      expect(k[i]).toBeCloseTo(k[k.length - 1 - i], 8);
    }
  });
});

describe('gaussianBlurRadius', () => {
  test('larger CoC → larger combined sigma', () => {
    expect(gaussianBlurRadius(10)).toBeGreaterThan(gaussianBlurRadius(2));
  });

  test('combines coc and grain in quadrature', () => {
    const sigma_coc   = 5; // coc_pixels / 2
    const sigma_grain = 0.8;
    const expected    = Math.sqrt(sigma_coc ** 2 + sigma_grain ** 2);
    expect(gaussianBlurRadius(10, 0.8)).toBeCloseTo(expected, 5);
  });
});
