export type PhiCapability = {
  id: string;
  repo: string;
  role: string;
  modes: string[];
  runtime: "browser" | "service" | "build" | "indexed";
};

/**
 * These are the fifteen forked media / vision / 3D capabilities selected for
 * Phi website production. C13b0 indexes and routes to them; it does not bundle
 * heavyweight Python/GPU projects into the GitHub Pages browser build.
 *
 * Puck is kept separately as the local browser composition layer, so the full
 * lattice contains the 15 forked production tools plus the local composer.
 */
export const PHI_FORKED_PRODUCTION_CAPABILITIES: PhiCapability[] = [
  { id: "comfyui", repo: "www-infinity4/ComfyUI", role: "node-graph orchestration", modes: ["image", "video", "audio", "3d", "workflow"], runtime: "service" },
  { id: "diffusers", repo: "www-infinity4/diffusers", role: "generative media pipelines", modes: ["image", "video", "audio"], runtime: "service" },
  { id: "flux", repo: "www-infinity4/flux", role: "high-quality image generation", modes: ["image", "hero", "illustration"], runtime: "service" },
  { id: "sam", repo: "www-infinity4/segment-anything", role: "image segmentation", modes: ["mask", "cutout", "layout-analysis", "segment"], runtime: "service" },
  { id: "opencv", repo: "www-infinity4/opencv", role: "image analysis and transforms", modes: ["image-analysis", "crop", "quality", "geometry"], runtime: "service" },
  { id: "paddleocr", repo: "www-infinity4/PaddleOCR", role: "document and image text extraction", modes: ["ocr", "document", "structure"], runtime: "service" },
  { id: "ultralytics", repo: "www-infinity4/ultralytics", role: "object detection and visual classification", modes: ["detect", "classify", "segment"], runtime: "service" },
  { id: "depth-anything-3", repo: "www-infinity4/Depth-Anything-3", role: "depth and scene geometry", modes: ["depth", "3d", "parallax", "geometry"], runtime: "service" },
  { id: "wan22", repo: "www-infinity4/Wan2.2", role: "video generation", modes: ["video", "motion"], runtime: "service" },
  { id: "ltx-video", repo: "www-infinity4/LTX-Video", role: "video generation and editing", modes: ["video", "motion", "storyboard"], runtime: "service" },
  { id: "ffmpeg", repo: "www-infinity4/FFmpeg", role: "media conversion and assembly", modes: ["video", "audio", "transcode", "thumbnail"], runtime: "build" },
  { id: "trellis2", repo: "www-infinity4/TRELLIS.2", role: "3D asset generation", modes: ["3d", "mesh", "asset"], runtime: "service" },
  { id: "hunyuan3d", repo: "www-infinity4/Hunyuan3D-2.1", role: "3D generation", modes: ["3d", "mesh", "texture"], runtime: "service" },
  { id: "blender", repo: "www-infinity4/blender", role: "3D scene assembly, rendering and animation", modes: ["3d", "mesh", "render", "scene", "animation"], runtime: "build" },
  { id: "threejs", repo: "www-infinity4/three.js", role: "interactive browser 3D", modes: ["3d", "webgl", "interactive", "scene"], runtime: "browser" },
];

export const PHI_LOCAL_COMPOSITION_CAPABILITIES: PhiCapability[] = [
  { id: "puck", repo: "C13b0:@puckeditor/core", role: "editable publication composition", modes: ["layout", "edit", "publish"], runtime: "browser" },
];

export const PHI_CAPABILITY_LATTICE: PhiCapability[] = [
  ...PHI_FORKED_PRODUCTION_CAPABILITIES,
  ...PHI_LOCAL_COMPOSITION_CAPABILITIES,
];

export function capabilitiesFor(modes: string[]): PhiCapability[] {
  const wanted = new Set(modes.map(x => x.toLowerCase()));
  return PHI_CAPABILITY_LATTICE.filter(cap => cap.modes.some(mode => wanted.has(mode)));
}

export type WebsiteCapabilityInput = {
  hasImages?: boolean;
  hasVideo?: boolean;
  wants3d?: boolean;
  documentHeavy?: boolean;
  interactive?: boolean;
  needsSegmentation?: boolean;
};

export function planWebsiteCapabilities(input: WebsiteCapabilityInput) {
  // Every generated publication needs composition plus an image/illustration
  // path. The remaining modes are added from the subject and history profile.
  const modes = ["layout", "edit", "publish", "image", "hero", "illustration", "image-analysis"];
  if (input.hasImages) modes.push("crop", "quality", "segment", "detect", "classify");
  if (input.needsSegmentation) modes.push("mask", "cutout", "layout-analysis", "segment");
  if (input.hasVideo) modes.push("video", "motion", "storyboard", "thumbnail", "transcode", "audio");
  if (input.wants3d) modes.push("3d", "mesh", "texture", "depth", "parallax", "render", "scene", "animation", "webgl");
  if (input.documentHeavy) modes.push("ocr", "document", "structure");
  if (input.interactive) modes.push("interactive", "webgl", "workflow");
  return capabilitiesFor(modes);
}
