import {
  CODER_CAPABILITIES,
  type CoderCapability,
  type InfinityIntent,
} from "@/lib/coder-capabilities";

const visual = (
  name: string,
  repo: string,
  upstream: string,
  branch: string,
  use: string,
  tags: string[],
  triggers: string[],
  artifacts: string[],
  inspect: string[] = ["README.md", "package.json"],
): CoderCapability => ({
  name,
  repo,
  upstream,
  branch,
  use,
  tags,
  triggers,
  artifacts,
  intents: ["search", "code", "create"],
  inspect,
});

/**
 * The original 15 visual/AI forks selected for Infinity Phi.
 * These are source-capability entries, not claims that their runtime code is
 * bundled into every page. A separate exact-file usage ledger records what a
 * particular build actually reads and is the only thing shown in public
 * "Built using" credits.
 */
export const VISUAL_AI_CAPABILITIES: CoderCapability[] = [
  visual("ComfyUI", "www-infinity4/ComfyUI", "comfyanonymous/ComfyUI", "master", "node-based generative image and media workflows", ["image", "generation", "workflow", "nodes", "diffusion"], ["image workflow", "generation workflow", "node image builder", "comfyui"], ["image workflow", "generative media workflow"]),
  visual("Hugging Face Diffusers", "www-infinity4/diffusers", "huggingface/diffusers", "main", "diffusion pipelines for image, video and generative media", ["image", "video", "diffusion", "generation", "model"], ["diffusion", "generate image", "image model", "text to image"], ["image generator", "video generator", "diffusion pipeline"]),
  visual("FLUX", "www-infinity4/flux", "black-forest-labs/flux", "main", "high-quality text-to-image generation architecture", ["image", "generation", "flux", "text to image", "visual"], ["flux image", "text to image", "generate artwork", "image generator"], ["generated image", "visual asset"]),
  visual("Segment Anything", "www-infinity4/segment-anything", "facebookresearch/segment-anything", "main", "image segmentation and object-mask extraction", ["image", "segment", "mask", "scanner", "object"], ["segment image", "object mask", "cut out object", "image scanner"], ["segmented image", "object mask"]),
  visual("OpenCV", "www-infinity4/opencv", "opencv/opencv", "5.x", "computer vision, image/video analysis and transformation", ["vision", "image", "video", "scanner", "camera", "detect"], ["computer vision", "scan image", "camera processing", "image processing"], ["vision tool", "image processor", "video analyzer"], ["README.md", "modules", "samples"]),
  visual("PaddleOCR", "www-infinity4/PaddleOCR", "PaddlePaddle/PaddleOCR", "main", "OCR and document/image text recognition", ["ocr", "document", "text", "image", "scanner"], ["ocr", "read text from image", "scan document", "extract text"], ["OCR scanner", "document reader"]),
  visual("Ultralytics YOLO", "www-infinity4/ultralytics", "ultralytics/ultralytics", "main", "real-time object detection, tracking and vision inference", ["vision", "object detection", "yolo", "tracking", "scanner"], ["detect objects", "object detector", "yolo", "track objects"], ["object detector", "vision scanner"]),
  visual("Depth Anything 3", "www-infinity4/Depth-Anything-3", "ByteDance-Seed/Depth-Anything-3", "main", "depth estimation for scenes, images and 3D-aware visual analysis", ["depth", "3d", "image", "scene", "vision"], ["depth map", "scene depth", "image depth", "3d from image"], ["depth map", "3D-aware image"]),
  visual("Wan 2.2", "www-infinity4/Wan2.2", "Wan-Video/Wan2.2", "main", "generative video workflows", ["video", "generation", "animation", "media"], ["generate video", "text to video", "ai video", "video generation"], ["generated video", "animation"]),
  visual("LTX-Video", "www-infinity4/LTX-Video", "Lightricks/LTX-Video", "main", "text/image-to-video generation and video pipelines", ["video", "generation", "animation", "media"], ["ltx video", "image to video", "text to video", "generate video"], ["generated video", "video sequence"]),
  visual("FFmpeg", "www-infinity4/FFmpeg", "FFmpeg/FFmpeg", "master", "audio/video encoding, conversion, filtering and media assembly", ["video", "audio", "encode", "convert", "filter", "media"], ["encode video", "convert media", "audio filter", "video filter", "ffmpeg"], ["video processor", "audio processor", "media converter"], ["README.md", "doc", "fftools"]),
  visual("TRELLIS.2", "www-infinity4/TRELLIS.2", "microsoft/TRELLIS.2", "main", "3D asset and structure generation", ["3d", "asset", "generation", "mesh", "visual"], ["generate 3d", "3d asset", "mesh generation", "trellis"], ["3D asset", "3D model"]),
  visual("Hunyuan3D 2.1", "www-infinity4/Hunyuan3D-2.1", "Tencent-Hunyuan/Hunyuan3D-2.1", "main", "image/text-driven 3D generation", ["3d", "model", "generation", "mesh", "texture"], ["hunyuan", "3d model", "text to 3d", "image to 3d"], ["3D model", "textured 3D asset"]),
  visual("Blender", "blender/blender", "blender/blender", "main", "3D modeling, rendering, animation and scene production", ["3d", "render", "animation", "model", "scene"], ["blender", "3d render", "animate 3d", "model scene"], ["3D scene", "render", "animation"], ["README.md", "source", "scripts"]),
  visual("Three.js", "www-infinity4/three.js", "mrdoob/three.js", "dev", "browser 3D rendering and interactive WebGL/WebGPU scenes", ["3d", "webgl", "webgpu", "scene", "browser"], ["three js", "3d website", "webgl scene", "browser 3d"], ["3D website", "interactive 3D scene"], ["README.md", "src", "examples"]),
];

/** All three 15-source batches: 45 capabilities total. */
export const INFINITY_CAPABILITIES: CoderCapability[] = [
  ...VISUAL_AI_CAPABILITIES,
  ...CODER_CAPABILITIES,
];

function phraseScore(haystack: string, values: string[] | undefined, points: number) {
  if (!values?.length) return 0;
  return values.reduce((score, value) => score + (haystack.includes(value.toLowerCase()) ? points : 0), 0);
}

/** Rank all 45 sources for the user's current request. */
export function infinityCapabilitiesFor(prompt: string, intent?: InfinityIntent) {
  const lower = prompt.toLowerCase();
  return INFINITY_CAPABILITIES
    .map((cap) => {
      let score = 0;
      score += phraseScore(lower, cap.triggers, 5);
      score += phraseScore(lower, cap.tags, 3);
      score += phraseScore(lower, cap.artifacts, 2);
      if (intent && cap.intents?.includes(intent)) score += 2;
      if (intent && cap.intents?.length && !cap.intents.includes(intent)) score -= 3;
      return { ...cap, score };
    })
    .filter((cap) => cap.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 8);
}

/** Exact source locations an agent may inspect when a capability wins routing. */
export function infinityCapabilityAccessPlan(prompt: string, intent: InfinityIntent = "code") {
  return infinityCapabilitiesFor(prompt, intent).map((cap) => {
    const branch = cap.branch || "main";
    const github = `https://github.com/${cap.repo}`;
    const rawRoot = `https://raw.githubusercontent.com/${cap.repo}/${branch}`;
    return {
      name: cap.name,
      use: cap.use,
      repo: cap.repo,
      upstream: cap.upstream,
      branch,
      github,
      rawRoot,
      inspect: cap.inspect || ["README.md", "package.json"],
      artifacts: cap.artifacts || [],
      score: cap.score,
    };
  });
}
