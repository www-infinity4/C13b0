/**
 * Cartoon Prompt Engine — Film Cell Gallery Generator
 *
 * Scans an output directory for generated tile artifacts and builds a
 * self-contained, responsive HTML gallery (gallery.html) — a "light table"
 * view of all Film Cells with their Token IDs, metadata, and data slots.
 *
 * Every time you generate a new tile (via `npm run generate`), re-run this
 * script to update the gallery with the new cells.
 *
 * Usage:
 *   npx ts-node -P tsconfig.engine.json src/web/gallery-gen.ts [options]
 *
 * Options:
 *   --input  <dir>   Directory containing tile artifacts  (default: sample-output)
 *   --output <file>  Path for the generated HTML file     (default: sample-output/gallery.html)
 *
 * What it reads from the output directory:
 *   <tile>.verify.json   → 4-hash envelope + tile ID
 *   <tile>.edl.json      → shot list, frame counts
 *   <tile>.storyboard.txt → ASCII preview (shown in <pre> block)
 *   <tile>.comfyui.json  → node count (displayed as metadata)
 *
 * The generated gallery.html is fully self-contained: no external CSS
 * frameworks, no JavaScript dependencies, no internet required.
 */

import fs from 'fs';
import path from 'path';

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
// Types
// ---------------------------------------------------------------------------

interface TileCard {
  tileId:      string;
  generatedAt: string;
  masterHash:  string;
  shotCount:   number;
  fps:         number;
  totalFrames: number;
  storyboard:  string;
  comfyNodes:  number;
  shots: Array<{
    id:          string;
    duration_s:  number;
    frameCount:  number;
    frameStart:  number;
  }>;
}

// ---------------------------------------------------------------------------
// Tile reader
// ---------------------------------------------------------------------------

function readTileCard(tileId: string, dir: string): TileCard | null {
  const verifyPath    = path.join(dir, `${tileId}.verify.json`);
  const edlPath       = path.join(dir, `${tileId}.edl.json`);
  const storyPath     = path.join(dir, `${tileId}.storyboard.txt`);
  const comfyPath     = path.join(dir, `${tileId}.comfyui.json`);

  if (!fs.existsSync(verifyPath) || !fs.existsSync(edlPath)) return null;

  const verify = JSON.parse(fs.readFileSync(verifyPath, 'utf8')) as {
    tile_id: string;
    generated_at: string;
    hashes: { master_hash: string };
  };
  const edl = JSON.parse(fs.readFileSync(edlPath, 'utf8')) as {
    tile_id: string;
    fps: number;
    total_frames: number;
    entries: Array<{ shot_id: string; frame_start: number; frame_end: number; duration_frames: number }>;
  };

  const storyboard = fs.existsSync(storyPath)
    ? fs.readFileSync(storyPath, 'utf8')
    : '(storyboard not yet generated — run with --storyboard flag)';

  let comfyNodes = 0;
  if (fs.existsSync(comfyPath)) {
    const comfyRaw = JSON.parse(fs.readFileSync(comfyPath, 'utf8')) as Record<string, unknown>;
    comfyNodes = Object.keys(comfyRaw).length;
  }

  const durationS = edl.total_frames / edl.fps;
  const shots = edl.entries.map(e => ({
    id:         e.shot_id,
    duration_s: e.duration_frames / edl.fps,
    frameCount: e.duration_frames,
    frameStart: e.frame_start,
  }));

  return {
    tileId:      verify.tile_id,
    generatedAt: verify.generated_at,
    masterHash:  verify.hashes.master_hash,
    shotCount:   edl.entries.length,
    fps:         edl.fps,
    totalFrames: edl.total_frames,
    storyboard,
    comfyNodes,
    shots,
  };

  void durationS; // acknowledged — used if needed for display
}

function discoverTileIds(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const ids   = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(tile_\w+)\.verify\.json$/);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortHash(h: string): string {
  return h.slice(0, 8) + '…';
}

function renderShotBadges(shots: TileCard['shots']): string {
  return shots.map(s =>
    `<span class="badge">${escHtml(s.id)} <small>${s.duration_s}s · ${s.frameCount}f</small></span>`
  ).join('\n          ');
}

function renderCard(card: TileCard, index: number): string {
  const date = card.generatedAt.replace('T', ' ').slice(0, 19);
  return `
    <article class="cell" id="${escHtml(card.tileId)}">
      <header class="cell-header">
        <span class="cell-index">#${String(index + 1).padStart(3, '0')}</span>
        <span class="cell-id">${escHtml(card.tileId)}</span>
        <span class="cell-hash" title="${escHtml(card.masterHash)}">🔒 ${shortHash(card.masterHash)}</span>
      </header>

      <div class="cell-meta">
        <span>📅 ${escHtml(date)}</span>
        <span>🎞 ${card.fps} fps · ${card.totalFrames} frames · ${card.shotCount} shots</span>
        ${card.comfyNodes > 0 ? `<span>🔧 ${card.comfyNodes} ComfyUI nodes</span>` : ''}
      </div>

      <div class="cell-shots">
        ${renderShotBadges(card.shots)}
      </div>

      <div class="storyboard-wrap">
        <details>
          <summary>▶ ASCII Storyboard</summary>
          <pre class="storyboard">${escHtml(card.storyboard)}</pre>
        </details>
      </div>

      <div class="data-slot">
        <label class="slot-label">📎 Attached Data Slot</label>
        <div class="slot-body">
          <select class="slot-type">
            <option value="">— Select domain —</option>
            <option value="cartoon">🎬 Cartoon / Script</option>
            <option value="medical">🧬 Medical / Imaging</option>
            <option value="aerospace">🚀 Aerospace / Telemetry</option>
            <option value="custom">🔩 Custom</option>
          </select>
          <textarea class="slot-text" rows="2" placeholder="Attach a note, value, or research annotation…"></textarea>
        </div>
      </div>
    </article>`;
}

function buildHtml(cards: TileCard[]): string {
  const cardHtml = cards.map((c, i) => renderCard(c, i)).join('\n');
  const now      = new Date().toISOString().replace('T', ' ').slice(0, 19);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>C13b0 — Film Cell Gallery</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Courier New', Courier, monospace;
      background: #0a0a0f;
      color: #d4d4d4;
      padding: 2rem 1rem;
      min-height: 100vh;
    }

    h1 {
      text-align: center;
      font-size: 1.5rem;
      color: #f5c518;
      letter-spacing: 0.2em;
      margin-bottom: 0.25rem;
    }
    .subtitle {
      text-align: center;
      color: #666;
      font-size: 0.8rem;
      margin-bottom: 2rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1.25rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .cell {
      background: #111118;
      border: 1px solid #2a2a3a;
      border-radius: 6px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: border-color 0.2s;
    }
    .cell:hover { border-color: #f5c518; }

    .cell-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid #2a2a3a;
      padding-bottom: 0.5rem;
    }
    .cell-index { color: #666; font-size: 0.75rem; }
    .cell-id    { font-weight: bold; color: #f5c518; flex: 1; }
    .cell-hash  { font-size: 0.7rem; color: #888; cursor: help; }

    .cell-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #aaa;
    }

    .cell-shots { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .badge {
      background: #1a1a2a;
      border: 1px solid #333;
      border-radius: 3px;
      padding: 0.2rem 0.45rem;
      font-size: 0.7rem;
      color: #8db4e2;
    }
    .badge small { color: #666; }

    .storyboard-wrap details summary {
      cursor: pointer;
      color: #888;
      font-size: 0.75rem;
      user-select: none;
    }
    .storyboard-wrap details summary:hover { color: #f5c518; }
    pre.storyboard {
      font-size: 0.65rem;
      line-height: 1.4;
      color: #9cf;
      overflow-x: auto;
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: #0d0d14;
      border-radius: 3px;
      white-space: pre;
    }

    .data-slot { border-top: 1px solid #2a2a3a; padding-top: 0.75rem; }
    .slot-label {
      display: block;
      font-size: 0.72rem;
      color: #888;
      margin-bottom: 0.4rem;
    }
    .slot-body { display: flex; flex-direction: column; gap: 0.35rem; }
    .slot-type, .slot-text {
      background: #0d0d14;
      border: 1px solid #2a2a3a;
      color: #ccc;
      border-radius: 3px;
      padding: 0.35rem 0.5rem;
      font-family: inherit;
      font-size: 0.75rem;
      width: 100%;
    }
    .slot-type:focus, .slot-text:focus {
      outline: none;
      border-color: #f5c518;
    }

    footer {
      text-align: center;
      color: #444;
      font-size: 0.7rem;
      margin-top: 3rem;
    }
    .empty {
      text-align: center;
      color: #555;
      padding: 4rem;
      grid-column: 1 / -1;
    }
  </style>
</head>
<body>
  <h1>C13b0 — Film Cell Gallery</h1>
  <p class="subtitle">
    ${cards.length} tile${cards.length !== 1 ? 's' : ''} · generated ${escHtml(now)} UTC
  </p>

  <div class="grid">
    ${cards.length === 0
      ? '<p class="empty">No tiles found.<br>Run <code>npm run generate</code> to create your first Film Cell.</p>'
      : cardHtml
    }
  </div>

  <footer>
    C13b0 Cartoon Prompt Engine · Deterministic · No Video Rendered
  </footer>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const tileIds = discoverTileIds(inputDir);
const cards   = tileIds
  .map(id => readTileCard(id, inputDir))
  .filter((c): c is TileCard => c !== null);

const html = buildHtml(cards);
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');

console.log(`\n✅  Gallery generated`);
console.log(`   tiles   : ${cards.length}`);
console.log(`   output  : ${outputFile}`);
console.log('');
