import fs from "fs";
import path from "path";
import GalleryClient, { TileCard } from "./GalleryClient";

// ---------------------------------------------------------------------------
// Build-time tile reader — mirrors gallery-gen.ts logic
// ---------------------------------------------------------------------------

interface VerifyJson {
  tile_id: string;
  generated_at: string;
  hashes: { master_hash: string };
}

interface EdlJson {
  fps: number;
  total_frames: number;
  entries: Array<{
    shot_id: string;
    frame_start: number;
    frame_end: number;
    duration_frames: number;
  }>;
}

function readTileCard(tileId: string, dir: string): TileCard | null {
  const verifyPath = path.join(dir, `${tileId}.verify.json`);
  const edlPath = path.join(dir, `${tileId}.edl.json`);
  const storyPath = path.join(dir, `${tileId}.storyboard.txt`);
  const comfyPath = path.join(dir, `${tileId}.comfyui.json`);

  if (!fs.existsSync(verifyPath) || !fs.existsSync(edlPath)) return null;

  const verify = JSON.parse(fs.readFileSync(verifyPath, "utf8")) as VerifyJson;
  const edl = JSON.parse(fs.readFileSync(edlPath, "utf8")) as EdlJson;

  const storyboard = fs.existsSync(storyPath)
    ? fs.readFileSync(storyPath, "utf8")
    : "";

  let comfyNodes = 0;
  if (fs.existsSync(comfyPath)) {
    const raw = JSON.parse(
      fs.readFileSync(comfyPath, "utf8")
    ) as Record<string, unknown>;
    comfyNodes = Object.keys(raw).length;
  }

  return {
    tileId: verify.tile_id,
    generatedAt: verify.generated_at,
    masterHash: verify.hashes.master_hash,
    shotCount: edl.entries.length,
    fps: edl.fps,
    totalFrames: edl.total_frames,
    storyboard,
    comfyNodes,
    shots: edl.entries.map((e) => ({
      id: e.shot_id,
      durationS: e.duration_frames / edl.fps,
      frameCount: e.duration_frames,
      frameStart: e.frame_start,
    })),
  };
}

function discoverTileIds(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((f) => f.match(/^(tile_\w+)\.verify\.json$/)?.[1])
    .filter((id): id is string => Boolean(id))
    .sort();
}

// ---------------------------------------------------------------------------
// Page (server component — runs at build time for static export)
// ---------------------------------------------------------------------------

export default function GalleryPage() {
  const outputDir = path.join(process.cwd(), "sample-output");
  const tileIds = discoverTileIds(outputDir);
  const tiles: TileCard[] = tileIds
    .map((id) => readTileCard(id, outputDir))
    .filter((c): c is TileCard => c !== null);

  return <GalleryClient tiles={tiles} />;
}
