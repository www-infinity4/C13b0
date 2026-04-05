/**
 * Tests — ComfyUI Workflow Emitter
 */

import {
  generateTileBlueprint,
  emitComfyUIWorkflow,
  SHOT_DURATIONS_S,
} from '../generator';

const { blueprint } = generateTileBlueprint('tile_0001', 'test premise', 24, 'investor_gadget');

describe('emitComfyUIWorkflow — graph structure', () => {
  const wf = emitComfyUIWorkflow('tile_0001', blueprint);

  test('node "1" is CheckpointLoaderSimple', () => {
    expect(wf['1'].class_type).toBe('CheckpointLoaderSimple');
  });

  test('total node count = 1 + 6 × shots (25 for 4 shots)', () => {
    expect(Object.keys(wf)).toHaveLength(1 + blueprint.shots.length * 6);
  });

  test('every node has class_type and inputs', () => {
    Object.values(wf).forEach(node => {
      expect(typeof node.class_type).toBe('string');
      expect(node.class_type.length).toBeGreaterThan(0);
      expect(node.inputs).toBeDefined();
    });
  });

  test('each shot has a KSampler node', () => {
    const kSamplers = Object.values(wf).filter(n => n.class_type === 'KSampler');
    expect(kSamplers).toHaveLength(blueprint.shots.length);
  });

  test('each shot has a SaveImage node', () => {
    const saves = Object.values(wf).filter(n => n.class_type === 'SaveImage');
    expect(saves).toHaveLength(blueprint.shots.length);
  });

  test('each shot has positive and negative CLIPTextEncode nodes', () => {
    const clips = Object.values(wf).filter(n => n.class_type === 'CLIPTextEncode');
    expect(clips).toHaveLength(blueprint.shots.length * 2);
  });

  test('KSampler steps default to 20', () => {
    const k = Object.values(wf).find(n => n.class_type === 'KSampler')!;
    expect(k.inputs.steps).toBe(20);
  });

  test('custom options are applied', () => {
    const custom = emitComfyUIWorkflow('tile_0001', blueprint, { steps: 30, cfg: 8.5 });
    const k      = Object.values(custom).find(n => n.class_type === 'KSampler')!;
    expect(k.inputs.steps).toBe(30);
    expect(k.inputs.cfg).toBe(8.5);
  });
});

describe('emitComfyUIWorkflow — deterministic seeds', () => {
  test('same tile+shot always produces the same seed', () => {
    const wf1 = emitComfyUIWorkflow('tile_0001', blueprint);
    const wf2 = emitComfyUIWorkflow('tile_0001', blueprint);
    const k1  = Object.values(wf1).find(n => n.class_type === 'KSampler')!;
    const k2  = Object.values(wf2).find(n => n.class_type === 'KSampler')!;
    expect(k1.inputs.seed).toBe(k2.inputs.seed);
  });

  test('different shots produce different seeds', () => {
    const kSamplers = Object.values(emitComfyUIWorkflow('tile_0001', blueprint))
      .filter(n => n.class_type === 'KSampler');
    const seeds = kSamplers.map(k => k.inputs.seed);
    const unique = new Set(seeds);
    expect(unique.size).toBe(kSamplers.length);
  });

  test('different tiles produce different seeds for the same shot index', () => {
    const wfA = emitComfyUIWorkflow('tile_0001', blueprint);
    const wfB = emitComfyUIWorkflow('tile_9999', blueprint);
    const kA  = Object.values(wfA).find(n => n.class_type === 'KSampler')!;
    const kB  = Object.values(wfB).find(n => n.class_type === 'KSampler')!;
    expect(kA.inputs.seed).not.toBe(kB.inputs.seed);
  });
});

describe('emitComfyUIWorkflow — _meta titles', () => {
  test('every node has a non-empty _meta title', () => {
    const wf = emitComfyUIWorkflow('tile_0001', blueprint);
    Object.values(wf).forEach(node => {
      expect(node._meta?.title.length).toBeGreaterThan(0);
    });
  });
});
