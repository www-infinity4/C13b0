export type PhiCapability = {
  id: string;
  repo: string;
  role: string;
  modes: string[];
  runtime: "browser" | "service" | "build" | "indexed";
};

/**
 * C13b0 does not bundle these heavyweight projects into the GitHub Pages
 * browser build. Phi indexes their capabilities and routes a build to them
 * when a compatible runtime/service is present. This keeps the site fast and
 * prevents pretending a Python/GPU project is running inside static Pages.
 */
export const PHI_CAPABILITY_LATTICE: PhiCapability[] = [
  { id:"comfyui", repo:"www-infinity4/ComfyUI", role:"node-graph orchestration", modes:["image","video","audio","3d","workflow"], runtime:"service" },
  { id:"diffusers", repo:"www-infinity4/diffusers", role:"generative media pipelines", modes:["image","video","audio"], runtime:"service" },
  { id:"flux", repo:"www-infinity4/flux", role:"high-quality image generation", modes:["image","hero","illustration"], runtime:"service" },
  { id:"sam", repo:"www-infinity4/segment-anything", role:"image segmentation", modes:["mask","cutout","layout-analysis"], runtime:"service" },
  { id:"opencv", repo:"www-infinity4/opencv", role:"image analysis and transforms", modes:["image-analysis","crop","quality","geometry"], runtime:"service" },
  { id:"paddleocr", repo:"www-infinity4/PaddleOCR", role:"document and image text extraction", modes:["ocr","document","structure"], runtime:"service" },
  { id:"ultralytics", repo:"www-infinity4/ultralytics", role:"object detection and visual classification", modes:["detect","classify","segment"], runtime:"service" },
  { id:"depth-anything-3", repo:"www-infinity4/Depth-Anything-3", role:"depth and scene geometry", modes:["depth","3d","parallax"], runtime:"service" },
  { id:"wan22", repo:"www-infinity4/Wan2.2", role:"video generation", modes:["video","motion"], runtime:"service" },
  { id:"ltx-video", repo:"www-infinity4/LTX-Video", role:"video generation and editing", modes:["video","motion","storyboard"], runtime:"service" },
  { id:"ffmpeg", repo:"www-infinity4/FFmpeg", role:"media conversion and assembly", modes:["video","audio","transcode","thumbnail"], runtime:"build" },
  { id:"trellis2", repo:"www-infinity4/TRELLIS.2", role:"3D asset generation", modes:["3d","mesh","asset"], runtime:"service" },
  { id:"hunyuan3d", repo:"www-infinity4/Hunyuan3D-2.1", role:"3D generation", modes:["3d","mesh","texture"], runtime:"service" },
  { id:"threejs", repo:"www-infinity4/three.js", role:"interactive browser 3D", modes:["3d","webgl","interactive"], runtime:"browser" },
  { id:"puck", repo:"C13b0:@puckeditor/core", role:"editable publication composition", modes:["layout","edit","publish"], runtime:"browser" },
];

export function capabilitiesFor(modes: string[]): PhiCapability[] {
  const wanted = new Set(modes.map(x => x.toLowerCase()));
  return PHI_CAPABILITY_LATTICE.filter(cap => cap.modes.some(mode => wanted.has(mode)));
}

export function planWebsiteCapabilities(input: { hasImages?:boolean; hasVideo?:boolean; wants3d?:boolean; documentHeavy?:boolean; interactive?:boolean }) {
  const modes = ["layout","edit","publish","image-analysis"];
  if (input.hasImages) modes.push("crop","quality","segment");
  if (input.hasVideo) modes.push("video","thumbnail","transcode");
  if (input.wants3d) modes.push("3d","mesh","texture");
  if (input.documentHeavy) modes.push("ocr","document","structure");
  if (input.interactive) modes.push("interactive","webgl");
  return capabilitiesFor(modes);
}
