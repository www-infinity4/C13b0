/**
 * Cartoon Prompt Engine — Color Grading Factory
 *
 * Prompt-vocabulary LUTs (Look-Up Tables) for cinematic color grading styles.
 *
 * Since this engine produces text prompts — not rendered pixels — every
 * "color grade" here is a set of precise prompt descriptors that instruct
 * downstream image generators (ComfyUI, Kling, Runway) to apply the
 * corresponding photographic look.  The descriptors are drawn from real
 * cinematography vocabulary recognised by diffusion models.
 *
 * Includes:
 *   COLOR_GRADE_PRESETS  — named LUT-style descriptor sets (Technicolor,
 *                          Modern Noir, Dolby Vision HDR, etc.)
 *   LightWrap            — bleeds background colour onto character edges
 *   PerlinNoise          — deterministic 2-D Perlin noise (film grain math)
 *   FilmGrainOverlay     — grain intensity → prompt descriptor
 *   MaterialDescriptor   — surface material properties for characters
 *
 * Usage:
 *   import { ColorGradingFactory } from './color-grading';
 *
 *   const factory = new ColorGradingFactory('classic_technicolor');
 *   const prompt  = factory.appendToPrompt('Investor Gadget in parking lot');
 *   // → "Investor Gadget in parking lot, classic Technicolor 3-strip look,
 *   //    vibrant saturated reds and teals, warm golden highlights with glowing
 *   //    specular detail, rich deep shadows with retained colour…"
 */

// ---------------------------------------------------------------------------
// Color grade presets (LUT vocabulary tables)
// ---------------------------------------------------------------------------

/** Identifier for a built-in color grade preset. */
export type ColorGradeId =
  | 'classic_technicolor'
  | 'modern_noir'
  | 'dolby_vision_hdr'
  | 'golden_hour_warm'
  | 'cool_digital_clean'
  | 'desaturated_gritty';

/** A color grading descriptor set — the "LUT" expressed as prompt vocabulary. */
export interface ColorGradePreset {
  id: ColorGradeId;
  name: string;
  /** One-line description of the visual look. */
  description: string;
  /** Primary colour palette in plain language. */
  palette: string;
  /** Highlight treatment. */
  highlights: string;
  /** Shadow treatment. */
  shadows: string;
  /** Saturation character. */
  saturation: string;
  /** Contrast character. */
  contrast: string;
  /** Skin / character material response. */
  skin_tone: string;
  /** Overall prompt fragment — the canonical append string. */
  promptFragment: string;
}

/**
 * COLOR_GRADE_PRESETS
 *
 * Six cinematic color grades expressed as prompt vocabulary.
 * Each maps to a real-world photochemical or digital grading tradition.
 */
export const COLOR_GRADE_PRESETS: Readonly<Record<ColorGradeId, ColorGradePreset>> = {

  classic_technicolor: {
    id:          'classic_technicolor',
    name:        'Classic Technicolor 3-Strip',
    description: 'Golden-age Hollywood saturation: vibrant reds, deep teals, warm ivory skin.',
    palette:     'vibrant reds and teals, warm ivory, golden amber',
    highlights:  'warm golden highlights with glowing specular detail',
    shadows:     'rich deep shadows with retained colour saturation',
    saturation:  'heavily saturated, vivid primaries',
    contrast:    'high contrast with luminous midtones',
    skin_tone:   'warm ivory with rosy blush undertones',
    promptFragment: [
      'classic Technicolor 3-strip look',
      'vibrant saturated reds and teals',
      'warm golden highlights with glowing specular detail',
      'rich deep shadows with retained colour',
      'luminous midtones, high contrast',
      'warm ivory skin with rosy blush',
      '1940s Hollywood colour grade',
    ].join(', '),
  },

  modern_noir: {
    id:          'modern_noir',
    name:        'Modern Noir',
    description: 'Desaturated and cold with isolated colour accents — neon on dark concrete.',
    palette:     'near-monochrome dark greys, isolated cool blues, single warm accent',
    highlights:  'blown-out whites with cool blue fringe',
    shadows:     'near-black with crushed blacks, no fill',
    saturation:  'heavily desaturated overall, selective colour preservation',
    contrast:    'extreme contrast, deep blacks',
    skin_tone:   'pale grey-blue, low saturation',
    promptFragment: [
      'modern noir color grade',
      'near-monochrome desaturated palette',
      'deep crushed blacks, blown-out cool whites',
      'selective colour — single warm accent against cold grey',
      'extreme contrast, cinematic noir atmosphere',
      'pale grey-blue skin tones',
    ].join(', '),
  },

  dolby_vision_hdr: {
    id:          'dolby_vision_hdr',
    name:        'Dolby Vision HDR',
    description: 'Wide colour gamut, 10-bit look: specular highlights glow, deep luminous shadows.',
    palette:     'extended colour gamut, BT.2020, vivid yet naturalistic',
    highlights:  'specular highlights bloom and glow — metallic surfaces sparkle',
    shadows:     'deep rich shadows with visible detail and colour gradation',
    saturation:  'naturalistic but extended gamut — colours beyond sRGB range',
    contrast:    'high dynamic range, full tonal scale from black to peak white',
    skin_tone:   'accurate warm skin with subsurface light scatter in highlights',
    promptFragment: [
      'Dolby Vision HDR look',
      'wide colour gamut BT.2020',
      'specular highlights bloom with metallic sparkle',
      'deep luminous shadows with colour gradation',
      'high dynamic range full tonal scale',
      'naturalistic extended gamut colours',
      'subsurface light scatter on skin in highlight areas',
    ].join(', '),
  },

  golden_hour_warm: {
    id:          'golden_hour_warm',
    name:        'Golden Hour Warm',
    description: 'Sunset-lit warmth: amber and orange highlights, long warm shadows.',
    palette:     'amber, burnt orange, warm honey, long blue-purple shadows',
    highlights:  'amber-orange backlit glow, rim lighting from warm sun',
    shadows:     'long blue-purple cool shadows contrasting warm light',
    saturation:  'moderately saturated warm tones, cool shadows less saturated',
    contrast:    'medium contrast, soft gradients',
    skin_tone:   'golden tan, warm sun-kissed glow',
    promptFragment: [
      'golden hour warm color grade',
      'amber and burnt orange highlights',
      'warm backlit sun glow with rim lighting',
      'long cool blue-purple shadows',
      'sun-kissed golden skin tones',
      'soft medium contrast',
    ].join(', '),
  },

  cool_digital_clean: {
    id:          'cool_digital_clean',
    name:        'Cool Digital Clean',
    description: 'Modern broadcast neutral: flat, clean, accurate — no stylistic push.',
    palette:     'neutral colour accurate, cool whites, balanced greys',
    highlights:  'clean neutral white highlights, no colour shift',
    shadows:     'open neutral shadows, lifted blacks',
    saturation:  'natural, unexaggerated saturation',
    contrast:    'low-medium contrast, bright midtones',
    skin_tone:   'natural neutral, colour accurate',
    promptFragment: [
      'clean neutral digital color grade',
      'broadcast accurate colour',
      'cool neutral whites',
      'open shadows lifted blacks',
      'flat even lighting, natural skin tones',
    ].join(', '),
  },

  desaturated_gritty: {
    id:          'desaturated_gritty',
    name:        'Desaturated Gritty Realism',
    description: 'Documentary / war-film aesthetic: muted tones, visible grain, harsh reality.',
    palette:     'muted desaturated tones, olive greens, dirty yellows',
    highlights:  'harsh blown highlights with grain',
    shadows:     'dark muddy shadows with colour shift toward green',
    saturation:  'strongly desaturated, washed-out',
    contrast:    'medium-high contrast, mid-tone compression',
    skin_tone:   'sallow, slightly green-yellow, unhealthy',
    promptFragment: [
      'desaturated gritty realism color grade',
      'muted olive-green and dirty-yellow tones',
      'harsh blown highlights',
      'dark muddy green-shifted shadows',
      'documentary film aesthetic, washed-out palette',
      'sallow skin tones',
    ].join(', '),
  },

} as const;

// ---------------------------------------------------------------------------
// Light Wrap descriptor
// ---------------------------------------------------------------------------

/**
 * LightWrap
 *
 * Calculates a "light wrap" prompt descriptor — the visual phenomenon where
 * background colours bleed onto character edges, compositing them into
 * the scene so they don't look like cut-out stickers.
 *
 * Used in post-production compositing (After Effects, Nuke, DaVinci).
 * Here, it generates the vocabulary to request this look from AI generators.
 */
export interface LightWrapOptions {
  /** Background colour description (e.g. "warm grey concrete"). */
  background_colour: string;
  /** Wrap intensity: 0.0 (none) to 1.0 (heavy). Default 0.4. */
  intensity?: number;
  /** Spread in normalised units (0.0–0.2). Default 0.08. */
  spread?: number;
}

export interface LightWrapDescriptor {
  intensity: number;
  spread: number;
  /** Ready-to-append prompt fragment. */
  promptFragment: string;
}

/**
 * computeLightWrap
 *
 * Computes a light wrap descriptor from background colour and intensity.
 *
 * @param options  Background colour and wrap strength settings.
 * @returns        LightWrapDescriptor with a prompt fragment.
 */
export function computeLightWrap(options: LightWrapOptions): LightWrapDescriptor {
  const intensity = Math.max(0, Math.min(1, options.intensity ?? 0.4));
  const spread    = Math.max(0, Math.min(0.2, options.spread ?? 0.08));

  const intensityLabel =
    intensity < 0.2 ? 'subtle'  :
    intensity < 0.5 ? 'gentle'  :
    intensity < 0.75 ? 'strong' :
    'heavy';

  const promptFragment = [
    `${intensityLabel} light wrap from ${options.background_colour} background`,
    `${options.background_colour} colour bleeding onto character edges`,
    'background-foreground colour integration, composited look',
  ].join(', ');

  return { intensity, spread, promptFragment };
}

// ---------------------------------------------------------------------------
// Perlin noise (pure deterministic math)
// ---------------------------------------------------------------------------

/**
 * PerlinNoise
 *
 * Classical 2-D Perlin noise implementation.
 * Used by FilmGrainOverlay to produce organic, non-repeating grain values.
 *
 * All computation is pure and deterministic for a given seed.
 * No randomness — the same (x, y, seed) always returns the same value.
 *
 * Returns values in the range [−1, +1].
 */
export class PerlinNoise {
  private readonly perm: Uint8Array;

  /**
   * @param seed  Integer seed (0–65535). Same seed → same noise field.
   */
  constructor(seed = 0) {
    this.perm = this.buildPermutation(seed);
  }

  private buildPermutation(seed: number): Uint8Array {
    const p = new Uint8Array(512);
    // Fill 0..255, then shuffle with a seeded LCG
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = (seed ^ 0xDEADBEEF) >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    // Double for wrapping
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    return p;
  }

  private fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
  private lerp(a: number, b: number, t: number): number { return a + t * (b - a); }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  /**
   * Returns the Perlin noise value at (x, y) in range [−1, +1].
   */
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u  = this.fade(xf);
    const v  = this.fade(yf);
    const p  = this.perm;

    const n00 = this.grad(p[p[X]     + Y],     xf,     yf);
    const n10 = this.grad(p[p[X + 1] + Y],     xf - 1, yf);
    const n01 = this.grad(p[p[X]     + Y + 1], xf,     yf - 1);
    const n11 = this.grad(p[p[X + 1] + Y + 1], xf - 1, yf - 1);

    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), v);
  }

  /**
   * Returns a normalised [0, 1] noise value — convenient for intensity maps.
   */
  normalised(x: number, y: number): number {
    return (this.noise(x, y) + 1) / 2;
  }
}

// ---------------------------------------------------------------------------
// Film Grain Overlay
// ---------------------------------------------------------------------------

export type GrainIntensity = 'none' | 'fine' | 'medium' | 'heavy' | 'extreme';

export interface FilmGrainOptions {
  /** Grain strength: 0.0 (none) to 1.0 (extreme). */
  strength?: number;
  /** Grain scale / frequency (larger = coarser grain). Default 1.0. */
  scale?: number;
  /** Perlin noise seed for a consistent grain pattern per tile. Default 42. */
  seed?: number;
}

export interface FilmGrainDescriptor {
  intensity: GrainIntensity;
  strength: number;
  /** Prompt fragment describing the grain look. */
  promptFragment: string;
  /**
   * A 4×4 sample grid of normalised grain values (0–1) at the given seed.
   * Useful for visualising the grain pattern or driving downstream compositors.
   */
  sampleGrid: readonly number[][];
}

/**
 * FilmGrainOverlay
 *
 * Converts a grain strength value to a prompt descriptor and a sample
 * noise grid.  The Perlin noise seed is tied to the tile ID so every
 * frame in a tile gets the same consistent grain character.
 */
export class FilmGrainOverlay {
  private readonly perlin: PerlinNoise;
  private readonly strength: number;
  private readonly scale: number;

  constructor(options: FilmGrainOptions = {}) {
    this.strength = Math.max(0, Math.min(1, options.strength ?? 0.3));
    this.scale    = Math.max(0.1, options.scale ?? 1.0);
    this.perlin   = new PerlinNoise(options.seed ?? 42);
  }

  private classifyIntensity(strength: number): GrainIntensity {
    if (strength < 0.05) return 'none';
    if (strength < 0.25) return 'fine';
    if (strength < 0.55) return 'medium';
    if (strength < 0.80) return 'heavy';
    return 'extreme';
  }

  /** Computes a 4×4 sample grid of grain values for preview. */
  private sampleGrid(): number[][] {
    const grid: number[][] = [];
    for (let row = 0; row < 4; row++) {
      const rowArr: number[] = [];
      for (let col = 0; col < 4; col++) {
        const val = this.perlin.normalised(col * this.scale, row * this.scale);
        rowArr.push(Math.round(val * 1000) / 1000);
      }
      grid.push(rowArr);
    }
    return grid;
  }

  /** Build the full FilmGrainDescriptor. */
  describe(): FilmGrainDescriptor {
    const intensity = this.classifyIntensity(this.strength);

    const PROMPTS: Record<GrainIntensity, string> = {
      none:    '',
      fine:    'subtle organic film grain, fine 35mm texture, slight photochemical noise',
      medium:  'medium film grain, 35mm organic texture, visible photochemical noise, analogue warmth',
      heavy:   'heavy film grain, pushed 35mm stock, pronounced organic noise, high-speed film texture',
      extreme: 'extreme grain, over-pushed film stock, raw documentary texture, aggressive photochemical noise',
    };

    return {
      intensity,
      strength: this.strength,
      promptFragment: PROMPTS[intensity],
      sampleGrid: this.sampleGrid(),
    };
  }
}

// ---------------------------------------------------------------------------
// Material Descriptor (subsurface scattering / surface physics)
// ---------------------------------------------------------------------------

export type MaterialType =
  | 'cartoon_cel'          // flat 2-tone shading — no SSS
  | 'soft_plastic'         // mild SSS, glossy highlights
  | 'skin_warm'            // strong SSS — Dreamy Disney look
  | 'metallic_chrome'      // specular, no SSS, environment reflections
  | 'fabric_matte'         // rough surface, no specular, subtle SSS
  | 'fur_translucent';     // strong SSS at edges, scattered backlight

/**
 * MaterialDescriptor — surface material properties expressed as prompt vocabulary.
 *
 * For a cartoon engine, these translate directly into rendering hints:
 *   skin_warm → "soft subsurface light scatter, warm inner glow on skin"
 *   metallic_chrome → "hard specular highlights, chrome reflections, environment map"
 */
export interface MaterialDescriptor {
  material_type: MaterialType;
  /** Whether subsurface scattering is active for this material. */
  has_sss: boolean;
  /** SSS intensity 0.0–1.0 (0 = opaque surface, 1 = highly translucent). */
  sss_intensity: number;
  /** Specular intensity 0.0–1.0 (0 = matte, 1 = mirror). */
  specular_intensity: number;
  /** Prompt fragment for this surface. */
  promptFragment: string;
}

/** Pre-built material descriptors keyed by MaterialType. */
export const MATERIAL_DESCRIPTORS: Readonly<Record<MaterialType, MaterialDescriptor>> = {

  cartoon_cel: {
    material_type:      'cartoon_cel',
    has_sss:            false,
    sss_intensity:      0,
    specular_intensity: 0.1,
    promptFragment:     'clean cel-shaded surface, flat 2-tone shading, black outline, no subsurface scattering',
  },

  soft_plastic: {
    material_type:      'soft_plastic',
    has_sss:            true,
    sss_intensity:      0.25,
    specular_intensity: 0.6,
    promptFragment:     'soft plastic surface, mild subsurface light scatter, glossy specular highlights, rounded soft edges',
  },

  skin_warm: {
    material_type:      'skin_warm',
    has_sss:            true,
    sss_intensity:      0.75,
    specular_intensity: 0.15,
    promptFragment:     'warm skin with strong subsurface light scattering, Dreamy Disney inner glow, soft translucent highlights, warm peach inner light on ears and fingertips',
  },

  metallic_chrome: {
    material_type:      'metallic_chrome',
    has_sss:            false,
    sss_intensity:      0,
    specular_intensity: 1.0,
    promptFragment:     'chrome metallic surface, hard specular highlights, mirror environment reflections, Dolby Vision specular bloom on edges',
  },

  fabric_matte: {
    material_type:      'fabric_matte',
    has_sss:            true,
    sss_intensity:      0.15,
    specular_intensity: 0.05,
    promptFragment:     'matte fabric surface, subtle weave texture, very soft subsurface light at thin edges, no specular highlights',
  },

  fur_translucent: {
    material_type:      'fur_translucent',
    has_sss:            true,
    sss_intensity:      0.85,
    specular_intensity: 0.1,
    promptFragment:     'translucent fur, strong subsurface backlight scatter, warm inner glow at fur edges, individual strand rimlight, Pixar-style fur translucency',
  },

} as const;

// ---------------------------------------------------------------------------
// ColorGradingFactory — the main facade
// ---------------------------------------------------------------------------

/**
 * ColorGradingFactory
 *
 * Combines a color grade preset, optional light wrap, and optional film grain
 * into a single appendable prompt fragment for a shot.
 *
 * Instantiate once per scene segment and reuse across all shots.
 */
export class ColorGradingFactory {
  private readonly preset: ColorGradePreset;
  private readonly grainOverlay: FilmGrainOverlay | null;
  private readonly lightWrap: LightWrapDescriptor | null;

  constructor(
    gradeId: ColorGradeId,
    options: {
      grain?: FilmGrainOptions;
      lightWrap?: LightWrapOptions;
    } = {}
  ) {
    this.preset      = COLOR_GRADE_PRESETS[gradeId];
    this.grainOverlay = options.grain    ? new FilmGrainOverlay(options.grain)       : null;
    this.lightWrap    = options.lightWrap ? computeLightWrap(options.lightWrap) : null;
  }

  /** The active color grade preset. */
  get colorGrade(): ColorGradePreset {
    return this.preset;
  }

  /**
   * Returns the full combined prompt fragment:
   * color grade + optional grain + optional light wrap.
   */
  promptFragment(): string {
    const parts: string[] = [this.preset.promptFragment];
    if (this.grainOverlay) {
      const grain = this.grainOverlay.describe();
      if (grain.promptFragment) parts.push(grain.promptFragment);
    }
    if (this.lightWrap?.promptFragment) {
      parts.push(this.lightWrap.promptFragment);
    }
    return parts.join(', ');
  }

  /**
   * Appends the full color grading descriptor to a base prompt string.
   *
   * @param basePrompt  The shot-specific prompt.
   * @returns           Enhanced prompt with color grading appended.
   */
  appendToPrompt(basePrompt: string): string {
    return `${basePrompt}, ${this.promptFragment()}`;
  }
}
