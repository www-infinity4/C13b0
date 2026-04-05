/**
 * Cartoon Prompt Engine — Physical Camera & Optical Depth
 *
 * Gaussian optics model for depth-of-field and circle-of-confusion (CoC)
 * calculations.  All math is grounded in thin-lens optics; no approximations
 * beyond those standard in cinema lens specifications.
 *
 * The outputs are:
 *   1. Numerical CoC / blur values for use in compositor depth passes.
 *   2. Prompt vocabulary that instructs AI generators to reproduce the
 *      correct photographic look (bokeh, soft focus, shallow DoF).
 *
 * Medical / scientific note:
 *   The depth-of-field mathematics here are identical to those used in
 *   confocal microscopy, where only a single Z-plane is in focus at any
 *   given time.  A confocal microscope "slices" a 3-D tissue sample by
 *   computing exactly the same CoC equations, then rejecting out-of-focus
 *   light with a pinhole.  Swapping the biological specimen for a scene
 *   Z-coordinate gives you the same optical depth behaviour.
 *
 * Usage:
 *   import { PhysicalCamera, CINEMA_PRESETS } from './optics';
 *
 *   const cam   = new PhysicalCamera(CINEMA_PRESETS.anamorphic_widescreen);
 *   const blur  = cam.blurIntensityAtZ(0.5, 0.2);  // subject at 0.5, target at 0.2
 *   const frag  = cam.promptFragment(blur);
 *   // → "cinematic bokeh, shallow depth of field, 2.8 aperture, anamorphic lens..."
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * CameraSpec — the physical parameters of a cinema camera + lens combination.
 *
 * All distances are in metres unless noted.
 * All sizes (sensor, aperture) are in millimetres where marked `_mm`.
 */
export interface CameraSpec {
  /** Lens focal length in millimetres (e.g. 50 for a "normal" lens). */
  focalLength_mm: number;
  /** Aperture (f-stop).  Lower = wider aperture = shallower DoF (e.g. 1.4, 2.8, 5.6). */
  aperture_fstop: number;
  /** Focus distance in metres — the Z depth that is perfectly sharp. */
  focusDistance_m: number;
  /** Sensor width in millimetres (35 mm full-frame = 36 mm; Super 35 = 24.89 mm). */
  sensorWidth_mm: number;
  /** Sensor height in millimetres (35 mm full-frame = 24 mm). */
  sensorHeight_mm: number;
  /**
   * Maximum acceptable circle of confusion in millimetres.
   * Convention: sensorDiagonal / 1500 (human perception limit at standard viewing distance).
   * Full-frame 35mm: ≈ 0.029 mm.
   */
  coc_limit_mm: number;
  /** Human-readable lens character description (e.g. "anamorphic 2.39:1"). */
  lens_character: string;
}

/** Result of a full depth-of-field calculation. */
export interface DepthOfFieldResult {
  /** Near focus limit in metres (objects closer than this are blurred). */
  near_m: number;
  /** Far focus limit in metres (objects farther than this are blurred). */
  far_m: number;
  /** Total DoF range in metres. Infinity when far_m is infinite. */
  total_m: number;
  /** Hyperfocal distance in metres. */
  hyperfocal_m: number;
  /** Whether the far limit extends to infinity. */
  far_is_infinity: boolean;
}

/** Result of a circle-of-confusion calculation for a specific subject distance. */
export interface CoCResult {
  /** CoC diameter in millimetres. */
  diameter_mm: number;
  /** Blur intensity normalised to [0, 1] against the CoC limit. */
  blur_intensity: number;
  /** Whether this subject distance is within the acceptable focus range. */
  in_focus: boolean;
}

// ---------------------------------------------------------------------------
// Pre-built camera presets
// ---------------------------------------------------------------------------

/**
 * CINEMA_PRESETS
 *
 * Named lens + sensor combinations matching real-world cinema camera packages.
 * Apertures are set to common production defaults for each format.
 */
export const CINEMA_PRESETS: Readonly<Record<string, CameraSpec>> = {

  /** 35mm full-frame, 50mm lens at f/2.0 — classic "normal" cinema look. */
  full_frame_50mm: {
    focalLength_mm:  50,
    aperture_fstop:  2.0,
    focusDistance_m: 3.0,
    sensorWidth_mm:  36.0,
    sensorHeight_mm: 24.0,
    coc_limit_mm:    0.029,
    lens_character:  '35mm full-frame, 50mm normal lens, f/2.0',
  },

  /** Anamorphic 2.39:1, 40mm at f/2.8 — cinematic widescreen with oval bokeh. */
  anamorphic_widescreen: {
    focalLength_mm:  40,
    aperture_fstop:  2.8,
    focusDistance_m: 4.0,
    sensorWidth_mm:  36.0,
    sensorHeight_mm: 15.1,
    coc_limit_mm:    0.025,
    lens_character:  'anamorphic 2.39:1, 40mm, f/2.8, oval bokeh, lens flare',
  },

  /** Super 35, 85mm portrait lens at f/1.4 — extremely shallow DoF. */
  super35_85mm_portrait: {
    focalLength_mm:  85,
    aperture_fstop:  1.4,
    focusDistance_m: 2.5,
    sensorWidth_mm:  24.89,
    sensorHeight_mm: 18.66,
    coc_limit_mm:    0.022,
    lens_character:  'Super 35, 85mm portrait lens, f/1.4, extreme bokeh',
  },

  /** Wide establishing shot — 24mm at f/8, deep DoF. */
  wide_establishing: {
    focalLength_mm:  24,
    aperture_fstop:  8.0,
    focusDistance_m: 6.0,
    sensorWidth_mm:  36.0,
    sensorHeight_mm: 24.0,
    coc_limit_mm:    0.029,
    lens_character:  '24mm wide angle, f/8, deep focus, sharp background',
  },

  /** Classic cartoon "flat" look — long telephoto, stopped down, everything sharp. */
  cartoon_flat: {
    focalLength_mm:  200,
    aperture_fstop:  11.0,
    focusDistance_m: 10.0,
    sensorWidth_mm:  36.0,
    sensorHeight_mm: 24.0,
    coc_limit_mm:    0.029,
    lens_character:  'telephoto 200mm, f/11, flat cartoon depth, no bokeh',
  },

} as const;

// ---------------------------------------------------------------------------
// PhysicalCamera
// ---------------------------------------------------------------------------

/**
 * PhysicalCamera
 *
 * Encapsulates a CameraSpec and provides thin-lens optics calculations for:
 *   - Hyperfocal distance
 *   - Depth of field (near / far limits)
 *   - Circle of Confusion at any subject distance
 *   - Blur intensity (0–1) for a given scene Z coordinate
 *   - Prompt fragment for AI generators
 *
 * All calculations use the standard thin-lens Gaussian optics formulae.
 * The Z coordinates from the engine's PhysicsMap3D are normalised (0 = near,
 * 1 = far).  Use `zToMetres()` to convert before calling optical functions.
 */
export class PhysicalCamera {
  readonly spec: CameraSpec;

  /** Focal length in metres (converted from mm). */
  private readonly f: number;
  /** Aperture diameter in metres. */
  private readonly D: number;
  /** Focus distance in metres. */
  private readonly ds: number;

  constructor(spec: CameraSpec) {
    this.spec = spec;
    this.f    = spec.focalLength_mm / 1000;
    this.D    = (spec.focalLength_mm / spec.aperture_fstop) / 1000;
    this.ds   = spec.focusDistance_m;
  }

  // ── Core optical calculations ─────────────────────────────────────────────

  /**
   * Hyperfocal distance in metres.
   *
   * H = f² / (N × c) + f
   * where f = focal length, N = f-stop, c = CoC limit.
   */
  get hyperfocalDistance_m(): number {
    const c = this.spec.coc_limit_mm / 1000;
    return (this.f * this.f) / (this.spec.aperture_fstop * c) + this.f;
  }

  /**
   * Full depth-of-field calculation.
   *
   * Near limit: Dn = ds × H / (H + ds)     (when ds < H)
   * Far limit:  Df = ds × H / (H − ds)     (when ds < H; ∞ when ds ≥ H)
   */
  depthOfField(): DepthOfFieldResult {
    const H  = this.hyperfocalDistance_m;
    const ds = this.ds;

    const near_m = (ds * H) / (H + ds);
    const far_is_infinity = ds >= H;
    const far_m  = far_is_infinity ? Infinity : (ds * H) / (H - ds);
    const total_m = far_is_infinity ? Infinity : far_m - near_m;

    return {
      near_m:          Math.round(near_m * 1000) / 1000,
      far_m:           far_is_infinity ? Infinity : Math.round(far_m * 1000) / 1000,
      total_m:         far_is_infinity ? Infinity : Math.round(total_m * 1000) / 1000,
      hyperfocal_m:    Math.round(H * 1000) / 1000,
      far_is_infinity,
    };
  }

  /**
   * Circle of Confusion at a given subject distance `d` in metres.
   *
   * CoC = |f² × (d − ds)| / (N × ds × (d − f))
   *
   * @param subjectDistance_m  Distance from lens to subject in metres.
   */
  circleOfConfusion(subjectDistance_m: number): CoCResult {
    const d  = Math.max(this.f * 1.001, subjectDistance_m); // must be > focal length
    const ds = this.ds;
    const f  = this.f;
    const N  = this.spec.aperture_fstop;
    const c  = this.spec.coc_limit_mm / 1000;

    const denominator = N * ds * (d - f);
    if (denominator === 0) {
      return { diameter_mm: 0, blur_intensity: 0, in_focus: true };
    }

    const coc_m      = Math.abs((f * f * (d - ds)) / denominator);
    const diameter_mm = coc_m * 1000;
    const blur_intensity = Math.min(1, diameter_mm / (this.spec.coc_limit_mm * 10));
    const in_focus   = diameter_mm <= this.spec.coc_limit_mm;

    return {
      diameter_mm:   Math.round(diameter_mm * 10000) / 10000,
      blur_intensity: Math.round(blur_intensity * 1000) / 1000,
      in_focus,
    };
  }

  // ── Engine Z-coordinate integration ──────────────────────────────────────

  /**
   * Convert a normalised engine Z coordinate (0 = near, 1 = far) to metres.
   *
   * The near/far range defaults to [0.5 m, 20 m] — typical room/street scene.
   * Override with the scene's actual near/far bounds if available.
   */
  zToMetres(z: number, nearPlane_m = 0.5, farPlane_m = 20.0): number {
    return nearPlane_m + z * (farPlane_m - nearPlane_m);
  }

  /**
   * Blur intensity for a scene object at normalised Z depth `targetZ`,
   * when the subject of focus is at normalised Z `subjectZ`.
   *
   * Returns 0.0 (perfectly sharp) to 1.0 (maximally blurred).
   *
   * @param subjectZ   The Z depth of the subject that is in focus (0–1).
   * @param targetZ    The Z depth of the object to blur-test (0–1).
   * @param nearPlane_m  World-space near plane in metres. Default 0.5.
   * @param farPlane_m   World-space far plane in metres. Default 20.0.
   */
  blurIntensityAtZ(
    subjectZ: number,
    targetZ: number,
    nearPlane_m = 0.5,
    farPlane_m  = 20.0
  ): number {
    const targetDist = this.zToMetres(targetZ, nearPlane_m, farPlane_m);
    // Temporarily adjust focus distance to subjectZ for this calculation
    const subjectDist = this.zToMetres(subjectZ, nearPlane_m, farPlane_m);
    const savedDs = this.spec.focusDistance_m;

    // Create a temporary camera focused on the subject
    const tempCam = new PhysicalCamera({ ...this.spec, focusDistance_m: subjectDist });
    const result  = tempCam.circleOfConfusion(targetDist);

    void savedDs; // not mutated — just documents the intent
    return result.blur_intensity;
  }

  // ── Prompt vocabulary ─────────────────────────────────────────────────────

  /**
   * Returns a prompt fragment describing the photographic look of this camera
   * at the given blur intensity (from blurIntensityAtZ).
   *
   * @param blurIntensity  0.0 (in focus) to 1.0 (maximum bokeh).
   */
  promptFragment(blurIntensity: number): string {
    const aperture = `f/${this.spec.aperture_fstop}`;
    const focal    = `${this.spec.focalLength_mm}mm`;
    const lens     = this.spec.lens_character;

    if (blurIntensity < 0.05) {
      return `${focal} lens at ${aperture}, deep focus, sharp background, ${lens}`;
    }
    if (blurIntensity < 0.25) {
      return `${focal} lens at ${aperture}, subtle background separation, gentle bokeh, ${lens}`;
    }
    if (blurIntensity < 0.55) {
      return `cinematic bokeh, ${focal} at ${aperture}, clear subject separation, creamy background blur, ${lens}`;
    }
    if (blurIntensity < 0.80) {
      return `shallow depth of field, ${focal} at ${aperture}, strong bokeh, background dissolved to colour wash, ${lens}`;
    }
    return `extreme shallow focus, ${focal} at ${aperture}, maximum bokeh, subject razor-sharp against completely blurred background, ${lens}`;
  }

  /**
   * Full prompt fragment combining lens character and depth-of-field description
   * for both the foreground subject and a background object at a given Z.
   *
   * @param subjectZ    Normalised Z of the in-focus subject.
   * @param backgroundZ Normalised Z of the background element to describe.
   */
  scenePromptFragment(subjectZ: number, backgroundZ = 0.8): string {
    const bgBlur = this.blurIntensityAtZ(subjectZ, backgroundZ);
    return this.promptFragment(bgBlur);
  }
}
