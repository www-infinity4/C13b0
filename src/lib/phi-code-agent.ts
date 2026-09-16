import { CODER_CAPABILITIES, capabilityAccessPlan, type InfinityIntent } from "@/lib/coder-capabilities";
import { phiCodeWatcherContext, recordPhiCodeMove, type PhiCodeWatchEvent } from "@/lib/phi-code-watcher";

const ENDPOINT = "https://infinity-rogers.marvaseater.workers.dev/v1/chat";
const clean = (value: unknown, max = 8000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

export type PhiCodeToolSnapshot = {
  name: string;
  repo: string;
  use: string;
  branch: string;
  files: { path: string; url: string; text: string }[];
};

export type PhiCodeAgentPlanStep = {
  tool: string;
  repo?: string;
  action: string;
  reason: string;
};

export type PhiCodeAgentResult = {
  html: string;
  summary: string;
  plan: PhiCodeAgentPlanStep[];
  verification: string[];
};

type ImportedSkill = {
  name: string;
  repo: string;
  upstream?: string;
  branch: string;
  use: string;
  tags: string[];
  triggers: string[];
  artifacts: string[];
};

export function importedPhiSkills(intent: InfinityIntent = "code"): ImportedSkill[] {
  return CODER_CAPABILITIES
    .filter((cap) => Boolean(cap.upstream) && cap.repo.startsWith("www-infinity4/") && (!cap.intents?.length || cap.intents.includes(intent)))
    .map((cap) => ({
      name: cap.name,
      repo: cap.repo,
      upstream: cap.upstream,
      branch: cap.branch || "main",
      use: cap.use,
      tags: cap.tags,
      triggers: cap.triggers || [],
      artifacts: cap.artifacts || [],
    }));
}

function rawCandidates(source: ReturnType<typeof capabilityAccessPlan>[number]) {
  const configured = source.inspect || [];
  const candidates = ["SKILL.md", "AGENTS.md", "README.md", "package.json", ...configured];
  return [...new Set(candidates.filter((path) => path && !path.endsWith("/")))].slice(0, 4);
}

async function fetchText(url: string, timeoutMs = 850) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "force-cache", signal: controller.signal });
    if (!response.ok) return "";
    return (await response.text()).slice(0, 9000);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function loadAgentManual(runId: string) {
  if (typeof location === "undefined") return {};
  const firstSegment = location.pathname.split("/").filter(Boolean)[0] || "";
  const root = location.hostname.endsWith("github.io") && firstSegment ? `/${firstSegment}/` : "/";
  const url = `${location.origin}${root}phi-code-agent-instructions.json`;
  const text = await fetchText(url, 750);
  if (!text) {
    recordPhiCodeMove({
      runId,
      phase: "read-skill",
      status: "warning",
      tool: "Code Phi agent manual",
      action: "The optional self-instruction file did not answer quickly; the built-in agent contract remained active.",
      evidence: url,
    });
    return {};
  }
  try {
    const manual = JSON.parse(text);
    recordPhiCodeMove({
      runId,
      phase: "read-skill",
      status: "success",
      tool: "Code Phi agent manual",
      action: `Read the versioned Code Phi operating instructions${manual?.version ? ` (${manual.version})` : ""}.`,
      reason: "The local agent contract is enriched when the versioned manual is available.",
      evidence: url,
    });
    return manual;
  } catch {
    return { raw: text.slice(0, 5000) };
  }
}

export async function loadPhiCodeToolInstructions(prompt: string, runId: string, intent: InfinityIntent = "code") {
  const plan = capabilityAccessPlan(prompt, intent).slice(0, 3);
  const snapshots = await Promise.all(plan.map(async (source) => {
    const started = Date.now();
    recordPhiCodeMove({
      runId,
      phase: "route",
      status: "success",
      tool: source.name,
      repo: source.repo,
      action: `Selected ${source.name} for optional repository enrichment.`,
      reason: `Capability index score ${source.score}. The complete 15-skill imported catalog is already available locally to GPT.`,
    });

    const candidates = rawCandidates(source).slice(0, 3);
    const results = await Promise.all(candidates.map(async (path) => {
      const directPath = path.replace(/^\/+/, "");
      const url = `${source.rawRoot}/${directPath}`;
      const text = await fetchText(url, 850);
      return text ? { path: directPath, url, text } : null;
    }));
    const files = results.filter((item): item is PhiCodeToolSnapshot["files"][number] => Boolean(item)).slice(0, 2);

    recordPhiCodeMove({
      runId,
      phase: "read-skill",
      status: files.length ? "success" : "warning",
      tool: source.name,
      repo: source.repo,
      action: files.length
        ? `Read ${files.map((file) => file.path).join(", ")} as optional skill enrichment.`
        : "Repository enrichment was skipped because no root instruction file answered inside the short deadline.",
      reason: "Repository reads are enrichment only; they never block access to the indexed skill catalog.",
      evidence: files.map((file) => file.url).join(" | "),
      durationMs: Date.now() - started,
    });

    return { name: source.name, repo: source.repo, use: source.use, branch: source.branch, files };
  }));

  return snapshots;
}

function compactSnapshots(snapshots: PhiCodeToolSnapshot[]) {
  return snapshots.map((snapshot) => ({
    name: snapshot.name,
    repo: snapshot.repo,
    use: snapshot.use,
    branch: snapshot.branch,
    files: snapshot.files.map((file) => ({ path: file.path, url: file.url, text: file.text.slice(0, 2800) })),
  }));
}

function extractJson(text: string) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || raw;
  try { return JSON.parse(source); } catch {}
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(source.slice(start, end + 1)); } catch {}
  }
  return null;
}

function extractHtml(text: string) {
  const fenced = String(text || "").match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.includes("<")) return fenced[1].trim();
  const start = String(text || "").toLowerCase().indexOf("<!doctype html");
  if (start >= 0) return String(text).slice(start).trim();
  return "";
}

function normalizeResult(output: string): PhiCodeAgentResult | null {
  const parsed = extractJson(output);
  const html = String(parsed?.html || "").trim() || extractHtml(output);
  if (!html || !/<(?:!doctype|html|body|main|div)\b/i.test(html)) return null;
  const plan = Array.isArray(parsed?.plan) ? parsed.plan.slice(0, 10).map((step: any) => ({
    tool: clean(step?.tool, 100),
    repo: clean(step?.repo, 180),
    action: clean(step?.action, 500),
    reason: clean(step?.reason, 500),
  })).filter((step: PhiCodeAgentPlanStep) => step.tool || step.action) : [];
  const verification = Array.isArray(parsed?.verification)
    ? parsed.verification.map((item: unknown) => clean(item, 300)).filter(Boolean).slice(0, 10)
    : [];
  return {
    html,
    summary: clean(parsed?.summary, 700) || "GPT built the preview from the indexed capability catalog.",
    plan,
    verification,
  };
}

function commonBrowserArtifact(request: string): PhiCodeAgentResult | null {
  const text = clean(request, 1800);
  const randomNumber = /\brandom\b/i.test(text) && /\b(number|integer|rng)\b/i.test(text) && /\b(generate|generator|pick|create|make)\b/i.test(text);
  if (!randomNumber) return null;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Random Number Generator</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071523;color:#eef8ff;font-family:system-ui,sans-serif}.card{width:min(92vw,620px);padding:28px;border:1px solid #4777a4;border-radius:24px;background:#0b2133}h1{margin:0 0 8px}input,button{width:100%;padding:13px;margin-top:10px}.result{font-size:64px;font-weight:950;color:#7dffad;text-align:center;padding:24px}</style></head><body><main class="card"><h1>Random Number Generator</h1><input id="min" type="number" value="1"><input id="max" type="number" value="100"><div class="result" id="result">—</div><button id="generate">Generate number</button></main><script>(()=>{const min=document.getElementById('min'),max=document.getElementById('max'),out=document.getElementById('result');document.getElementById('generate').onclick=()=>{let a=Math.trunc(Number(min.value)),b=Math.trunc(Number(max.value));if(a>b)[a,b]=[b,a];const values=new Uint32Array(1);crypto.getRandomValues(values);out.textContent=String(Math.floor((values[0]/4294967296)*(b-a+1))+a)}})()</script></body></html>`;
  return {
    html,
    summary: "Built an immediate working random-number generator without waiting on the remote agent.",
    plan: [{ tool: "Browser Crypto API", action: "Generate an inclusive random integer.", reason: "This small browser-native build needs no external skill runtime." }],
    verification: ["Minimum and maximum inputs are editable.", "Generate number updates the result."],
  };
}

export async function buildWithPhiCodeAgent(args: {
  prompt: string;
  revisions: string[];
  currentHtml?: string;
  runId: string;
  snapshots: PhiCodeToolSnapshot[];
  intent?: InfinityIntent;
}) {
  const { prompt, revisions, currentHtml, runId, snapshots } = args;
  const intent: InfinityIntent = args.intent || "code";
  const userInstruction = [prompt, ...revisions.map((revision, index) => `REVISION ${index + 1}: ${revision}`)].join("\n");
  const common = !currentHtml ? commonBrowserArtifact(userInstruction) : null;
  if (common) {
    recordPhiCodeMove({ runId, phase: "plan", status: "success", tool: "Code Phi fast path", action: "Recognized a small browser-native build and skipped the remote GPT wait.", reason: common.summary });
    common.plan.forEach((step) => recordPhiCodeMove({ runId, phase: "execute", status: "success", tool: step.tool, repo: step.repo, action: step.action, reason: step.reason }));
    return common;
  }

  const watcher = phiCodeWatcherContext([prompt, ...revisions].join(" "));
  const importedSkills = importedPhiSkills(intent);
  const selected = capabilityAccessPlan(userInstruction, intent).slice(0, 8).map((cap) => ({
    name: cap.name,
    repo: cap.repo,
    use: cap.use,
    branch: cap.branch,
    score: cap.score,
    artifacts: cap.artifacts,
  }));
  const manual = await loadAgentManual(runId);
  const instruction = `You are the Infinity Phi GPT build arm for ${intent.toUpperCase()} intent. Build the requested working browser artifact, not a mock explanation.\n\nUSER BUILD REQUEST:\n${userInstruction}\n\nALL 15 IMPORTED PHI SKILLS — always available for selection:\n${JSON.stringify(importedSkills)}\n\nRANKED SKILLS FOR THIS REQUEST:\n${JSON.stringify(selected)}\n\nOPTIONAL REPOSITORY INSTRUCTION SNAPSHOTS:\n${JSON.stringify(compactSnapshots(snapshots))}\n\nCODE PHI SELF-INSTRUCTIONS:\n${JSON.stringify(manual)}\n\nWATCHER MEMORY FROM PRIOR SUCCESSFUL BUILDS:\n${JSON.stringify(watcher)}\n\n${currentHtml ? `CURRENT ARTIFACT TO REVISE:\n${currentHtml.slice(0, 14000)}\n` : ""}\nAGENT CONTRACT:\n1. All 15 imported Phi skills are indexed and selectable. Choose the smallest useful set for the request; repository snapshots are optional enrichment, not a prerequisite.\n2. Prefer the www-infinity4 fork named in the catalog when using an imported skill; upstream is provenance/reference.\n3. Never claim a package, fork, API, binary, server or library executed unless the generated artifact actually loads/uses it or runtime evidence confirms it.\n4. If a browser-compatible capability can be loaded safely from a public module/CDN/import, wire it into the artifact. Otherwise apply its documented design patterns with browser-native code and identify that in the plan.\n5. Produce one self-contained HTML artifact whenever possible. It must run inside an iframe srcDoc sandbox.\n6. Preserve working behavior during revisions unless the user asks to remove it.\n7. Do not place secrets, tokens, passwords or private keys in generated client code. Do not weaken browser security to make a library work.\n8. Return STRICT JSON only: {"plan":[{"tool":"name","repo":"owner/repo","action":"observable action","reason":"brief reason"}],"html":"<!doctype html>...","summary":"brief build summary","verification":["check 1","check 2"]}.`;

  recordPhiCodeMove({
    runId,
    phase: "plan",
    status: "start",
    tool: "GPT",
    action: `Sent the request with all ${importedSkills.length} imported Phi skills plus the ranked local plan.`,
    reason: "GPT receives the complete local capability catalog immediately; slow repository reads cannot gate the build.",
  });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9500);
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        input: instruction,
        context: {
          application: intent === "create" ? "Infinity Phi Create" : "Infinity Phi Code",
          assistant: "gpt",
          task: "phi_skill_orchestrator",
          intent,
          imported_skill_catalog: importedSkills,
          selected_capabilities: selected,
          repository_enrichment: snapshots.map((snapshot) => ({ name: snapshot.name, repo: snapshot.repo, use: snapshot.use, branch: snapshot.branch })),
          agent_manual: manual,
          watcher_memory: watcher,
          verified_context: { page: typeof location !== "undefined" ? location.href : "", interface_mode: intent, run_id: runId },
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("The Phi GPT build arm reached its 9.5-second network deadline. The page remains live and retry is available immediately.");
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  const output = String(payload.output_text || payload.output || "").trim();
  const result = normalizeResult(output);
  if (!result) throw new Error("The Phi GPT build arm returned no runnable HTML artifact.");

  recordPhiCodeMove({ runId, phase: "plan", status: "success", tool: "GPT", action: `Received a ${result.plan.length}-step structured build plan.`, reason: result.summary, durationMs: Date.now() - started });
  result.plan.forEach((step) => recordPhiCodeMove({ runId, phase: "execute", status: "success", tool: step.tool || "Phi", repo: step.repo, action: step.action || "Applied selected capability to the generated artifact.", reason: step.reason }));
  result.verification.forEach((check) => recordPhiCodeMove({ runId, phase: "verify", status: "success", tool: "Preview verifier", action: check, reason: "Verification requested by the structured agent response; final success still waits for the iframe load event." }));
  return result;
}

export function watchEventsForRun(runId: string, events: PhiCodeWatchEvent[]) {
  return events.filter((event) => event.runId === runId);
}
