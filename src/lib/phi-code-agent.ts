import { capabilityAccessPlan, type InfinityIntent } from "@/lib/coder-capabilities";
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

function rawCandidates(source: ReturnType<typeof capabilityAccessPlan>[number]) {
  const configured = source.inspect || [];
  const candidates = [
    "SKILL.md",
    "skill.md",
    "AGENTS.md",
    ".github/SKILL.md",
    ".github/AGENTS.md",
    "README.md",
    "package.json",
    ...configured,
  ];
  return [...new Set(candidates.filter((path) => path && !path.endsWith("/")))].slice(0, 10);
}

async function fetchText(url: string, timeoutMs = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "force-cache", signal: controller.signal });
    if (!response.ok) return "";
    return (await response.text()).slice(0, 12000);
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
  const text = await fetchText(url, 1800);
  if (!text) {
    recordPhiCodeMove({
      runId,
      phase: "read-skill",
      status: "warning",
      tool: "Code Phi agent manual",
      action: "The versioned self-instruction file was unavailable; the built-in agent contract remains active.",
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
      reason: "The agent rereads its execution/watcher rules on every build pass.",
      evidence: url,
    });
    return manual;
  } catch {
    return { raw: text.slice(0, 6000) };
  }
}

export async function loadPhiCodeToolInstructions(prompt: string, runId: string, intent: InfinityIntent = "code") {
  const plan = capabilityAccessPlan(prompt, intent).slice(0, 4);

  // Read candidate repository instructions concurrently. The old serial scan could
  // spend many seconds waiting on missing files before GPT ever saw the request.
  const snapshots = await Promise.all(plan.map(async (source) => {
    const started = Date.now();
    recordPhiCodeMove({
      runId,
      phase: "route",
      status: "success",
      tool: source.name,
      repo: source.repo,
      action: `Selected ${source.name} for ${source.use}`,
      reason: `Capability index score ${source.score}; selected from the current Code Phi request.`,
    });

    const candidates = rawCandidates(source).slice(0, 6);
    const results = await Promise.all(candidates.map(async (path) => {
      const directPath = path.replace(/^\/+/, "");
      const url = `${source.rawRoot}/${directPath}`;
      const text = await fetchText(url);
      return text ? { path: directPath, url, text } : null;
    }));
    const files = results.filter((item): item is PhiCodeToolSnapshot["files"][number] => Boolean(item)).slice(0, 3);

    recordPhiCodeMove({
      runId,
      phase: "read-skill",
      status: files.length ? "success" : "warning",
      tool: source.name,
      repo: source.repo,
      action: files.length
        ? `Read ${files.map((file) => file.path).join(", ")} from the indexed repository.`
        : "No readable root instruction file was returned; keep the capability metadata but do not pretend repository code executed.",
      reason: "Code Phi reads the selected repository instructions before asking GPT to build.",
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
    files: snapshot.files.map((file) => ({
      path: file.path,
      url: file.url,
      text: file.text.slice(0, 3500),
    })),
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
    summary: clean(parsed?.summary, 700) || "GPT built the preview from the indexed capability instructions.",
    plan,
    verification,
  };
}

export async function buildWithPhiCodeAgent(args: {
  prompt: string;
  revisions: string[];
  currentHtml?: string;
  runId: string;
  snapshots: PhiCodeToolSnapshot[];
}) {
  const { prompt, revisions, currentHtml, runId, snapshots } = args;
  const watcher = phiCodeWatcherContext([prompt, ...revisions].join(" "));
  const manual = await loadAgentManual(runId);
  const userInstruction = [prompt, ...revisions.map((revision, index) => `REVISION ${index + 1}: ${revision}`)].join("\n");
  const instruction = `You are the Code Phi build agent. Build the requested working browser artifact, not a mock explanation.\n\nCODE PHI SELF-INSTRUCTIONS (reread this run):\n${JSON.stringify(manual)}\n\nUSER BUILD REQUEST:\n${userInstruction}\n\nINDEXED CAPABILITY INSTRUCTIONS:\n${JSON.stringify(compactSnapshots(snapshots))}\n\nWATCHER MEMORY FROM PRIOR SUCCESSFUL BUILDS:\n${JSON.stringify(watcher)}\n\n${currentHtml ? `CURRENT ARTIFACT TO REVISE:\n${currentHtml.slice(0, 14000)}\n` : ""}\nAGENT CONTRACT:\n1. First choose the smallest useful set of indexed capabilities. Treat repository files above as real instructions/reference material.\n2. Never claim a fork, package, API, binary, server, or library executed unless the generated artifact actually loads/uses it or the supplied runtime confirms execution. Reading a repository is instruction use, not runtime execution.\n3. When a browser-compatible capability can be used from a public module/CDN/import, wire it into the artifact. Otherwise use its documented patterns to implement the requested behavior with browser-native code and identify the repository in the plan.\n4. Produce one self-contained HTML artifact whenever possible. It must run in an iframe with srcDoc.\n5. Preserve working behavior from the current artifact during revisions unless the user asks to remove it.\n6. The watcher needs concise observable reasons, not private chain-of-thought. Give one brief reason for each selected tool/action.\n7. Include verification checks that can be observed in the browser.\n8. Return STRICT JSON only with this shape: {"plan":[{"tool":"name","repo":"owner/repo","action":"observable action","reason":"brief reason"}],"html":"<!doctype html>...","summary":"brief build summary","verification":["check 1","check 2"]}.`;

  recordPhiCodeMove({
    runId,
    phase: "plan",
    status: "start",
    tool: "GPT",
    action: "Sent the current request, self-instruction manual, indexed capability instructions, prior successful watcher playbooks, and existing artifact to the Code Phi agent.",
    reason: "GPT is the orchestrator; the capability index and watcher memory supply its operating context.",
  });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        input: instruction,
        context: {
          application: "Infinity Phi Code",
          assistant: "gpt",
          task: "code_phi_tool_orchestrator",
          agent_manual: manual,
          indexed_capabilities: snapshots.map((snapshot) => ({ name: snapshot.name, repo: snapshot.repo, use: snapshot.use, branch: snapshot.branch })),
          watcher_memory: watcher,
          verified_context: { page: typeof location !== "undefined" ? location.href : "", interface_mode: "code", run_id: runId },
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Code Phi agent timed out instead of returning a build. Retry is available immediately.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  const output = String(payload.output_text || payload.output || "").trim();
  const result = normalizeResult(output);
  if (!result) throw new Error("Code Phi agent returned no runnable HTML artifact");

  recordPhiCodeMove({
    runId,
    phase: "plan",
    status: "success",
    tool: "GPT",
    action: `Received a ${result.plan.length}-step structured build plan.`,
    reason: result.summary,
    durationMs: Date.now() - started,
  });
  result.plan.forEach((step) => recordPhiCodeMove({
    runId,
    phase: "execute",
    status: "success",
    tool: step.tool || "Code Phi",
    repo: step.repo,
    action: step.action || "Applied selected capability to the generated artifact.",
    reason: step.reason,
  }));
  result.verification.forEach((check) => recordPhiCodeMove({
    runId,
    phase: "verify",
    status: "success",
    tool: "Preview verifier",
    action: check,
    reason: "Verification requested by the structured agent response; final success still waits for the iframe load event.",
  }));
  return result;
}

export function watchEventsForRun(runId: string, events: PhiCodeWatchEvent[]) {
  return events.filter((event) => event.runId === runId);
}
