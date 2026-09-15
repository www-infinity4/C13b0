export type PhiCodeWatchPhase =
  | "route"
  | "read-skill"
  | "plan"
  | "execute"
  | "verify"
  | "result"
  | "error";

export type PhiCodeWatchEvent = {
  id: string;
  runId: string;
  at: number;
  phase: PhiCodeWatchPhase;
  status: "start" | "success" | "warning" | "error";
  tool?: string;
  repo?: string;
  action: string;
  reason?: string;
  evidence?: string;
  durationMs?: number;
};

export type PhiCodePlaybook = {
  id: string;
  pattern: string;
  tools: string[];
  repos: string[];
  steps: string[];
  successes: number;
  updatedAt: number;
};

const TRACE_KEY = "infinity_phi_code_watcher_v1";
const PLAYBOOK_KEY = "infinity_phi_code_playbook_v1";
const MAX_EVENTS = 360;
const MAX_PLAYBOOKS = 40;

const clean = (value: unknown, max = 900) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function newPhiCodeRunId() {
  return `phi-code-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function recordPhiCodeMove(event: Omit<PhiCodeWatchEvent, "id" | "at">) {
  const full: PhiCodeWatchEvent = {
    ...event,
    id: `move-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    action: clean(event.action, 900),
    reason: clean(event.reason, 700),
    evidence: clean(event.evidence, 1000),
  };
  const events = readJson<PhiCodeWatchEvent[]>(TRACE_KEY, []);
  writeJson(TRACE_KEY, [...events, full].slice(-MAX_EVENTS));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("infinityphi:code-watch", { detail: full }));
  return full;
}

export function readPhiCodeMoves(limit = 80) {
  return readJson<PhiCodeWatchEvent[]>(TRACE_KEY, []).slice(-Math.max(1, limit));
}

export function readPhiCodePlaybooks(limit = 12) {
  return readJson<PhiCodePlaybook[]>(PLAYBOOK_KEY, [])
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(1, limit));
}

function promptPattern(prompt: string) {
  return clean(prompt, 220)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "url")
    .replace(/\b\d+(?:\.\d+)?\b/g, "#")
    .replace(/[^a-z0-9# +.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function learnPhiCodePlaybook(runId: string, prompt: string) {
  const events = readPhiCodeMoves(MAX_EVENTS).filter((event) => event.runId === runId && event.status !== "error");
  if (!events.some((event) => event.phase === "result" && event.status === "success")) return null;

  const tools = [...new Set(events.map((event) => clean(event.tool, 100)).filter(Boolean))];
  const repos = [...new Set(events.map((event) => clean(event.repo, 180)).filter(Boolean))];
  const steps = events
    .filter((event) => ["route", "read-skill", "plan", "execute", "verify", "result"].includes(event.phase))
    .map((event) => `${event.phase}: ${clean(event.action, 280)}${event.tool ? ` [${clean(event.tool, 80)}]` : ""}`)
    .filter((step, index, all) => all.indexOf(step) === index)
    .slice(0, 18);

  const pattern = promptPattern(prompt);
  if (!pattern) return null;
  const existing = readJson<PhiCodePlaybook[]>(PLAYBOOK_KEY, []);
  const prior = existing.find((item) => item.pattern === pattern);
  const playbook: PhiCodePlaybook = {
    id: prior?.id || `playbook-${Date.now().toString(36)}`,
    pattern,
    tools,
    repos,
    steps,
    successes: (prior?.successes || 0) + 1,
    updatedAt: Date.now(),
  };
  const next = [playbook, ...existing.filter((item) => item.pattern !== pattern)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PLAYBOOKS);
  writeJson(PLAYBOOK_KEY, next);
  return playbook;
}

export function phiCodeWatcherContext(prompt: string) {
  const pattern = promptPattern(prompt);
  const playbooks = readPhiCodePlaybooks(10)
    .map((item) => {
      const patternWords = new Set(pattern.split(" ").filter((word) => word.length > 2));
      const hits = item.pattern.split(" ").filter((word) => patternWords.has(word)).length;
      return { ...item, match: hits };
    })
    .filter((item) => item.match > 0)
    .sort((a, b) => b.match - a.match || b.successes - a.successes)
    .slice(0, 4)
    .map(({ pattern: learnedPattern, tools, repos, steps, successes }) => ({ learnedPattern, tools, repos, steps, successes }));

  const recent = readPhiCodeMoves(36).map(({ phase, status, tool, repo, action, reason }) => ({
    phase, status, tool, repo, action, reason,
  }));

  return { playbooks, recent };
}
