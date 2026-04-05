/**
 * Tests — Color Grading, PerlinNoise, FilmGrainOverlay, LightWrap,
 *          MaterialDescriptors, MotifMapper, metadata
 */

import {
  COLOR_GRADE_PRESETS,
  ColorGradingFactory,
  PerlinNoise,
  FilmGrainOverlay,
  computeLightWrap,
  MATERIAL_DESCRIPTORS,
} from '../color-grading';
import { MotifMapper, MOTIF_REGISTRY } from '../audio-engine/composer';
import { sentimentToEmotionalState } from '../audio-engine/voice';
import {
  generateCellToken,
  attachData,
  tokenizeTile,
  formatTokenSummary,
} from '../metadata';

// ---------------------------------------------------------------------------
// COLOR_GRADE_PRESETS
// ---------------------------------------------------------------------------

describe('COLOR_GRADE_PRESETS', () => {
  const ids = Object.keys(COLOR_GRADE_PRESETS);

  test('contains 6 presets', () => {
    expect(ids).toHaveLength(6);
  });

  test('every preset has a non-empty promptFragment', () => {
    ids.forEach(id => {
      expect(COLOR_GRADE_PRESETS[id as keyof typeof COLOR_GRADE_PRESETS].promptFragment.length).toBeGreaterThan(0);
    });
  });

  test('classic_technicolor mentions Technicolor', () => {
    expect(COLOR_GRADE_PRESETS.classic_technicolor.promptFragment.toLowerCase()).toContain('technicolor');
  });
});

// ---------------------------------------------------------------------------
// ColorGradingFactory
// ---------------------------------------------------------------------------

describe('ColorGradingFactory', () => {
  const factory = new ColorGradingFactory('classic_technicolor');

  test('appendToPrompt prepends base prompt', () => {
    const result = factory.appendToPrompt('Gadget in parking lot');
    expect(result.startsWith('Gadget in parking lot')).toBe(true);
    expect(result.length).toBeGreaterThan('Gadget in parking lot'.length);
  });

  test('promptFragment includes color grade content', () => {
    expect(factory.promptFragment()).toContain('Technicolor');
  });

  test('with grain option, promptFragment includes grain descriptor', () => {
    const withGrain = new ColorGradingFactory('modern_noir', { grain: { strength: 0.6, seed: 1 } });
    expect(withGrain.promptFragment()).toMatch(/grain|texture/i);
  });

  test('with light wrap option, promptFragment includes wrap descriptor', () => {
    const withWrap = new ColorGradingFactory('dolby_vision_hdr', {
      lightWrap: { background_colour: 'warm concrete', intensity: 0.5 },
    });
    expect(withWrap.promptFragment()).toContain('warm concrete');
  });
});

// ---------------------------------------------------------------------------
// PerlinNoise
// ---------------------------------------------------------------------------

describe('PerlinNoise', () => {
  const pn = new PerlinNoise(42);

  test('noise() returns value in range [-1, +1]', () => {
    for (let i = 0; i < 20; i++) {
      const v = pn.noise(i * 0.17, i * 0.23);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('normalised() returns value in range [0, 1]', () => {
    for (let i = 0; i < 20; i++) {
      const v = pn.normalised(i * 0.31, i * 0.19);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('same inputs always return same value (deterministic)', () => {
    const v1 = pn.noise(1.5, 2.7);
    const v2 = pn.noise(1.5, 2.7);
    expect(v1).toBe(v2);
  });

  test('different seeds produce different noise fields', () => {
    const p1 = new PerlinNoise(1);
    const p2 = new PerlinNoise(2);
    // Sample multiple points; at least one must differ between seeds
    const points = [[0.3, 0.7], [1.1, 2.3], [5.5, 3.1]];
    const allSame = points.every(([x, y]) => p1.noise(x, y) === p2.noise(x, y));
    expect(allSame).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FilmGrainOverlay
// ---------------------------------------------------------------------------

describe('FilmGrainOverlay', () => {
  test('describe() returns an intensity classification', () => {
    const overlay = new FilmGrainOverlay({ strength: 0.5, seed: 7 });
    const desc    = overlay.describe();
    expect(['none', 'fine', 'medium', 'heavy', 'extreme']).toContain(desc.intensity);
  });

  test('strength 0 → "none" intensity', () => {
    const desc = new FilmGrainOverlay({ strength: 0 }).describe();
    expect(desc.intensity).toBe('none');
    expect(desc.promptFragment).toBe('');
  });

  test('strength 0.9 → "heavy" or "extreme" intensity', () => {
    const desc = new FilmGrainOverlay({ strength: 0.9, seed: 1 }).describe();
    expect(['heavy', 'extreme']).toContain(desc.intensity);
  });

  test('sampleGrid is 4×4', () => {
    const desc = new FilmGrainOverlay({ strength: 0.4 }).describe();
    expect(desc.sampleGrid).toHaveLength(4);
    expect(desc.sampleGrid[0]).toHaveLength(4);
  });

  test('all sampleGrid values are in [0, 1]', () => {
    const desc = new FilmGrainOverlay({ strength: 0.4 }).describe();
    desc.sampleGrid.flat().forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// computeLightWrap
// ---------------------------------------------------------------------------

describe('computeLightWrap', () => {
  test('returns intensity clamped to [0, 1]', () => {
    expect(computeLightWrap({ background_colour: 'blue', intensity: 2.0 }).intensity).toBe(1);
    expect(computeLightWrap({ background_colour: 'blue', intensity: -1 }).intensity).toBe(0);
  });

  test('promptFragment includes background colour', () => {
    const d = computeLightWrap({ background_colour: 'warm orange', intensity: 0.5 });
    expect(d.promptFragment).toContain('warm orange');
  });

  test('default intensity is 0.4', () => {
    expect(computeLightWrap({ background_colour: 'grey' }).intensity).toBeCloseTo(0.4, 5);
  });
});

// ---------------------------------------------------------------------------
// MATERIAL_DESCRIPTORS
// ---------------------------------------------------------------------------

describe('MATERIAL_DESCRIPTORS', () => {
  test('contains 6 material types', () => {
    expect(Object.keys(MATERIAL_DESCRIPTORS)).toHaveLength(6);
  });

  test('skin_warm has SSS enabled with high intensity', () => {
    const m = MATERIAL_DESCRIPTORS.skin_warm;
    expect(m.has_sss).toBe(true);
    expect(m.sss_intensity).toBeGreaterThan(0.5);
  });

  test('cartoon_cel has no SSS', () => {
    expect(MATERIAL_DESCRIPTORS.cartoon_cel.has_sss).toBe(false);
    expect(MATERIAL_DESCRIPTORS.cartoon_cel.sss_intensity).toBe(0);
  });

  test('metallic_chrome has maximum specular', () => {
    expect(MATERIAL_DESCRIPTORS.metallic_chrome.specular_intensity).toBe(1.0);
  });

  test('every material has a non-empty promptFragment', () => {
    Object.values(MATERIAL_DESCRIPTORS).forEach(m => {
      expect(m.promptFragment.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// MotifMapper
// ---------------------------------------------------------------------------

describe('MotifMapper', () => {
  const mapper = new MotifMapper();

  test('getMotif("rescue") returns the rescue fanfare', () => {
    const motif = mapper.getMotif('rescue');
    expect(motif).not.toBeNull();
    expect(motif?.id).toBe('gadget_rescue_fanfare');
  });

  test('getMotif("cheese_discovery") returns cheese motif', () => {
    expect(mapper.getMotif('cheese_discovery')?.id).toBe('mouse_cheese_discovery');
  });

  test('getMotif returns null for unregistered token', () => {
    expect(mapper.getMotif('unknown_action')).toBeNull();
  });

  test('getPromptFragment returns non-empty string for known token', () => {
    expect(mapper.getPromptFragment('rescue').length).toBeGreaterThan(0);
  });

  test('getPromptFragment returns empty string for unknown token', () => {
    expect(mapper.getPromptFragment('unknown')).toBe('');
  });

  test('scaledExpression scales CC11 by velocity', () => {
    const full = mapper.scaledExpression('rescue', 127);
    const half = mapper.scaledExpression('rescue', 64);
    expect(full).toBeGreaterThan(half!);
    expect(full).toBeLessThanOrEqual(127);
  });

  test('scaledExpression returns null for unregistered token', () => {
    expect(mapper.scaledExpression('unknown', 100)).toBeNull();
  });

  test('motifIds lists all registered IDs', () => {
    expect(mapper.motifIds).toHaveLength(MOTIF_REGISTRY.length);
  });
});

// ---------------------------------------------------------------------------
// sentimentToEmotionalState
// ---------------------------------------------------------------------------

describe('sentimentToEmotionalState', () => {
  test('+0.8 → heroic', () => {
    expect(sentimentToEmotionalState(0.8).label).toBe('heroic');
  });

  test('-0.9 → fearful', () => {
    expect(sentimentToEmotionalState(-0.9).label).toBe('fearful');
  });

  test('0.0 → neutral', () => {
    expect(sentimentToEmotionalState(0.0).label).toBe('neutral');
  });

  test('all results have valence in [-1, 1] and arousal in [0, 1]', () => {
    [-1, -0.7, -0.3, 0, 0.3, 0.7, 1].forEach(s => {
      const e = sentimentToEmotionalState(s);
      expect(e.valence).toBeGreaterThanOrEqual(-1);
      expect(e.valence).toBeLessThanOrEqual(1);
      expect(e.arousal).toBeGreaterThanOrEqual(0);
      expect(e.arousal).toBeLessThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// metadata — generateCellToken
// ---------------------------------------------------------------------------

describe('generateCellToken', () => {
  const token = generateCellToken({
    tileId:      'tile_0001',
    shotId:      'shot_01',
    characterId: 'investor_gadget',
    timestamp:   '2026-04-05T12:00:00.000Z',
  });

  test('id starts with character prefix IG', () => {
    expect(token.id.startsWith('IG-')).toBe(true);
  });

  test('id contains shot code S01', () => {
    expect(token.id).toContain('S01');
  });

  test('hash is 8 uppercase hex characters', () => {
    expect(token.hash).toMatch(/^[0-9A-F]{8}$/);
  });

  test('id format is PREFIX-SCODE-HASH8', () => {
    expect(token.id).toMatch(/^[A-Z]{2}-S\d{2}-[0-9A-F]{8}$/);
  });

  test('same inputs produce same token (deterministic)', () => {
    const t2 = generateCellToken({
      tileId: 'tile_0001', shotId: 'shot_01',
      characterId: 'investor_gadget', timestamp: '2026-04-05T12:00:00.000Z',
    });
    expect(token.id).toBe(t2.id);
  });

  test('mouse_01 uses MS prefix', () => {
    const t = generateCellToken({ tileId: 'tile_0001', shotId: 'shot_01', characterId: 'mouse_01', timestamp: 'T' });
    expect(t.id.startsWith('MS-')).toBe(true);
  });

  test('optional MIDI note is stored', () => {
    const t = generateCellToken({ tileId: 'a', shotId: 'shot_02', characterId: 'mouse_01', midiNote: 67 });
    expect(t.midi_note).toBe(67);
  });
});

describe('attachData', () => {
  const token = generateCellToken({ tileId: 'a', shotId: 'shot_01', characterId: 'investor_gadget' });

  test('attached data is stored on new token', () => {
    const withData = attachData(token, { type: 'cartoon', label: 'dialogue', value: "Gadget's on the case!" });
    expect(withData.attached_data?.type).toBe('cartoon');
    expect(withData.attached_data?.label).toBe('dialogue');
  });

  test('original token is not mutated', () => {
    attachData(token, { type: 'medical', label: 'density', value: 1.24 });
    expect(token.attached_data).toBeUndefined();
  });
});

describe('tokenizeTile', () => {
  const tokens = tokenizeTile('tile_0001', ['shot_01', 'shot_02', 'shot_03', 'shot_04'], 'investor_gadget');

  test('returns one token per shot', () => {
    expect(tokens).toHaveLength(4);
  });

  test('all tokens share the same tile_id', () => {
    tokens.forEach(t => expect(t.tile_id).toBe('tile_0001'));
  });

  test('all tokens have different IDs', () => {
    const ids = tokens.map(t => t.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('formatTokenSummary', () => {
  const token = generateCellToken({
    tileId: 'tile_0001', shotId: 'shot_01',
    characterId: 'investor_gadget', timestamp: '2026-04-05T12:00:00.000Z',
    midiNote: 67,
  });

  test('contains token ID', () => {
    expect(formatTokenSummary(token)).toContain(token.id);
  });

  test('contains tile and shot ID', () => {
    const s = formatTokenSummary(token);
    expect(s).toContain('tile_0001');
    expect(s).toContain('shot_01');
  });

  test('contains MIDI note', () => {
    expect(formatTokenSummary(token)).toContain('MIDI:67');
  });

  test('includes attached data label', () => {
    const withData = attachData(token, { type: 'aerospace', label: 'coord', value: '3D' });
    expect(formatTokenSummary(withData)).toContain('aerospace');
  });
});
