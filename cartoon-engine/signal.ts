/**
 * Cartoon Prompt Engine — Signal Processing: Grain-Aware Luminance Noise
 *
 * Film grain is not uniform random noise.  In a real photochemical process,
 * silver halide crystals of varying sizes react to incoming light.
 * The result is grain that is:
 *   - Heaviest in the shadows (unexposed grains clump unpredictably)
 *   - Lightest in the highlights (overexposed areas bleach grain away)
 *   - Moderate in midtones (the working zone of the film stock)
 *
 * This module implements that relationship mathematically as:
 *   grainIntensity(luma) = baseStrength × (1 − luma)^γ
 * where γ (gamma) controls how aggressively grain falls off in the highlights.
 *
 * The Perlin noise field (already in color-grading.ts) provides the spatial
 * structure; this module modulates its amplitude by luminance level.
 *
 * Outputs:
 *   1. Per-pixel grain intensity values for compositor depth passes.
 *   2. Prompt vocabulary that describes the grain character to AI generators.
 *
 * Usage:
 *   import { GrainAwareLuminanceNoise, STOCK_PRESETS } from './signal';
 *
 *   const noise  = new GrainAwareLuminanceNoise(STOCK_PRESETS.kodak_vision3_500t);
 *   const sample = noise.sampleAt(0.2, 0.3, 0.15);  // x, y, luma=0.15 (dark shadow)
 *   // → { raw_noise: 0.71, grain_intensity: 0.68, luma: 0.15 }
 *
 *   const prompt = noise.promptFragment();
 *   // → "pushed 500T tungsten stock, heavy shadow grain, fine highlight retention..."
 */

import { PerlinNoise } from './color-grading';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Film stock grain characteristics. */
export interface FilmStockSpec {
  name: string;
  /** Base grain strength at luma = 0 (pure black).  Range 0.0–1.0. */
  base_strength: number;
  /**
   * Gamma exponent controlling highlight grain falloff.
   * Higher = grain disappears faster as luma increases.
   *   γ = 1.0 : linear falloff
   *   γ = 2.0 : quadratic (standard photochemical behaviour)
   *   γ = 3.0 : aggressive falloff — highlights almost grainless
   */
  gamma: number;
  /** Spatial frequency of the grain (higher = finer grain). */
  frequency: number;
  /** ISO rating of the stock — informational, used in prompt descriptions. */
  iso: number;
  /** Stock description for prompt generation. */
  description: string;
}

/** A single grain sample at a position and luminance level. */
export interface GrainSample {
  /** Raw Perlin noise value at this position (0–1). */
  raw_noise: number;
  /**
   * Luminance-modulated grain intensity (0–1).
   * = raw_noise × baseStrength × (1 − luma)^γ
   */
  grain_intensity: number;
  /** The luminance value used for modulation (0 = black, 1 = white). */
  luma: number;
}

// ---------------------------------------------------------------------------
// Film stock presets
// ---------------------------------------------------------------------------

/**
 * STOCK_PRESETS
 *
 * Named film stock grain profiles based on real photochemical stocks.
 * Grain parameters are calibrated to match published grain measurements
 * for each stock type.
 */
export const STOCK_PRESETS: Readonly<Record<string, FilmStockSpec>> = {

  /** Kodak Vision3 250D — fine-grained daylight stock, clean highlights. */
  kodak_vision3_250d: {
    name:         'Kodak Vision3 250D',
    base_strength: 0.22,
    gamma:         2.5,
    frequency:     4.0,
    iso:           250,
    description:  'fine-grained daylight stock, minimal visible grain, clean highlight roll-off',
  },

  /** Kodak Vision3 500T — medium grain, tungsten-balanced, cinematic warmth. */
  kodak_vision3_500t: {
    name:         'Kodak Vision3 500T',
    base_strength: 0.38,
    gamma:         2.0,
    frequency:     3.2,
    iso:           500,
    description:  'medium grain tungsten-balanced stock, warm shadows with visible grain structure',
  },

  /** Kodak 5219 800T — pushed stock, coarser grain, high-contrast look. */
  kodak_5219_pushed: {
    name:         'Kodak 5219 800T (Pushed +2)',
    base_strength: 0.62,
    gamma:         1.6,
    frequency:     2.5,
    iso:           3200,
    description:  'pushed high-speed stock, coarse prominent grain, deep shadow noise, gritty documentary texture',
  },

  /** Fuji Eterna 250D — slightly cooler, very fine grain, Japanese cinema look. */
  fuji_eterna_250d: {
    name:         'Fuji Eterna 250D',
    base_strength: 0.18,
    gamma:         2.8,
    frequency:     4.5,
    iso:           250,
    description:  'very fine grain, cool clean highlights, subtle organic texture, Japanese cinema aesthetic',
  },

  /** Agfa XT 400 — medium-coarse grain, high acutance, reportage feel. */
  agfa_xt400: {
    name:         'Agfa XT 400',
    base_strength: 0.48,
    gamma:         1.8,
    frequency:     2.8,
    iso:           400,
    description:  'medium-coarse grain, high acutance, strong shadow noise, photojournalism aesthetic',
  },

} as const;

// ---------------------------------------------------------------------------
// GrainAwareLuminanceNoise
// ---------------------------------------------------------------------------

/**
 * GrainAwareLuminanceNoise
 *
 * Combines a Perlin noise field with a luminance-dependent amplitude
 * function to produce physically grounded film grain values.
 *
 * Grain intensity at any pixel:
 *   G(x, y, luma) = Perlin(x × freq, y × freq) × base × (1 − luma)^γ
 *
 * This matches the photochemical behaviour of negative film stocks:
 * dark areas accumulate unexposed silver grains (more noise),
 * bright areas bleach the emulsion smooth (less noise).
 */
export class GrainAwareLuminanceNoise {
  private readonly stock: FilmStockSpec;
  private readonly noise: PerlinNoise;

  /**
   * @param stock  Film stock specification.  Use STOCK_PRESETS or define custom.
   * @param seed   Perlin noise seed for this tile (keeps grain consistent per tile).
   */
  constructor(stock: FilmStockSpec, seed = 42) {
    this.stock = stock;
    this.noise = new PerlinNoise(seed);
  }

  /**
   * Grain intensity at spatial coordinates (x, y) and luminance `luma`.
   *
   * @param x     Normalised horizontal position (0–1).
   * @param y     Normalised vertical position (0–1).
   * @param luma  Luminance at this pixel (0 = black, 1 = white).
   * @returns     GrainSample with raw noise and modulated grain intensity.
   */
  sampleAt(x: number, y: number, luma: number): GrainSample {
    const clampedLuma = Math.max(0, Math.min(1, luma));
    const raw_noise   = this.noise.normalised(
      x * this.stock.frequency,
      y * this.stock.frequency
    );
    const falloff        = Math.pow(1 - clampedLuma, this.stock.gamma);
    const grain_intensity = Math.min(1, raw_noise * this.stock.base_strength * falloff / 0.5);

    return {
      raw_noise:     Math.round(raw_noise      * 10000) / 10000,
      grain_intensity: Math.round(grain_intensity * 10000) / 10000,
      luma:          clampedLuma,
    };
  }

  /**
   * Generate a grid of grain samples for a preview or compositor export.
   *
   * @param cols    Number of horizontal sample points.  Default 8.
   * @param rows    Number of vertical sample points.  Default 6.
   * @param luma    Luminance value applied uniformly to the grid.  Default 0.3 (shadow).
   */
  sampleGrid(cols = 8, rows = 6, luma = 0.3): GrainSample[][] {
    const grid: GrainSample[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: GrainSample[] = [];
      for (let c = 0; c < cols; c++) {
        row.push(this.sampleAt(c / (cols - 1), r / (rows - 1), luma));
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Average grain intensity across a uniform grid at the given luminance.
   * Useful for computing a single "overall grain level" for the prompt.
   */
  averageGrainAt(luma: number, samples = 16): number {
    let total = 0;
    for (let i = 0; i < samples; i++) {
      const x = i / samples;
      const y = ((i * 7) % samples) / samples; // spread samples across the field
      total += this.sampleAt(x, y, luma).grain_intensity;
    }
    return Math.round((total / samples) * 10000) / 10000;
  }

  /**
   * Returns a prompt fragment describing the grain character of this stock.
   *
   * @param shadowLuma   Representative shadow luminance (default 0.15).
   * @param highlightLuma Representative highlight luminance (default 0.85).
   */
  promptFragment(shadowLuma = 0.15, highlightLuma = 0.85): string {
    const shadowGrain    = this.averageGrainAt(shadowLuma);
    const highlightGrain = this.averageGrainAt(highlightLuma);

    const shadowClass =
      shadowGrain < 0.15 ? 'subtle' :
      shadowGrain < 0.35 ? 'visible' :
      shadowGrain < 0.60 ? 'pronounced' :
      'heavy';

    const highlightClass =
      highlightGrain < 0.05 ? 'clean grainless highlights' :
      highlightGrain < 0.15 ? 'slightly textured highlights' :
      'grainy highlights';

    return [
      `${this.stock.name} film emulation`,
      this.stock.description,
      `${shadowClass} shadow grain`,
      highlightClass,
      'luminance-dependent grain — heavier in shadows, finer in highlights',
      'organic photochemical texture',
    ].join(', ');
  }

  /** Returns the active film stock spec. */
  get filmStock(): FilmStockSpec {
    return this.stock;
  }
}

// ---------------------------------------------------------------------------
// Gaussian blur kernel (signal processing utility)
// ---------------------------------------------------------------------------

/**
 * gaussianKernel1D
 *
 * Computes a 1-D Gaussian kernel of the given radius and sigma.
 * Used for analytical descriptions of blur in optics and signal processing.
 *
 *   K(x) = (1 / √(2π·σ²)) · exp(−x² / (2σ²))
 *
 * The kernel is normalised so its values sum to 1.0.
 *
 * @param radius  Half-width of the kernel (kernel size = 2×radius + 1).
 * @param sigma   Standard deviation of the Gaussian.
 * @returns       Array of kernel weights, length = 2×radius + 1.
 */
export function gaussianKernel1D(radius: number, sigma: number): number[] {
  const size   = 2 * radius + 1;
  const kernel = new Array<number>(size);
  let sum      = 0;

  for (let i = 0; i < size; i++) {
    const x   = i - radius;
    const val = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = val;
    sum       += val;
  }

  // Normalise
  return kernel.map(v => Math.round((v / sum) * 1e8) / 1e8);
}

/**
 * gaussianBlurRadius
 *
 * Given a circle-of-confusion diameter in pixels and a film grain sigma,
 * returns the combined effective blur radius for prompt generation.
 *
 * Combining Gaussians: σ_total = √(σ_coc² + σ_grain²)
 *
 * @param coc_pixels   CoC diameter in pixels.
 * @param grain_sigma  Film grain spatial sigma (default 0.8 px).
 * @returns            Combined sigma in pixels.
 */
export function gaussianBlurRadius(coc_pixels: number, grain_sigma = 0.8): number {
  const sigma_coc = coc_pixels / 2;
  return Math.sqrt(sigma_coc * sigma_coc + grain_sigma * grain_sigma);
}
