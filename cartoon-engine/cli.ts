#!/usr/bin/env node
/**
 * Cartoon Prompt Engine — CLI (v1)
 *
 * Usage:
 *   npx ts-node -P tsconfig.engine.json cartoon-engine/cli.ts [options]
 *
 * Options:
 *   --tile       <id>         Tile identifier          (default: tile_0001)
 *   --character  <id>         Character from registry  (default: mouse_01)
 *                             Choices: mouse_01 | investor_gadget
 *   --premise    <string>     One-sentence story premise
 *   --out        <dir>        Output directory         (default: sample-output)
 *
 * Example — default mouse scene:
 *   npx ts-node -P tsconfig.engine.json cartoon-engine/cli.ts
 *
 * Example — Investor Gadget parking lot rescue:
 *   npx ts-node -P tsconfig.engine.json cartoon-engine/cli.ts \
 *     --character investor_gadget \
 *     --premise "Investor Gadget rescues a bystander in the parking lot"
 *
 * Output files (all deterministic, no video rendered):
 *   <tile>.shots.yaml      4-shot blueprint with DNA consistency string
 *   <tile>.dialogue.txt    Dialogue lines per shot
 *   <tile>.visemes.json    Lip-sync skeleton (empty segments + frame ranges)
 *   <tile>.edl.json        Edit decision list (shot ordering + frame ranges)
 *   <tile>.physics.json    Cartesian movement data (deltaX/deltaY/frame_sequence)
 *   <tile>.verify.json     4-hash tamper-evident verification envelope
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  generateTileBlueprint,
  generateDialogue,
  generateVisemes,
  generateEDL,
} from './generator';

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

const tileId      = getArg('--tile',      'tile_0001');
const characterId = getArg('--character', 'mouse_01');
const premise     = getArg(
  '--premise',
  characterId === 'investor_gadget'
    ? 'Investor Gadget rescues a bystander in the parking lot'
    : 'A hungry mouse discovers a giant cheese wedge in the kitchen'
);
const outDir = getArg('--out', 'sample-output');

// ---------------------------------------------------------------------------
// Generate all artifacts
// ---------------------------------------------------------------------------

const { blueprint, physics_maps, verification } = generateTileBlueprint(
  tileId, premise, 24, characterId
);
const dialogue = generateDialogue(tileId, premise, characterId);
const visemes  = generateVisemes(tileId, blueprint);
const edl      = generateEDL(tileId, blueprint);

fs.mkdirSync(outDir, { recursive: true });

const files = {
  shots:    path.join(outDir, `${tileId}.shots.yaml`),
  dialogue: path.join(outDir, `${tileId}.dialogue.txt`),
  visemes:  path.join(outDir, `${tileId}.visemes.json`),
  edl:      path.join(outDir, `${tileId}.edl.json`),
  physics:  path.join(outDir, `${tileId}.physics.json`),
  verify:   path.join(outDir, `${tileId}.verify.json`),
};

fs.writeFileSync(files.shots,    yaml.dump(blueprint,    { lineWidth: 120 }), 'utf8');
fs.writeFileSync(files.dialogue, dialogue,                                     'utf8');
fs.writeFileSync(files.visemes,  JSON.stringify(visemes,      null, 2),        'utf8');
fs.writeFileSync(files.edl,      JSON.stringify(edl,          null, 2),        'utf8');
fs.writeFileSync(files.physics,  JSON.stringify(physics_maps, null, 2),        'utf8');
fs.writeFileSync(files.verify,   JSON.stringify(verification, null, 2),        'utf8');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const h = verification.hashes;
const short = (s: string) => s.slice(0, 16) + '…';

console.log(`\n✅  Cartoon Prompt Engine — "${tileId}" generated`);
console.log(`   character : ${characterId}`);
console.log(`   premise   : ${premise}`);
console.log(`   fps       : ${blueprint.tile.fps}`);
console.log(`   frames    : ${blueprint.tile.total_frames}  (${blueprint.shots.length} shots)`);
console.log(`\n   4-Hash Verification (SHA-256):`);
console.log(`     [1] story_hash    ${short(h.story_hash)}`);
console.log(`     [2] geometry_hash ${short(h.geometry_hash)}`);
console.log(`     [3] dna_hash      ${short(h.dna_hash)}`);
console.log(`     [4] master_hash   ${short(h.master_hash)}`);
console.log(`\n   Output files:`);
Object.values(files).forEach(f => console.log(`     ${f}`));
console.log('');
