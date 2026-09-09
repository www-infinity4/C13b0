export type CoderCapability={name:string;repo:string;use:string;tags:string[]};

// Candidate open-source capability adapters for Infinity Code/Create.
// They are indexed here so the builder can route intent by capability; individual
// projects can be forked/vendor-pinned before production use.
export const CODER_CAPABILITIES:CoderCapability[]=[
  {name:"Phaser",repo:"phaserjs/phaser",use:"2D games, sprites, physics, scenes and input",tags:["game","8-bit","sprite","physics","levels"]},
  {name:"PixiJS",repo:"pixijs/pixijs",use:"fast 2D WebGL/canvas graphics and animation",tags:["graphics","sprite","canvas","animation"]},
  {name:"melonJS",repo:"melonjs/melonJS",use:"HTML5 game engine for tile maps and platformers",tags:["game","tilemap","platformer","8-bit"]},
  {name:"Kontra",repo:"straker/kontra",use:"small JavaScript game primitives for lightweight builds",tags:["game","micro","canvas","arcade"]},
  {name:"LittleJS",repo:"KilledByAPixel/LittleJS",use:"tiny game engine suited to pixel-art arcade builds",tags:["game","8-bit","pixel","arcade"]},
  {name:"Sandpack",repo:"codesandbox/sandpack",use:"browser code preview and live bundling",tags:["preview","code","sandbox","react"]},
  {name:"Monaco Editor",repo:"microsoft/monaco-editor",use:"editor infrastructure when source editing is intentionally exposed",tags:["editor","code","language"]},
  {name:"SheetJS",repo:"SheetJS/sheetjs",use:"spreadsheet parsing, writing and workbook interchange",tags:["spreadsheet","xlsx","csv","workbook"]},
  {name:"ExcelJS",repo:"exceljs/exceljs",use:"formatted XLSX workbook generation",tags:["spreadsheet","xlsx","business","tables"]},
  {name:"docx",repo:"dolanmiu/docx",use:"Word-compatible DOCX document generation",tags:["document","docx","letter","report"]},
  {name:"pdf-lib",repo:"Hopding/pdf-lib",use:"PDF creation and editing",tags:["pdf","document","invoice","print"]},
  {name:"jsPDF",repo:"parallax/jsPDF",use:"client-side printable PDF documents",tags:["pdf","invoice","print","document"]},
  {name:"GrapesJS",repo:"GrapesJS/grapesjs",use:"visual website and component composition",tags:["website","builder","components","layout"]},
  {name:"Fabric.js",repo:"fabricjs/fabric.js",use:"interactive canvas editing and positioned graphics",tags:["canvas","design","graphics","editor"]},
  {name:"Mermaid",repo:"mermaid-js/mermaid",use:"diagrams and structured visual explanations",tags:["diagram","flowchart","document","architecture"]},
];

export function capabilitiesFor(prompt:string){
  const lower=prompt.toLowerCase();
  return CODER_CAPABILITIES.map((cap)=>({...cap,score:cap.tags.filter((tag)=>lower.includes(tag.toLowerCase())).length})).filter((cap)=>cap.score>0).sort((a,b)=>b.score-a.score).slice(0,6);
}
