import { CODER_CAPABILITIES, capabilityAccessPlan, type InfinityIntent } from "@/lib/coder-capabilities";
import { phiCodeWatcherContext, recordPhiCodeMove, type PhiCodeWatchEvent } from "@/lib/phi-code-watcher";
const ENDPOINT="https://infinity-rogers.marvaseater.workers.dev/v1/chat",clean=(v:unknown,max=8000)=>String(v||"").replace(/\s+/g," ").trim().slice(0,max);
export type PhiCodeToolSnapshot={name:string;repo:string;use:string;branch:string;files:{path:string;url:string;text:string}[]};export type PhiCodeAgentPlanStep={tool:string;repo?:string;action:string;reason:string};export type PhiCodeAgentResult={html:string;summary:string;plan:PhiCodeAgentPlanStep[];verification:string[]};type ImportedSkill={name:string;repo:string;upstream?:string;branch:string;use:string;tags:string[];triggers:string[];artifacts:string[]};
export function importedPhiSkills(intent:InfinityIntent="code"):ImportedSkill[]{return CODER_CAPABILITIES.filter(c=>Boolean(c.upstream)&&c.repo.startsWith("www-infinity4/")&&(!c.intents?.length||c.intents.includes(intent))).map(c=>({name:c.name,repo:c.repo,upstream:c.upstream,branch:c.branch||"main",use:c.use,tags:c.tags,triggers:c.triggers||[],artifacts:c.artifacts||[]}))}
function rawCandidates(s:ReturnType<typeof capabilityAccessPlan>[number]){return[...new Set(["SKILL.md","AGENTS.md","README.md","package.json",...(s.inspect||[])].filter(p=>p&&!p.endsWith("/")))].slice(0,4)}async function fetchText(url:string,timeoutMs=700){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeoutMs);try{const r=await fetch(url,{cache:"force-cache",signal:c.signal});return r.ok?(await r.text()).slice(0,7000):""}catch{return""}finally{clearTimeout(t)}}
export async function loadPhiCodeToolInstructions(prompt:string,runId:string,intent:InfinityIntent="code"){const ranked=capabilityAccessPlan(prompt,intent),base=intent==="code"?CODER_CAPABILITIES.filter(c=>c.name==="Sandpack"||c.name==="shadcn/ui").map(c=>{const branch=c.branch||"main";return{name:c.name,use:c.use,repo:c.repo,upstream:c.upstream,branch,github:`https://github.com/${c.repo}`,rawRoot:`https://raw.githubusercontent.com/${c.repo}/${branch}`,inspect:c.inspect||["README.md","package.json"],artifacts:c.artifacts||[],score:99}}):[],plan=[...base,...ranked].filter((x,i,a)=>a.findIndex(y=>y.repo===x.repo)===i).slice(0,5);return Promise.all(plan.map(async source=>{recordPhiCodeMove({runId,phase:"route",status:"success",tool:source.name,repo:source.repo,action:`Selected ${source.name}.`});const files=(await Promise.all(rawCandidates(source).slice(0,2).map(async path=>{const p=path.replace(/^\/+/,""),url=`${source.rawRoot}/${p}`,text=await fetchText(url);return text?{path:p,url,text}:null}))).filter(Boolean).slice(0,2) as PhiCodeToolSnapshot["files"];return{name:source.name,repo:source.repo,use:source.use,branch:source.branch,files}}))}
function extractJson(text:string){const raw=String(text||"").trim(),f=raw.match(/```(?:json)?\s*([\s\S]*?)```/i),s=f?.[1]?.trim()||raw;try{return JSON.parse(s)}catch{}const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a)try{return JSON.parse(s.slice(a,b+1))}catch{}return null}function extractHtml(text:string){const f=String(text||"").match(/```(?:html)?\s*([\s\S]*?)```/i);if(f?.[1]?.includes("<"))return f[1].trim();const a=String(text||"").toLowerCase().indexOf("<!doctype html");return a>=0?String(text).slice(a).trim():""}function normalizeResult(output:string):PhiCodeAgentResult|null{const p=extractJson(output),html=String(p?.html||"").trim()||extractHtml(output);if(!html||!/<(?:!doctype|html|body|main|div)\b/i.test(html))return null;return{html,summary:clean(p?.summary,700)||"Built the requested website artifact.",plan:Array.isArray(p?.plan)?p.plan.slice(0,10):[],verification:Array.isArray(p?.verification)?p.verification.map((x:unknown)=>clean(x,300)).filter(Boolean).slice(0,10):[]}}
function steeringDirective(v:string){const s=v.toLowerCase();if((s.includes("random")&&s.includes("generator"))||s.includes("random number"))return`MANDATORY FUNCTION PATCH: The user explicitly requested a random generator. Implement a REAL working generator in the returned index.html, not pseudocode, a code listing, or a placeholder. Give it clear controls appropriate to the request (for a number generator, min/max inputs plus a Generate button), validate input, generate with browser JavaScript on every tap, and visibly update the result without reloading. It MUST be directly testable inside the preview iframe. Integrate it into the existing site's visual language and content instead of replacing the site. Preserve existing stories, images, videos and navigation. If the source site already has navigation, keep it functional; on Android it should use a working hamburger. Do not invent unrelated features.`;if(s.includes("responsive hamburger")||s.includes("hamburger menu")||s.includes("add hamburger"))return`MANDATORY STEERING PATCH: Convert the CURRENT SITE navigation into a real responsive hamburger now. Do not merely make the existing navigation responsive and do not add a decorative icon. On the Android layout, hide the existing inline/nav-link row, add one visible three-line hamburger button in the app/header bar, and put those same existing navigation/actions inside an off-canvas or dropdown menu. Add working JavaScript so tapping the hamburger visibly opens the menu, tapping it again/close/backdrop closes it, and menu items remain usable. Preserve the rest of the current site. The returned HTML must visibly contain this change.`;return""}
function requestedFunctionCheck(v:string,html:string){const s=v.toLowerCase(),h=html.toLowerCase();if((s.includes("random")&&s.includes("generator"))||s.includes("random number")){if(!h.includes("<script")||!h.includes("button")||!/(math\.random|crypto\.getrandomvalues)/i.test(html))return"The preview did not contain a runnable random generator, so the previous working preview was preserved."}return""}
export async function buildWithPhiCodeAgent(args:{prompt:string;revisions:string[];currentHtml?:string;runId:string;snapshots:PhiCodeToolSnapshot[];intent?:InfinityIntent}){const{prompt,revisions,currentHtml,runId,snapshots}=args,intent=args.intent||"code",latestRevision=revisions.length?revisions[revisions.length-1]:"",isRevision=Boolean(currentHtml),userInstruction=isRevision?latestRevision||"Improve the current artifact without changing its purpose.":prompt,mandatory=steeringDirective(userInstruction),importedSkills=importedPhiSkills(intent),selected=capabilityAccessPlan(`${prompt}\n${latestRevision}`,intent).slice(0,10).map(c=>({name:c.name,repo:c.repo,use:c.use,score:c.score,artifacts:c.artifacts})),watcher=phiCodeWatcherContext(`${prompt}\n${latestRevision}`);const instruction=`You are Code Phi, an expert visual website iteration engine. One workspace owns ONE artifact at a time. Never blend examples, previous builds, unrelated requests, tool documentation, or old projects into that artifact.

ORIGINAL PURPOSE / TOKEN PROJECT CONTEXT:
${prompt}

${isRevision?`CURRENT REVISION REQUEST — this is the ONLY requested change for this turn:
${userInstruction}
${mandatory?`\n${mandatory}\n`:""}
CURRENT INDEX.HTML IS THE SOURCE OF TRUTH. Edit this exact artifact in place. Preserve its subject, content, structure and working features except where the current revision explicitly asks for a change:
${currentHtml!.slice(0,30000)}
`:`NEW BUILD REQUEST — build the project's real website canvas and make the explicitly requested function work immediately:
${userInstruction}
${mandatory?`\n${mandatory}\n`:""}`}
AVAILABLE IMPORTED SKILLS (capabilities only; never copy their demos, sample copy, sample media, or README content into the website):
${JSON.stringify(importedSkills)}

BEST MATCHES:
${JSON.stringify(selected)}

OPTIONAL TOOL NOTES (implementation reference only, NOT website content):
${JSON.stringify(snapshots.map(s=>({name:s.name,repo:s.repo,use:s.use,files:s.files.map(f=>({path:f.path,text:f.text.slice(0,1400)}))})))}

LEARNED BUILD PATTERNS (technique only; never import their subject matter or text):
${JSON.stringify(watcher.playbooks)}

PROJECT-CONTENT CONTRACT — CRITICAL:
- Treat the selected token/project and supplied website/index as the content source. If it contains stories, images, videos, sections or navigation, preserve and organize those real materials rather than replacing them with generic filler.
- Infer a sensible polished layout from the material already present. Do NOT require the user to choose every layout decision before showing a useful site.
- A normal site gets working navigation immediately. On Android, use a real hamburger/drawer when navigation has multiple destinations. Menu destinations must correspond to the site's actual sections/content, not fake pages.
- Purple steering choices are FUTURE design decisions. Do not invent those choices in advance. Build the requested function and a strong baseline around the known project content.

SCOPE + DEVICE CONTRACT — CRITICAL:
- DEFAULT TARGET IS ANDROID PHONE PORTRAIT, roughly 360–430 CSS px wide, while remaining responsive on larger screens.
- Build exactly what was explicitly requested first. If the user asks to add a widget/tool, ADD IT to the project site; do not replace the site with a description of the widget or with source code shown as text.
- Multiple videos belong in a vertically scrolling feed with width:100%; aspect-ratio:16/9; height:auto.

PREVIEW CONTRACT — CRITICAL:
- The returned index.html itself IS the website preview, with complete CSS and browser JavaScript.
- Every visible control must actually work inside the iframe now. A generator must generate; a hamburger must open; tabs must switch; filters must filter; carousels must move. No dead controls, pseudocode, TODOs, fake buttons, or unresolved package imports.
- The user must be able to TEST the requested behavior by tapping the preview immediately after the build completes.
- Keep CSS and JavaScript self-contained when that is necessary for iframe execution.
- The BUILD/EDITING interface belongs OUTSIDE generated index.html.

ITERATION RULES:
- A revision is a PATCH to CURRENT INDEX.HTML, not a request to regenerate from accumulated conversation.
- The newest steering instruction has priority over preserving the specific element it asks to change. Preserve everything ELSE.
- Earlier revisions are already represented by CURRENT INDEX.HTML.
- Never substitute demo/example content from imported skills.

BUILD STANDARD:
- Use Sandpack-style executable-preview discipline and shadcn-style modern component discipline, translated to self-contained browser-runnable HTML.
- Functionality is a release gate: do not claim a requested interactive feature exists unless its HTML/CSS/JS implementation is present in index.html.
- Preserve every working feature except the feature explicitly being changed.
- Return STRICT JSON only: {"plan":[{"tool":"name","repo":"owner/repo","action":"what it adds","reason":"why"}],"html":"<!doctype html>...","summary":"what was built","verification":["visible check","interaction tested by inspection"]}.`;
recordPhiCodeMove({runId,phase:"plan",status:"start",tool:"GPT",action:isRevision?"Applying the requested visible UI patch.":"Building one focused Android-first interactive preview."});const c=new AbortController(),timer=setTimeout(()=>c.abort(),14000);let response:Response;try{response=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},signal:c.signal,body:JSON.stringify({input:instruction,context:{application:intent==="create"?"Infinity Phi Create":"Infinity Phi Code",assistant:"gpt",task:isRevision?"phi_visual_patch_engine":"phi_visual_iteration_engine",intent,selected_capabilities:selected,artifact_mode:isRevision?"patch_current":"new_artifact",preview_contract:"android_first_self_contained_interactive_html",default_viewport:"android_phone_portrait",mandatory_steering:mandatory||undefined}})})}catch(e){if(e instanceof DOMException&&e.name==="AbortError")throw new Error("The build arm reached its network deadline. Retry keeps the current design intact.");throw e}finally{clearTimeout(timer)}const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||payload.error||`HTTP ${response.status}`);const result=normalizeResult(String(payload.output_text||payload.output||""));if(!result)throw new Error("The build arm returned no runnable index.html.");const failed=requestedFunctionCheck(userInstruction,result.html);if(failed)throw new Error(failed);recordPhiCodeMove({runId,phase:"result",status:"success",tool:"GPT",action:isRevision?"Applied the visible UI patch to index.html.":"Generated one focused Android-first interactive index.html preview."});return result}
export function watchEventsForRun(runId:string,events:PhiCodeWatchEvent[]){return events.filter(e=>e.runId===runId)}