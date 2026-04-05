/**
 * Cartoon Prompt Engine — Film Cell Gallery Watcher
 *
 * Watches the output directory for new tile artifacts and automatically
 * rebuilds gallery.html whenever a new tile is generated.
 *
 * Usage:
 *   npx ts-node -P tsconfig.engine.json src/web/gallery-watcher.ts [options]
 *
 * Options:
 *   --input  <dir>   Directory to watch   (default: sample-output)
 *   --output <file>  Gallery HTML path    (default: <input>/gallery.html)
 *
 * How it works:
 *   1. Builds the gallery immediately on startup from any existing tiles.
 *   2. Watches <input> for new or changed *.verify.json files.
 *   3. On each change, waits 500 ms (debounce), then rebuilds gallery.html.
 *   4. Prints a one-line status line for every rebuild.
 *
 * MIDI → gallery integration:
 *   Run this watcher alongside the CLI generator.  Every time you play a
 *   chord and the CLI writes a new tile, the watcher detects the new
 *   .verify.json and rebuilds the gallery within 500 ms — no manual refresh.
 *
 *   Terminal A:  npx ts-node … cartoon-engine/cli.ts --character investor_gadget
 *   Terminal B:  npx ts-node … src/web/gallery-watcher.ts
 *   Browser:     open sample-output/gallery.html  (and keep the tab open)
 */

import fs   from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function getArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

const inputDir   = getArg('--input',  'sample-output');
const outputFile = getArg('--output', path.join(inputDir, 'gallery.html'));

// ---------------------------------------------------------------------------
// Gallery rebuild (delegates to gallery-gen.ts via ts-node)
// ---------------------------------------------------------------------------

const galleryGenPath = path.resolve(__dirname, 'gallery-gen.ts');
const tsconfigPath   = path.resolve(process.cwd(), 'tsconfig.engine.json');

function rebuild(reason: string): void {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  process.stdout.write(`  [${timestamp}] ${reason} → rebuilding gallery…`);
  try {
    execFileSync(
      process.execPath,
      ['-r', 'ts-node/register', '--project', tsconfigPath, galleryGenPath,
        '--input', inputDir, '--output', outputFile],
      { stdio: 'pipe' }
    );
    console.log(' ✓');
  } catch (err) {
    const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
    console.log(` ✗ ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Debouncer
// ---------------------------------------------------------------------------

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

function scheduleRebuild(reason: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { rebuild(reason); debounceTimer = null; }, DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Initial build
// ---------------------------------------------------------------------------

console.log(`\n🎬  Film Cell Gallery Watcher`);
console.log(`   watching : ${path.resolve(inputDir)}`);
console.log(`   gallery  : ${path.resolve(outputFile)}`);
console.log(`   Press Ctrl+C to stop.\n`);

rebuild('startup');

// ---------------------------------------------------------------------------
// fs.watch loop
// ---------------------------------------------------------------------------

if (!fs.existsSync(inputDir)) {
  fs.mkdirSync(inputDir, { recursive: true });
}

fs.watch(inputDir, { persistent: true }, (_event, filename) => {
  if (filename && filename.endsWith('.verify.json')) {
    const tileId = filename.replace('.verify.json', '');
    scheduleRebuild(`new tile: ${tileId}`);
  }
});
