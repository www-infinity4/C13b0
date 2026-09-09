export type InfinityIntent = "search" | "code" | "create";

export type CoderCapability = {
  name: string;
  /** Preferred repository. New capability forks point at www-infinity4 first. */
  repo: string;
  /** Original project retained for provenance and upstream comparison. */
  upstream?: string;
  branch?: string;
  use: string;
  tags: string[];
  triggers?: string[];
  intents?: InfinityIntent[];
  artifacts?: string[];
  /** Files/directories/search terms an agent should inspect when this capability wins routing. */
  inspect?: string[];
};

const core = (
  name: string,
  repo: string,
  use: string,
  tags: string[],
  extra: Partial<CoderCapability> = {},
): CoderCapability => ({ name, repo, use, tags, ...extra });

/**
 * Infinity Phi capability index.
 *
 * This is not a decorative list. Phi Code imports capabilitiesFor() on every
 * build/iteration and uses the ranked entries as its engine plan. Create can
 * use the same resolver for artifact routing. The 2026-09-09 expansion points
 * to Kris's www-infinity4 forks first, while preserving upstream provenance.
 */
export const CODER_CAPABILITIES: CoderCapability[] = [
  core("Phaser", "phaserjs/phaser", "2D games, sprites, physics, scenes and input", ["game", "8-bit", "sprite", "physics", "levels"], {
    intents: ["code", "create"], artifacts: ["game", "interactive app"], triggers: ["platformer", "arcade game", "sprite game"], inspect: ["README", "src", "types", "examples"],
  }),
  core("PixiJS", "pixijs/pixijs", "fast 2D WebGL/canvas graphics and animation", ["graphics", "sprite", "canvas", "animation"], {
    intents: ["code", "create"], artifacts: ["2D visual app", "animation", "game"], triggers: ["animated canvas", "2d renderer"], inspect: ["README", "src", "examples"],
  }),
  core("melonJS", "melonjs/melonJS", "HTML5 game engine for tile maps and platformers", ["game", "tilemap", "platformer", "8-bit"], {
    intents: ["code", "create"], artifacts: ["game"], triggers: ["tile map", "platform game"], inspect: ["README", "packages", "examples"],
  }),
  core("Kontra", "straker/kontra", "small JavaScript game primitives for lightweight builds", ["game", "micro", "canvas", "arcade"], {
    intents: ["code", "create"], artifacts: ["small game"], triggers: ["lightweight game", "small arcade"], inspect: ["README", "src"],
  }),
  core("LittleJS", "KilledByAPixel/LittleJS", "tiny game engine suited to pixel-art arcade builds", ["game", "8-bit", "pixel", "arcade"], {
    intents: ["code", "create"], artifacts: ["pixel game"], triggers: ["8 bit", "pixel art game", "retro game"], inspect: ["README", "src", "examples"],
  }),
  core("Sandpack", "codesandbox/sandpack", "browser code preview and live bundling", ["preview", "code", "sandbox", "react"], {
    intents: ["code"], artifacts: ["live preview", "code sandbox"], triggers: ["live preview", "preview code", "browser IDE"], inspect: ["README", "sandpack-react", "packages"],
  }),
  core("Monaco Editor", "microsoft/monaco-editor", "editor infrastructure when source editing is intentionally exposed", ["editor", "code", "language"], {
    intents: ["code"], artifacts: ["code editor", "IDE"], triggers: ["source editor", "code editor"], inspect: ["README", "src", "website"],
  }),
  core("SheetJS", "SheetJS/sheetjs", "spreadsheet parsing, writing and workbook interchange", ["spreadsheet", "xlsx", "csv", "workbook"], {
    intents: ["code", "create"], artifacts: ["spreadsheet", "CSV", "XLSX"], triggers: ["excel file", "workbook", "csv export"], inspect: ["README", "demos", "types"],
  }),
  core("ExcelJS", "exceljs/exceljs", "formatted XLSX workbook generation", ["spreadsheet", "xlsx", "business", "tables"], {
    intents: ["code", "create"], artifacts: ["spreadsheet", "business workbook"], triggers: ["formatted excel", "xlsx report"], inspect: ["README", "lib", "spec"],
  }),
  core("docx", "dolanmiu/docx", "Word-compatible DOCX document generation", ["document", "docx", "letter", "report"], {
    intents: ["create", "code"], artifacts: ["DOCX", "letter", "report"], triggers: ["word document", "docx", "printable letter"], inspect: ["README", "src", "demo"],
  }),
  core("pdf-lib", "Hopding/pdf-lib", "PDF creation and editing", ["pdf", "document", "invoice", "print"], {
    intents: ["create", "code"], artifacts: ["PDF", "invoice", "document"], triggers: ["edit pdf", "pdf form", "pdf document"], inspect: ["README", "src", "apps"],
  }),
  core("jsPDF", "parallax/jsPDF", "client-side printable PDF documents", ["pdf", "invoice", "print", "document"], {
    intents: ["create", "code"], artifacts: ["PDF", "invoice"], triggers: ["print invoice", "download pdf"], inspect: ["README", "src", "examples"],
  }),
  core("GrapesJS", "GrapesJS/grapesjs", "visual website and component composition", ["website", "builder", "components", "layout"], {
    intents: ["code", "create"], artifacts: ["website", "page builder"], triggers: ["website builder", "drag and drop website"], inspect: ["README", "packages", "src"],
  }),
  core("Fabric.js", "fabricjs/fabric.js", "interactive canvas editing and positioned graphics", ["canvas", "design", "graphics", "editor"], {
    intents: ["code", "create"], artifacts: ["graphics editor", "canvas design"], triggers: ["image editor", "canvas editor", "position graphics"], inspect: ["README", "src", "demos"],
  }),
  core("Mermaid", "mermaid-js/mermaid", "diagrams and structured visual explanations", ["diagram", "flowchart", "document", "architecture"], {
    intents: ["search", "code", "create"], artifacts: ["diagram", "flowchart"], triggers: ["flow chart", "sequence diagram", "architecture diagram"], inspect: ["README", "packages", "demos"],
  }),

  // Fork-index expansion: preferred source is the user's fork.
  core("Excalidraw", "www-infinity4/excalidraw", "hand-drawn diagrams, whiteboards and editable visual documents", ["drawing", "diagram", "whiteboard", "canvas", "visual document"], {
    upstream: "excalidraw/excalidraw", branch: "master", intents: ["code", "create", "search"], artifacts: ["diagram", "whiteboard", "visual document"], triggers: ["draw a diagram", "sketch", "whiteboard", "visual notes"], inspect: ["README.md", "packages", "excalidraw-app"],
  }),
  core("tldraw", "www-infinity4/tldraw", "infinite canvas, visual workspace and collaborative shape editing", ["canvas", "whiteboard", "diagram", "workspace", "visual editor"], {
    upstream: "tldraw/tldraw", branch: "main", intents: ["code", "create"], artifacts: ["infinite canvas", "visual workspace"], triggers: ["infinite canvas", "visual workspace", "collaborative board"], inspect: ["README.md", "packages", "apps"],
  }),
  core("Apache ECharts", "www-infinity4/echarts", "interactive charts, dashboards and business/scientific visualization", ["chart", "dashboard", "graph", "data visualization", "analytics"], {
    upstream: "apache/echarts", branch: "master", intents: ["code", "create", "search"], artifacts: ["chart", "dashboard", "data visualization"], triggers: ["line chart", "bar chart", "stock chart", "dashboard", "visualize data"], inspect: ["README.md", "src", "test", "theme"],
  }),
  core("AG Grid", "www-infinity4/ag-grid", "high-performance business data grids with sorting, filtering and editing", ["spreadsheet", "grid", "table", "business", "filter", "sort", "database"], {
    upstream: "ag-grid/ag-grid", branch: "latest", intents: ["code", "create"], artifacts: ["data grid", "business table", "spreadsheet app"], triggers: ["editable table", "data grid", "inventory table", "database table"], inspect: ["README.md", "packages", "documentation"],
  }),
  core("Tiptap", "www-infinity4/tiptap", "rich-text editing and programmable document composition", ["document", "editor", "rich text", "letter", "report", "content"], {
    upstream: "ueberdosis/tiptap", branch: "main", intents: ["code", "create"], artifacts: ["rich document", "editor", "report"], triggers: ["rich text editor", "editable document", "document editor"], inspect: ["README.md", "packages", "demos"],
  }),
  core("Lexical", "www-infinity4/lexical", "programmable rich-text/document engine for structured editing", ["document", "editor", "rich text", "contenteditable", "writing"], {
    upstream: "facebook/lexical", branch: "main", intents: ["code", "create"], artifacts: ["document editor", "writing app"], triggers: ["writing app", "structured editor", "rich text"], inspect: ["README.md", "packages", "examples"],
  }),
  core("Blockly", "www-infinity4/blockly", "visual programming blocks for users who should not need to see source code", ["visual code", "blocks", "programming", "education", "workflow"], {
    upstream: "RaspberryPiFoundation/blockly", branch: "main", intents: ["code", "create"], artifacts: ["visual programming", "workflow builder"], triggers: ["block programming", "visual coding", "no code programming"], inspect: ["README.md", "core", "blocks", "generators"],
  }),
  core("Rete", "www-infinity4/rete", "node-based visual programming and dataflow composition", ["node editor", "visual programming", "dataflow", "workflow", "agent"], {
    upstream: "retejs/rete", branch: "main", intents: ["code", "create"], artifacts: ["node editor", "workflow", "agent graph"], triggers: ["node editor", "data flow", "agent workflow", "visual workflow"], inspect: ["README.md", "src", "test"],
  }),
  core("Babylon.js", "www-infinity4/Babylon.js", "3D games, WebGL/WebGPU scenes, physics, audio and XR", ["3d", "game", "webgl", "webgpu", "xr", "physics", "scene"], {
    upstream: "BabylonJS/Babylon.js", branch: "master", intents: ["code", "create"], artifacts: ["3D app", "3D game", "XR experience"], triggers: ["3d game", "3d world", "webgpu", "virtual reality", "3d scene"], inspect: ["README.md", "packages", "packages/dev/core", "Playground"],
  }),
  core("React Three Fiber", "www-infinity4/react-three-fiber", "React renderer for Three.js scenes and interactive 3D interfaces", ["3d", "react", "three", "webgl", "scene", "animation"], {
    upstream: "pmndrs/react-three-fiber", branch: "master", intents: ["code", "create"], artifacts: ["React 3D app", "3D website"], triggers: ["react 3d", "three js", "3d website"], inspect: ["README.md", "packages", "docs"],
  }),
  core("Tone.js", "www-infinity4/Tone.js", "music, synthesis, sequencing, effects and interactive Web Audio", ["audio", "music", "sound", "synth", "sequencer", "web audio"], {
    upstream: "Tonejs/Tone.js", branch: "dev", intents: ["code", "create"], artifacts: ["audio app", "music tool", "synthesizer"], triggers: ["music app", "sound machine", "synth", "sequencer", "audio effects"], inspect: ["README.md", "Tone", "examples", "test"],
  }),
  core("FFmpeg.wasm", "www-infinity4/ffmpeg.wasm", "browser-side video/audio conversion, trimming and media processing", ["video", "audio", "media", "convert", "trim", "encode", "ffmpeg"], {
    upstream: "ffmpegwasm/ffmpeg.wasm", branch: "main", intents: ["code", "create"], artifacts: ["video tool", "audio tool", "media converter"], triggers: ["video editor", "convert video", "trim audio", "media processing"], inspect: ["README.md", "packages", "apps"],
  }),
  core("Form.io", "www-infinity4/formio.js", "business forms, schema-driven data entry and workflow interfaces", ["form", "business", "data entry", "workflow", "schema", "application"], {
    upstream: "formio/formio.js", branch: "main", intents: ["code", "create"], artifacts: ["business form", "data-entry app", "workflow"], triggers: ["intake form", "application form", "business form", "data entry"], inspect: ["README.md", "src", "test", "app"],
  }),
  core("SurveyJS", "www-infinity4/survey-library", "surveys, quizzes, assessments and structured questionnaires", ["survey", "quiz", "questionnaire", "assessment", "form"], {
    upstream: "surveyjs/survey-library", branch: "master", intents: ["code", "create"], artifacts: ["survey", "quiz", "assessment"], triggers: ["questionnaire", "customer survey", "assessment", "quiz builder"], inspect: ["README.md", "packages", "src", "examples"],
  }),
  core("Univer", "www-infinity4/univer", "spreadsheet, document and presentation-style office application infrastructure", ["spreadsheet", "document", "presentation", "office", "workbook", "sheet"], {
    upstream: "dream-num/univer", branch: "dev", intents: ["code", "create"], artifacts: ["spreadsheet", "document", "presentation", "office app"], triggers: ["spreadsheet app", "office suite", "workbook", "presentation editor", "document workspace"], inspect: ["README.md", "packages", "examples", "docs"],
  }),
];

function phraseScore(haystack: string, values: string[] | undefined, points: number) {
  if (!values?.length) return 0;
  return values.reduce((score, value) => score + (haystack.includes(value.toLowerCase()) ? points : 0), 0);
}

/** Rank the capability registry for the user's current intent/prompt. */
export function capabilitiesFor(prompt: string, intent?: InfinityIntent) {
  const lower = prompt.toLowerCase();
  return CODER_CAPABILITIES
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

/** Concrete repository locations for an agent/source scanner to inspect. */
export function capabilityAccessPlan(prompt: string, intent: InfinityIntent = "code") {
  return capabilitiesFor(prompt, intent).map((cap) => {
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
