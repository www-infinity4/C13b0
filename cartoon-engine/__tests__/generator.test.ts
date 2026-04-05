/**
 * Tests — Core Generator
 *
 * Validates: total frames, shot counts, required fields, DNA, hashes.
 */

import {
  generateTileBlueprint,
  generateDialogue,
  generateVisemes,
  generateEDL,
  buildFramePrompt,
  SHOT_DURATIONS_S,
  TOTAL_FRAMES,
  DEFAULT_FPS,
  TILE_DURATION_S,
} from '../generator';

// ---------------------------------------------------------------------------
// Tile math
// ---------------------------------------------------------------------------

describe('tile constants', () => {
  test('TOTAL_FRAMES is 720 at 24 fps / 30 s', () => {
    expect(TOTAL_FRAMES).toBe(720);
    expect(DEFAULT_FPS * TILE_DURATION_S).toBe(720);
  });

  test('SHOT_DURATIONS_S sums to TILE_DURATION_S', () => {
    const total = SHOT_DURATIONS_S.reduce((a, b) => a + b, 0);
    expect(total).toBe(TILE_DURATION_S);
  });
});

// ---------------------------------------------------------------------------
// generateTileBlueprint — mouse (default)
// ---------------------------------------------------------------------------

describe('generateTileBlueprint (mouse_01)', () => {
  const { blueprint, physics_maps, verification } = generateTileBlueprint(
    'tile_0001',
    'A mouse sees cheese',
    24,
    'mouse_01'
  );

  test('tile total_frames equals 720', () => {
    expect(blueprint.tile.total_frames).toBe(720);
  });

  test('tile has exactly 4 shots', () => {
    expect(blueprint.shots).toHaveLength(4);
  });

  test('shot frame counts are correct (72 + 216 + 216 + 216 = 720)', () => {
    const counts = blueprint.shots.map((s) => s.frame_count);
    expect(counts).toEqual([72, 216, 216, 216]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(720);
  });

  test('every shot has required fields', () => {
    blueprint.shots.forEach((shot) => {
      expect(shot.id).toBeTruthy();
      expect(shot.duration_s).toBeGreaterThan(0);
      expect(shot.frame_count).toBeGreaterThan(0);
      expect(shot.camera.framing).toBeTruthy();
      expect(shot.camera.angle).toBeTruthy();
      expect(shot.background).toBeTruthy();
      expect(shot.action).toBeTruthy();
      expect(shot.consistency).toBeTruthy();
    });
  });

  test('shot_01 has no lipsync', () => {
    expect(blueprint.shots[0].lipsync).toBeNull();
  });

  test('shot_02 and shot_03 have lipsync enabled', () => {
    expect(blueprint.shots[1].lipsync?.enabled).toBe(true);
    expect(blueprint.shots[2].lipsync?.enabled).toBe(true);
  });

  test('stitching hook frame is set', () => {
    expect(blueprint.stitching.end_hook_frame).toBe('shot_04:last_frame');
    expect(blueprint.stitching.next_tile_start_matches).toBe(true);
  });

  test('physics_maps has one entry per character', () => {
    expect(physics_maps).toHaveLength(blueprint.characters.length);
  });

  test('physics map has required motion fields', () => {
    const m = physics_maps[0].motion;
    expect(typeof m.delta_x).toBe('number');
    expect(typeof m.delta_y).toBe('number');
    expect(m.frames_to_target).toBeGreaterThan(0);
    expect(m.frame_sequence.length).toBeGreaterThan(0);
  });

  test('verification envelope has all four hashes', () => {
    expect(verification.hashes.story_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verification.hashes.geometry_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verification.hashes.dna_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(verification.hashes.master_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// generateTileBlueprint — Investor Gadget
// ---------------------------------------------------------------------------

describe('generateTileBlueprint (investor_gadget)', () => {
  const { blueprint, verification } = generateTileBlueprint(
    'tile_0001',
    'Investor Gadget rescues a bystander in the parking lot',
    24,
    'investor_gadget'
  );

  test('total frames still 720', () => {
    expect(blueprint.tile.total_frames).toBe(720);
  });

  test('character archetype is investor_gadget', () => {
    expect(blueprint.characters[0].archetype).toBe(
      'character.investor_gadget.cartoon.v1'
    );
  });

  test('consistency string contains DNA hex codes', () => {
    const c = blueprint.characters[0].consistency_checksum;
    expect(c).toContain('#808080');
    expect(c).toContain('#FFD700');
    expect(c).toContain('cel-shaded');
  });

  test('verification hashes are different from mouse tile', () => {
    const { verification: mouseV } = generateTileBlueprint(
      'tile_0001',
      'Investor Gadget rescues a bystander in the parking lot',
      24,
      'mouse_01'
    );
    expect(verification.hashes.dna_hash).not.toBe(mouseV.hashes.dna_hash);
    expect(verification.hashes.master_hash).not.toBe(mouseV.hashes.master_hash);
  });
});

// ---------------------------------------------------------------------------
// generateDialogue
// ---------------------------------------------------------------------------

describe('generateDialogue', () => {
  test('contains SHOT_02 and SHOT_03 markers', () => {
    const d = generateDialogue('tile_0001', 'test premise', 'mouse_01');
    expect(d).toContain('SHOT_02');
    expect(d).toContain('SHOT_03');
  });

  test('investor_gadget dialogue contains Gadget lines', () => {
    const d = generateDialogue('tile_0001', 'test', 'investor_gadget');
    expect(d).toContain('INVESTOR GADGET');
    expect(d).toContain("Gadget's on the case");
  });
});

// ---------------------------------------------------------------------------
// generateVisemes
// ---------------------------------------------------------------------------

describe('generateVisemes', () => {
  const { blueprint } = generateTileBlueprint('tile_0001', 'test', 24, 'mouse_01');
  const v = generateVisemes('tile_0001', blueprint);

  test('has two segments (shot_02, shot_03)', () => {
    expect(v.segments).toHaveLength(2);
  });

  test('shot_02 segment starts at frame 72', () => {
    const seg = v.segments.find((s) => s.segment === 'shot_02');
    expect(seg?.frame_start).toBe(72);
    expect(seg?.frame_end).toBe(72 + 216 - 1);
  });

  test('shot_03 segment starts at frame 288', () => {
    const seg = v.segments.find((s) => s.segment === 'shot_03');
    expect(seg?.frame_start).toBe(288);
    expect(seg?.frame_end).toBe(288 + 216 - 1);
  });

  test('all viseme arrays are empty (skeleton)', () => {
    v.segments.forEach((s) => expect(s.visemes).toHaveLength(0));
  });
});

// ---------------------------------------------------------------------------
// generateEDL
// ---------------------------------------------------------------------------

describe('generateEDL', () => {
  const { blueprint } = generateTileBlueprint('tile_0001', 'test', 24, 'mouse_01');
  const edl = generateEDL('tile_0001', blueprint);

  test('has 4 entries', () => {
    expect(edl.entries).toHaveLength(4);
  });

  test('total_frames matches tile', () => {
    expect(edl.total_frames).toBe(720);
  });

  test('frame ranges are contiguous and non-overlapping', () => {
    let expected = 0;
    edl.entries.forEach((entry) => {
      expect(entry.frame_start).toBe(expected);
      expect(entry.frame_end).toBe(expected + entry.duration_frames - 1);
      expected += entry.duration_frames;
    });
    expect(expected).toBe(720);
  });
});

// ---------------------------------------------------------------------------
// buildFramePrompt
// ---------------------------------------------------------------------------

describe('buildFramePrompt', () => {
  test('appends DNA descriptor to scene prompt', () => {
    const prompt = buildFramePrompt('investor_gadget', 'wide shot, parking lot');
    expect(prompt).toContain('wide shot, parking lot');
    expect(prompt).toContain('#808080');
    expect(prompt).toContain('cel-shaded');
  });

  test('throws for unknown character', () => {
    expect(() => buildFramePrompt('unknown_char', 'test')).toThrow();
  });
});
