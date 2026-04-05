/**
 * Tests — Professional Timeline & 3-D Export (export.ts)
 */

import { generateTileBlueprint } from '../generator';
import { toDavinciResolveXml, toCmxEdl, toObjString, framesToTimecode, escapeXml } from '../export';
import { buildPhysicsMap3D } from '../physics3d';

const { blueprint } = generateTileBlueprint('tile_0001', 'test', 24, 'investor_gadget');

// ---------------------------------------------------------------------------
// FCPXML
// ---------------------------------------------------------------------------

describe('toDavinciResolveXml', () => {
  const xml = toDavinciResolveXml('tile_0001', blueprint);

  test('starts with XML declaration', () => {
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });

  test('contains fcpxml version 1.11', () => {
    expect(xml).toContain('<fcpxml version="1.11">');
  });

  test('contains correct frame duration for 24 fps', () => {
    expect(xml).toContain('frameDuration="1/24s"');
  });

  test('contains one <asset> per shot (4 total)', () => {
    const matches = xml.match(/<asset /g) ?? [];
    expect(matches).toHaveLength(blueprint.shots.length);
  });

  test('contains one <clip> per shot (4 total)', () => {
    const matches = xml.match(/<clip /g) ?? [];
    expect(matches).toHaveLength(blueprint.shots.length);
  });

  test('total sequence duration matches total_frames/fps', () => {
    const { total_frames, fps } = blueprint.tile;
    expect(xml).toContain(`duration="${total_frames}/${fps}s"`);
  });

  test('clips reference placeholder file paths', () => {
    expect(xml).toContain('file:///render/tile_0001/');
  });

  test('shot action text appears in <note> elements', () => {
    expect(xml).toContain('<note>');
  });

  test('clip offsets are cumulative (shot_02 starts at 72/24s)', () => {
    expect(xml).toContain('offset="72/24s"');
  });
});

// ---------------------------------------------------------------------------
// CMX 3600 EDL
// ---------------------------------------------------------------------------

describe('toCmxEdl', () => {
  const edl = toCmxEdl('tile_0001', blueprint);

  test('starts with TITLE line', () => {
    expect(edl.startsWith('TITLE:')).toBe(true);
  });

  test('contains FCM: NON-DROP FRAME', () => {
    expect(edl).toContain('FCM: NON-DROP FRAME');
  });

  test('has 4 edit entries (one per shot)', () => {
    const entries = edl.match(/^\d{3}  AX/gm) ?? [];
    expect(entries).toHaveLength(blueprint.shots.length);
  });

  test('first entry starts at 00:00:00:00', () => {
    expect(edl).toContain('00:00:00:00');
  });

  test('first shot out-point is 00:00:03:00 (72 frames / 24 fps = 3 s)', () => {
    expect(edl).toContain('00:00:03:00');
  });

  test('contains FROM CLIP NAME lines', () => {
    expect(edl).toContain('* FROM CLIP NAME:');
  });

  test('contains COMMENT lines with shot actions', () => {
    expect(edl).toContain('* COMMENT:');
  });
});

// ---------------------------------------------------------------------------
// framesToTimecode
// ---------------------------------------------------------------------------

describe('framesToTimecode', () => {
  test('0 frames → 00:00:00:00', () => {
    expect(framesToTimecode(0, 24)).toBe('00:00:00:00');
  });

  test('24 frames → 00:00:01:00', () => {
    expect(framesToTimecode(24, 24)).toBe('00:00:01:00');
  });

  test('720 frames → 00:00:30:00', () => {
    expect(framesToTimecode(720, 24)).toBe('00:00:30:00');
  });

  test('72 frames → 00:00:03:00', () => {
    expect(framesToTimecode(72, 24)).toBe('00:00:03:00');
  });

  test('1 frame at 24 fps → 00:00:00:01', () => {
    expect(framesToTimecode(1, 24)).toBe('00:00:00:01');
  });

  test('works at 30 fps', () => {
    expect(framesToTimecode(30, 30)).toBe('00:00:01:00');
    expect(framesToTimecode(1800, 30)).toBe('00:01:00:00');
  });
});

// ---------------------------------------------------------------------------
// escapeXml
// ---------------------------------------------------------------------------

describe('escapeXml', () => {
  test('escapes ampersand', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
  });

  test('escapes angle brackets', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
  });

  test('escapes double quotes', () => {
    expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
  });

  test('leaves plain text unchanged', () => {
    expect(escapeXml('plain text')).toBe('plain text');
  });
});

// ---------------------------------------------------------------------------
// toObjString (Wavefront OBJ)
// ---------------------------------------------------------------------------

describe('toObjString', () => {
  const map3d = buildPhysicsMap3D({
    character_id:        'investor_gadget',
    initial_position:    { x: 0.1, y: 0.8, z: 0.5 },
    target_position:     { x: 0.5, y: 0.8, z: 0.5 },
    velocity_units_per_s: 0.2,
    fps:                 24,
  });

  const obj = toObjString([map3d]);

  test('starts with OBJ comment header', () => {
    expect(obj.startsWith('# Cartoon Prompt Engine')).toBe(true);
  });

  test('contains vertex lines (v ...)', () => {
    const vLines = obj.split('\n').filter(l => l.startsWith('v '));
    expect(vLines.length).toBeGreaterThan(0);
  });

  test('contains line element (l ...)', () => {
    expect(obj).toContain('\nl ');
  });

  test('contains object group for character', () => {
    expect(obj).toContain('o path_investor_gadget');
  });

  test('vertex count matches frame_sequence length', () => {
    const vLines = obj.split('\n').filter(l => l.startsWith('v '));
    expect(vLines).toHaveLength(map3d.motion.frame_sequence.length);
  });

  test('Y coordinate is flipped (screen top → world up)', () => {
    // First vertex: initial y=0.8 → OBJ y = 0.5 - 0.8 = -0.3
    const firstV = obj.split('\n').find(l => l.startsWith('v '))!;
    const parts  = firstV.split(' ').map(Number);
    expect(parts[2]).toBeCloseTo(0.5 - 0.8, 2); // OBJ Y = 0.5 - physics.y
  });

  test('handles empty maps array', () => {
    const empty = toObjString([]);
    expect(empty).toContain('# Cartoon Prompt Engine');
    expect(empty.split('\n').filter(l => l.startsWith('v '))).toHaveLength(0);
  });
});
