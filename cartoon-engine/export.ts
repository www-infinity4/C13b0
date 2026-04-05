/**
 * Cartoon Prompt Engine — Professional Timeline & 3-D Export
 *
 * Converts tile blueprints and 3-D physics maps into industry-standard
 * file formats consumable by professional tools.
 *
 * Exports:
 *   toDavinciResolveXml()  FCPXML v1.11 — DaVinci Resolve 18+, Premiere Pro, FCP 10.6+
 *   toCmxEdl()             CMX 3600 EDL — universal NLE support
 *   toObjString()          Wavefront OBJ — viewable in any 3-D application
 */

import { TileBlueprint, PhysicsMap3D } from './types';
import { generateEDL } from './generator';

// ---------------------------------------------------------------------------
// FCPXML (Final Cut Pro XML v1.11)
// ---------------------------------------------------------------------------

/**
 * toDavinciResolveXml
 *
 * Serialises a TileBlueprint as FCPXML v1.11.
 *
 * Each shot becomes a `<clip>` element referencing a placeholder media asset
 * at `file:///render/<tileId>/<shotId>.mov`.  Replace these placeholder paths
 * with real rendered media paths before importing into your NLE.
 *
 * The generated file is importable by:
 *   - DaVinci Resolve 18 or later  (File → Import Timeline → Import AAF, EDL, XML…)
 *   - Adobe Premiere Pro 2023+     (File → Import)
 *   - Final Cut Pro 10.6+          (File → Import → XML…)
 *
 * @param tileId     Tile identifier (e.g. "tile_0001").
 * @param blueprint  The tile blueprint to serialise.
 * @returns          FCPXML string; save as `<tileId>.edl.xml`.
 */
export function toDavinciResolveXml(
  tileId: string,
  blueprint: TileBlueprint
): string {
  const { fps, total_frames } = blueprint.tile;
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE fcpxml>');
  lines.push('<fcpxml version="1.11">');

  // ── Resources ─────────────────────────────────────────────────────────────
  lines.push('  <resources>');
  lines.push(
    `    <format id="r1" frameDuration="1/${fps}s" width="1920" height="1080"` +
    ` colorSpace="1-1-1 (Rec. 709)"/>`
  );

  blueprint.shots.forEach((shot, i) => {
    const assetId = `a${i + 1}`;
    const uid     = `${tileId}_${shot.id}`;
    const src     = `file:///render/${tileId}/${shot.id}.mov`;
    const dur     = `${shot.frame_count}/${fps}s`;
    lines.push(
      `    <asset id="${assetId}" name="${escapeXml(shot.id)}" uid="${uid}"` +
      ` src="${src}" start="0s" duration="${dur}" hasVideo="1" format="r1"/>`
    );
  });

  lines.push('  </resources>');

  // ── Library → Event → Project → Sequence ──────────────────────────────────
  lines.push('  <library>');
  lines.push(`    <event name="${escapeXml(tileId)}">`);
  lines.push(`      <project name="${escapeXml(tileId)}">`);
  lines.push(
    `        <sequence format="r1" duration="${total_frames}/${fps}s"` +
    ` tcStart="0/1s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`
  );
  lines.push('          <spine>');

  let frameOffset = 0;
  blueprint.shots.forEach((shot, i) => {
    const assetId = `a${i + 1}`;
    const offset  = `${frameOffset}/${fps}s`;
    const dur     = `${shot.frame_count}/${fps}s`;
    lines.push(
      `            <clip name="${escapeXml(shot.id)}" ref="${assetId}"` +
      ` duration="${dur}" offset="${offset}" format="r1">`
    );
    lines.push(`              <note>${escapeXml(shot.action)}</note>`);
    lines.push('            </clip>');
    frameOffset += shot.frame_count;
  });

  lines.push('          </spine>');
  lines.push('        </sequence>');
  lines.push('      </project>');
  lines.push('    </event>');
  lines.push('  </library>');
  lines.push('</fcpxml>');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CMX 3600 EDL
// ---------------------------------------------------------------------------

/**
 * toCmxEdl
 *
 * Serialises a TileBlueprint as a CMX 3600 Edit Decision List (plain text).
 *
 * CMX 3600 is the most universally supported EDL format — accepted by
 * DaVinci Resolve, Adobe Premiere, Final Cut Pro, and most broadcast NLEs.
 * Timecodes use non-drop-frame (NDF) notation: HH:MM:SS:FF.
 *
 * @param tileId     Tile identifier.
 * @param blueprint  The tile blueprint to serialise.
 * @returns          EDL string; save as `<tileId>.edl`.
 */
export function toCmxEdl(tileId: string, blueprint: TileBlueprint): string {
  const { fps } = blueprint.tile;
  const edl     = generateEDL(tileId, blueprint);

  const lines: string[] = [
    `TITLE:   ${tileId}`,
    'FCM: NON-DROP FRAME',
    '',
  ];

  for (const entry of edl.entries) {
    const index   = String(entry.index).padStart(3, '0');
    const src_in  = framesToTimecode(entry.frame_start, fps);
    const src_out = framesToTimecode(entry.frame_end + 1, fps);
    const rec_in  = framesToTimecode(entry.frame_start, fps);
    const rec_out = framesToTimecode(entry.frame_end + 1, fps);

    lines.push(
      `${index}  AX       V     C        ${src_in} ${src_out} ${rec_in} ${rec_out}`
    );
    lines.push(`* FROM CLIP NAME: ${entry.shot_id}`);

    const shot = blueprint.shots.find(s => s.id === entry.shot_id);
    if (shot) {
      const actionPreview = shot.action.length > 60
        ? shot.action.slice(0, 59) + '…'
        : shot.action;
      lines.push(`* COMMENT: ${actionPreview}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Wavefront OBJ — 3-D physics path exporter
// ---------------------------------------------------------------------------

/**
 * toObjString
 *
 * Converts one or more PhysicsMap3D frame sequences into a Wavefront OBJ
 * string.  Each character's motion path becomes a named polyline (a set of
 * vertices connected with line elements).
 *
 * The OBJ file can be opened directly in Blender, Cinema 4D, MeshLab,
 * or any 3-D application to visualise the character motion paths in space.
 *
 * Coordinate mapping:
 *   Physics X (0..1, left→right)       →  OBJ X ( −0.5..+0.5 )
 *   Physics Y (0..1, top→bottom)       →  OBJ Y ( +0.5..−0.5 )  (Y-up flip)
 *   Physics Z (0..1, near→far)         →  OBJ Z ( +0.5..−0.5 )  (Z-in flip)
 *
 * @param maps   One or more PhysicsMap3D objects from the 3-D engine.
 * @returns      Wavefront OBJ string; save as `<tileId>.obj`.
 */
export function toObjString(maps: readonly PhysicsMap3D[]): string {
  const lines: string[] = [
    '# Cartoon Prompt Engine — 3-D Motion Path Export',
    '# Wavefront OBJ  (Blender, Cinema 4D, MeshLab, etc.)',
    `# Generated: ${new Date().toISOString()}`,
    '',
  ];

  let vertexOffset = 1; // OBJ vertices are 1-indexed

  for (const map of maps) {
    const seq = map.motion.frame_sequence;
    if (seq.length === 0) continue;

    lines.push(`# Character: ${map.character_id}`);
    lines.push(`o path_${map.character_id}`);

    // Emit vertices — convert normalised coords to centred world space
    for (const pos of seq) {
      const x = +(pos.x - 0.5).toFixed(5);
      const y = +(0.5 - pos.y).toFixed(5); // flip Y: screen top → world up
      const z = +(0.5 - pos.z).toFixed(5); // flip Z: near → positive Z
      lines.push(`v ${x} ${y} ${z}`);
    }

    // Emit a polyline connecting all vertices in sequence
    const vertexIndices = seq.map((_, i) => vertexOffset + i).join(' ');
    lines.push(`l ${vertexIndices}`);
    lines.push('');

    vertexOffset += seq.length;
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a frame count to NDF timecode HH:MM:SS:FF.
 */
export function framesToTimecode(totalFrames: number, fps: number): string {
  const frames       = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const seconds      = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes      = totalMinutes % 60;
  const hours        = Math.floor(totalMinutes / 60);

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
    String(frames).padStart(2, '0'),
  ].join(':');
}

/**
 * Escape special XML characters in a string for safe inclusion in XML.
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
