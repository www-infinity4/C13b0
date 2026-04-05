#!/usr/bin/env node
/**
 * Cartoon Prompt Engine — CLI (v2)
 *
 * Usage:
 *   npx ts-node -P tsconfig.engine.json cartoon-engine/cli.ts [options]
 *
 * Options:
 *   --tile        <id>      Tile identifier           (default: tile_0001)
 *   --character   <id>      Character from registry   (default: mouse_01)
 *                           Choices: mouse_01 | investor_gadget
 *   --premise     <string>  One-sentence story premise
 *   --out         <dir>     Output directory          (default: sample-output)
 *   --storyboard            Print ASCII storyboard to stdout
 *   --3d                    Include 3-D physics maps in output
 *
 * Output files (all deterministic, no video rendered):
 *   <tile>.shots.yaml       4-shot blueprint with DNA consistency string
 *   <tile>.dialogue.txt     Dialogue lines per shot
 *   <tile>.visemes.json     Lip-sync skeleton (empty segments + frame ranges)
 *   <tile>.edl.json         Edit decision list (shot ordering + frame ranges)
 *   <tile>.edl.xml          FCPXML timeline (DaVinci Resolve / Premiere)
 *   <tile>.edl              CMX 3600 EDL (universal NLE support)
 *   <tile>.comfyui.json     ComfyUI API workflow (headless generation)
 *   <tile>.storyboard.txt   ASCII storyboard preview
 *   <tile>.physics.json     Cartesian 2-D movement data
 *   <tile>.physics3d.json   3-D physics maps (with --3d flag)
 *   <tile>.verify.json      4-hash tamper-evident verification envelope
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  generateTileBlueprint,
  generateDialogue,
  generateVisemes,
  generateEDL,
  emitComfyUIWorkflow,
  renderStoryboardCLI,
  toggleDimensionMode,
} from './generator';
import { toDavinciResolveXml, toCmxEdl } from './export';

// ---------------------------------------------------------------------------
// Arg parsing (no external deps)
// ---------------------------------------------------------------------------

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const tileId       = getArg('--tile',      'tile_0001');
const characterId  = getArg('--character', 'mouse_01');
const premise      = getArg(
  '--premise',
  characterId === 'investor_gadget'
    ? 'Investor Gadget rescues a bystander in the parking lot'
    : 'A hungry mouse discovers a giant cheese wedge in the kitchen'
);
const outDir         = getArg('--out', 'sample-output');
const printStoryboard = hasFlag('--storyboard');
const enable3D        = hasFlag('--3d');

// ---------------------------------------------------------------------------
// Generate all artifacts
// ---------------------------------------------------------------------------

const { blueprint, physics_maps, verification } = generateTileBlueprint(
  tileId, premise, 24, characterId
);
const dialogue   = generateDialogue(tileId, premise, characterId);
const visemes    = generateVisemes(tileId, blueprint);
const edl        = generateEDL(tileId, blueprint);
const comfyui    = emitComfyUIWorkflow(tileId, blueprint);
const storyboard = renderStoryboardCLI(tileId, blueprint);
const edlXml     = toDavinciResolveXml(tileId, blueprint);
const edlCmx     = toCmxEdl(tileId, blueprint);

const tile3d = enable3D
  ? toggleDimensionMode({ blueprint, physics_maps, verification }, 'MESH_3D')
  : null;

fs.mkdirSync(outDir, { recursive: true });

const files: Record<string, string> = {
  shots:      path.join(outDir, `${tileId}.shots.yaml`),
  dialogue:   path.join(outDir, `${tileId}.dialogue.txt`),
  visemes:    path.join(outDir, `${tileId}.visemes.json`),
  edl:        path.join(outDir, `${tileId}.edl.json`),
  edlXml:     path.join(outDir, `${tileId}.edl.xml`),
  edlCmx:     path.join(outDir, `${tileId}.edl`),
  comfyui:    path.join(outDir, `${tileId}.comfyui.json`),
  storyboard: path.join(outDir, `${tileId}.storyboard.txt`),
  physics:    path.join(outDir, `${tileId}.physics.json`),
  verify:     path.join(outDir, `${tileId}.verify.json`),
};

if (enable3D) {
  files['physics3d'] = path.join(outDir, `${tileId}.physics3d.json`);
}

fs.writeFileSync(files.shots,      yaml.dump(blueprint,    { lineWidth: 120 }), 'utf8');
fs.writeFileSync(files.dialogue,   dialogue,                                     'utf8');
fs.writeFileSync(files.visemes,    JSON.stringify(visemes,      null, 2),        'utf8');
fs.writeFileSync(files.edl,        JSON.stringify(edl,          null, 2),        'utf8');
fs.writeFileSync(files.edlXml,     edlXml,                                       'utf8');
fs.writeFileSync(files.edlCmx,     edlCmx,                                       'utf8');
fs.writeFileSync(files.comfyui,    JSON.stringify(comfyui,      null, 2),        'utf8');
fs.writeFileSync(files.storyboard, storyboard,                                   'utf8');
fs.writeFileSync(files.physics,    JSON.stringify(physics_maps, null, 2),        'utf8');
fs.writeFileSync(files.verify,     JSON.stringify(verification, null, 2),        'utf8');

if (enable3D && tile3d && files['physics3d']) {
  fs.writeFileSync(files['physics3d'], JSON.stringify(tile3d.physics_maps_3d, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Optional: print storyboard to stdout
// ---------------------------------------------------------------------------

if (printStoryboard) {
  process.stdout.write(storyboard + '\n');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const h     = verification.hashes;
const short = (s: string) => s.slice(0, 16) + '…';

console.log(`\n✅  Cartoon Prompt Engine — "${tileId}" generated`);
console.log(`   character : ${characterId}`);
console.log(`   premise   : ${premise}`);
console.log(`   fps       : ${blueprint.tile.fps}`);
console.log(`   frames    : ${blueprint.tile.total_frames}  (${blueprint.shots.length} shots)`);
if (enable3D) console.log(`   3-D mode  : MESH_3D (${tile3d?.physics_maps_3d.length ?? 0} maps)`);
console.log(`\n   4-Hash Verification (SHA-256):`);
console.log(`     [1] story_hash    ${short(h.story_hash)}`);
console.log(`     [2] geometry_hash ${short(h.geometry_hash)}`);
console.log(`     [3] dna_hash      ${short(h.dna_hash)}`);
console.log(`     [4] master_hash   ${short(h.master_hash)}`);
console.log(`\n   Output files:`);
Object.values(files).forEach(f => console.log(`     ${f}`));
console.log('');
