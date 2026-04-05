#!/usr/bin/env node
/**
 * Cartoon Prompt Engine — CLI (v1)
 *
 * Usage:
 *   npx ts-node -P tsconfig.engine.json cartoon-engine/cli.ts \
 *     --tile tile_0001 \
 *     --premise "A hungry mouse discovers a giant cheese wedge in the kitchen"
 *
 * Outputs (in ./output/):
 *   tile_0001.shots.yaml
 *   tile_0001.dialogue.txt
 *   tile_0001.visemes.json
 *   tile_0001.edl.json
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

const tileId = getArg('--tile', 'tile_0001');
const premise = getArg(
  '--premise',
  'A hungry mouse discovers a giant cheese wedge in the kitchen'
);
const outDir = getArg('--out', 'output');

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

const blueprint = generateTileBlueprint(tileId, premise);
const dialogue = generateDialogue(tileId, premise);
const visemes = generateVisemes(tileId, blueprint);
const edl = generateEDL(tileId, blueprint);

fs.mkdirSync(outDir, { recursive: true });

const shotsPath = path.join(outDir, `${tileId}.shots.yaml`);
const dialoguePath = path.join(outDir, `${tileId}.dialogue.txt`);
const visemesPath = path.join(outDir, `${tileId}.visemes.json`);
const edlPath = path.join(outDir, `${tileId}.edl.json`);

fs.writeFileSync(shotsPath, yaml.dump(blueprint, { lineWidth: 120 }), 'utf8');
fs.writeFileSync(dialoguePath, dialogue, 'utf8');
fs.writeFileSync(visemesPath, JSON.stringify(visemes, null, 2), 'utf8');
fs.writeFileSync(edlPath, JSON.stringify(edl, null, 2), 'utf8');

console.log(`✅  Cartoon Prompt Engine — Tile "${tileId}" generated`);
console.log(`   premise : ${premise}`);
console.log(`   fps     : ${blueprint.tile.fps}`);
console.log(`   frames  : ${blueprint.tile.total_frames}`);
console.log(`   shots   : ${blueprint.shots.length}`);
console.log('');
console.log('   Output files:');
console.log(`     ${shotsPath}`);
console.log(`     ${dialoguePath}`);
console.log(`     ${visemesPath}`);
console.log(`     ${edlPath}`);
