/**
 * Cartoon Prompt Engine — Radiosity & Inverse-Square-Law Lighting
 *
 * Deterministic light transport calculations for scene illumination.
 * No randomness, no AI inference — physics-based arithmetic.
 *
 * The core equation: inverse square law for point sources.
 *   E = I / d²
 * where E = illuminance (lux), I = luminous intensity (candela), d = distance (m).
 *
 * Outputs are:
 *   1. Numerical illuminance values usable in compositing or as animation weights.
 *   2. Prompt vocabulary that instructs AI generators to place light correctly
 *      (direction, fall-off, colour temperature) so characters are lit by the
 *      scene rather than floating as stickers in front of it.
 *
 * Multi-light scenes:
 *   The LightingRig class aggregates multiple PointLights and computes the
 *   combined illuminance at any 3-D world point, then translates the result
 *   into a single coherent lighting prompt.
 *
 * Usage:
 *   import { LightingRig, PARKING_LOT_RIG, KITCHEN_RIG } from './lighting';
 *
 *   const rig  = PARKING_LOT_RIG;
 *   const desc = rig.describeAt({ x: 0.5, y: 0.8, z: 0.3 });
 *   console.log(desc.promptFragment);
 *   // → "overcast ambient key, orange sodium streetlamp at upper-left,
 *   //    hard directional shadows, low-key side fill, 2700 K warm source"
 */

import { Vector3D } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Colour temperature in Kelvin — maps to a colour description string. */
export type ColourTemperature_K = number;

/** Named light role in a scene. */
export type LightRole = 'key' | 'fill' | 'rim' | 'ambient' | 'practical' | 'sky';

export interface PointLightSpec {
  /** Unique light name (e.g. "streetlamp_01"). */
  name: string;
  /** Light role in the cinematographic setup. */
  role: LightRole;
  /**
   * World-space position in normalised 3-D engine coordinates.
   * X: 0=left, 1=right; Y: 0=top, 1=bottom; Z: 0=near, 1=far.
   */
  position: Vector3D;
  /**
   * Luminous intensity in candela (cd).
   * Reference values:
   *   Candle:       ≈ 1 cd
   *   100 W bulb:   ≈ 139 cd
   *   Streetlamp:   ≈ 2000–8000 cd
   *   Overcast sky: modelled as ambient; use `intensity_lux` instead.
   */
  intensity_cd: number;
  /** Colour temperature in Kelvin (e.g. 2700 = warm tungsten, 6500 = daylight). */
  colour_temperature_K: ColourTemperature_K;
  /** Colour description in plain language (e.g. "warm orange sodium vapour"). */
  colour_label: string;
  /** Whether this light casts hard or soft shadows. */
  shadow_type: 'hard' | 'soft' | 'none';
}

/** The result of computing illuminance at a world point from a single light. */
export interface IlluminanceResult {
  light_name: string;
  /** Distance from light to point in normalised units. */
  distance: number;
  /** Illuminance in lux (E = I / d²). */
  illuminance_lux: number;
  /** Direction vector from point toward light (unit vector). */
  direction_to_light: Vector3D;
  /** Dominant axis of the light direction (for prompt generation). */
  incident_direction: 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';
}

/** Combined lighting result for a scene point from all lights in a rig. */
export interface SceneLightingDescriptor {
  /** Total illuminance in lux (sum of all lights). */
  total_lux: number;
  /**
   * Lighting ratio: key illuminance / fill illuminance.
   * 1:1 = flat; 4:1 = moderate drama; 8:1+ = high contrast.
   */
  lighting_ratio: number;
  /** Per-light illuminance results. */
  lights: IlluminanceResult[];
  /** Human-readable overall lighting classification. */
  lighting_class: 'low_key' | 'mid_key' | 'high_key';
  /** Ready-to-append prompt fragment. */
  promptFragment: string;
}

// ---------------------------------------------------------------------------
// PointLight
// ---------------------------------------------------------------------------

/**
 * PointLight
 *
 * A single isotropic point light source with inverse-square-law fall-off.
 * Wraps a PointLightSpec and provides the illuminance computation.
 */
export class PointLight {
  readonly spec: PointLightSpec;

  constructor(spec: PointLightSpec) {
    this.spec = spec;
  }

  /**
   * Euclidean distance (normalised units) from this light to a point.
   */
  distanceTo(point: Vector3D): number {
    const { position: p } = this.spec;
    return Math.sqrt(
      (p.x - point.x) ** 2 +
      (p.y - point.y) ** 2 +
      (p.z - point.z) ** 2
    );
  }

  /**
   * Illuminance at a given world point using the inverse square law.
   *   E = I / d²
   * Returns 0 when distance is effectively zero (avoids division by zero).
   *
   * @param point  World-space point (normalised engine coordinates).
   */
  illuminanceAt(point: Vector3D): number {
    const d = this.distanceTo(point);
    if (d < 1e-6) return 0;
    return this.spec.intensity_cd / (d * d);
  }

  /**
   * Full IlluminanceResult at a point, including direction and incident info.
   */
  illuminanceResultAt(point: Vector3D): IlluminanceResult {
    const d = this.distanceTo(point);
    const illum = d < 1e-6 ? 0 : this.spec.intensity_cd / (d * d);

    const { position: lp } = this.spec;
    const raw = {
      x: d > 0 ? (lp.x - point.x) / d : 0,
      y: d > 0 ? (lp.y - point.y) / d : 0,
      z: d > 0 ? (lp.z - point.z) / d : 0,
    };

    // Dominant axis of direction_to_light
    const absX = Math.abs(raw.x);
    const absY = Math.abs(raw.y);
    const absZ = Math.abs(raw.z);
    let incident_direction: IlluminanceResult['incident_direction'];
    if (absY >= absX && absY >= absZ) {
      incident_direction = raw.y > 0 ? 'top' : 'bottom';
    } else if (absX >= absZ) {
      incident_direction = raw.x > 0 ? 'left' : 'right';
    } else {
      incident_direction = raw.z > 0 ? 'front' : 'back';
    }

    return {
      light_name:        this.spec.name,
      distance:          Math.round(d * 10000) / 10000,
      illuminance_lux:   Math.round(illum * 100) / 100,
      direction_to_light: raw,
      incident_direction,
    };
  }
}

// ---------------------------------------------------------------------------
// LightingRig
// ---------------------------------------------------------------------------

/**
 * LightingRig
 *
 * A collection of PointLights forming a complete cinematographic lighting
 * setup.  Computes aggregate illuminance at any scene point and translates
 * the result into a prompt fragment.
 */
export class LightingRig {
  readonly lights: readonly PointLight[];
  readonly name: string;

  constructor(name: string, specs: readonly PointLightSpec[]) {
    this.name   = name;
    this.lights = specs.map(s => new PointLight(s));
  }

  /**
   * Total illuminance (lux) at a point from all lights.
   */
  totalIlluminanceAt(point: Vector3D): number {
    return this.lights.reduce((sum, l) => sum + l.illuminanceAt(point), 0);
  }

  /**
   * Full SceneLightingDescriptor at a point: illuminance, ratio, class, prompt.
   */
  describeAt(point: Vector3D): SceneLightingDescriptor {
    const results = this.lights.map(l => l.illuminanceResultAt(point));
    const total   = results.reduce((s, r) => s + r.illuminance_lux, 0);

    // Lighting ratio: key / fill (key = brightest single source)
    const sorted     = [...results].sort((a, b) => b.illuminance_lux - a.illuminance_lux);
    const keyLux     = sorted[0]?.illuminance_lux ?? 0;
    const fillLux    = sorted[1]?.illuminance_lux ?? 0.01;
    const ratio      = fillLux > 0 ? keyLux / fillLux : keyLux;

    // Lighting class
    const lighting_class =
      total < 50   ? 'low_key'  :
      total < 500  ? 'mid_key'  :
      'high_key';

    const promptFragment = this.buildPromptFragment(results, total, ratio, lighting_class);

    return {
      total_lux: Math.round(total * 10) / 10,
      lighting_ratio: Math.round(ratio * 10) / 10,
      lights: results,
      lighting_class,
      promptFragment,
    };
  }

  private buildPromptFragment(
    results: IlluminanceResult[],
    totalLux: number,
    ratio: number,
    lclass: SceneLightingDescriptor['lighting_class']
  ): string {
    const parts: string[] = [];

    // Overall class
    const classLabel = { low_key: 'low-key', mid_key: 'mid-key', high_key: 'high-key' }[lclass];
    parts.push(`${classLabel} lighting`);

    // Total illuminance character
    if (totalLux < 10)   parts.push('deep shadow, near darkness');
    else if (totalLux < 100)  parts.push('dim interior lighting');
    else if (totalLux < 1000) parts.push('moderate ambient illumination');
    else                      parts.push('bright outdoor illumination');

    // Lighting ratio
    if (ratio > 8) parts.push('extreme contrast, deep shadows on fill side');
    else if (ratio > 4) parts.push('dramatic side lighting, moderate shadow contrast');
    else if (ratio > 2) parts.push('moderate contrast, soft fill shadows');
    else parts.push('flat even lighting, minimal shadows');

    // Per-light descriptors (up to 3 strongest)
    const strongest = [...results]
      .sort((a, b) => b.illuminance_lux - a.illuminance_lux)
      .slice(0, 3);

    for (const r of strongest) {
      if (r.illuminance_lux < 0.1) continue;
      const light = this.lights.find(l => l.spec.name === r.light_name);
      if (!light) continue;
      const { colour_label, colour_temperature_K, shadow_type } = light.spec;
      parts.push(
        `${colour_label} ${r.incident_direction} light (${colour_temperature_K}K, ${shadow_type} shadows)`
      );
    }

    return parts.join(', ');
  }
}

// ---------------------------------------------------------------------------
// Colour temperature helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain-language colour description for a given colour temperature.
 */
export function colourTempToLabel(kelvin: ColourTemperature_K): string {
  if (kelvin < 2200) return 'deep amber candlelight';
  if (kelvin < 2800) return 'warm tungsten incandescent';
  if (kelvin < 3500) return 'warm white LED';
  if (kelvin < 4500) return 'neutral white';
  if (kelvin < 5500) return 'cool daylight';
  if (kelvin < 6500) return 'cloudy overcast daylight';
  return 'cool blue sky';
}

// ---------------------------------------------------------------------------
// Pre-built lighting rigs for canonical scenes
// ---------------------------------------------------------------------------

/**
 * PARKING_LOT_RIG
 *
 * Overcast parking lot: a dominant sodium streetlamp (key),
 * diffuse sky ambient (fill), and a faint garage fluorescent (rim).
 */
export const PARKING_LOT_RIG = new LightingRig('parking_lot', [
  {
    name:                 'streetlamp_01',
    role:                 'key',
    position:             { x: 0.2, y: 0.0, z: 0.5 }, // upper-left overhead
    intensity_cd:         3500,
    colour_temperature_K: 2100,
    colour_label:         'orange sodium vapour streetlamp',
    shadow_type:          'hard',
  },
  {
    name:                 'overcast_sky',
    role:                 'ambient',
    position:             { x: 0.5, y: 0.0, z: 0.5 }, // directly overhead
    intensity_cd:         800,
    colour_temperature_K: 6500,
    colour_label:         'cool grey overcast sky',
    shadow_type:          'soft',
  },
  {
    name:                 'garage_fluorescent',
    role:                 'rim',
    position:             { x: 0.9, y: 0.1, z: 0.0 }, // upper-right near
    intensity_cd:         400,
    colour_temperature_K: 4100,
    colour_label:         'cool white fluorescent spill',
    shadow_type:          'none',
  },
]);

/**
 * KITCHEN_RIG
 *
 * Warm morning kitchen: window sunlight (key), bounce fill from walls (fill),
 * and an overhead ceiling fixture (top).
 */
export const KITCHEN_RIG = new LightingRig('kitchen_morning', [
  {
    name:                 'window_sun',
    role:                 'key',
    position:             { x: 0.0, y: 0.3, z: 0.5 }, // left window
    intensity_cd:         8000,
    colour_temperature_K: 5600,
    colour_label:         'warm morning sunlight through window',
    shadow_type:          'hard',
  },
  {
    name:                 'wall_bounce',
    role:                 'fill',
    position:             { x: 1.0, y: 0.3, z: 0.5 }, // right wall bounce
    intensity_cd:         1200,
    colour_temperature_K: 4800,
    colour_label:         'warm cream wall bounce fill',
    shadow_type:          'soft',
  },
  {
    name:                 'ceiling_light',
    role:                 'ambient',
    position:             { x: 0.5, y: 0.0, z: 0.5 }, // directly overhead
    intensity_cd:         600,
    colour_temperature_K: 3000,
    colour_label:         'warm white ceiling fixture',
    shadow_type:          'soft',
  },
]);
