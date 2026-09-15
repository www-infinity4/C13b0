"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, ExternalLink, RefreshCw, Save, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { buildWithPhiCodeAgent, loadPhiCodeToolInstructions, type PhiCodeToolSnapshot } from "@/lib/phi-code-agent";
import {
  learnPhiCodePlaybook,
  newPhiCodeRunId,
  readPhiCodeMoves,
  recordPhiCodeMove,
  type PhiCodeWatchEvent,
} from "@/lib/phi-code-watcher";
import styles from "./PhiCodeBuilder.module.css";

type SavedProject = {
  id: string;
  prompt: string;
  revisions: string[];
  html: string;
  tools: string[];
  updatedAt: number;
};

const PROJECT_KEY = "infinity_code_projects_v2";
const clean = (value: unknown, max = 1200) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

function fallbackArtifact(prompt: string, error = "") {
  const safe = clean(prompt, 500).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
  const note = clean(error, 240).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#071521;color:#eaf6ef;font-family:Arial,sans-serif}.shell{max-width:900px;margin:auto;padding:32px}.card{margin-top:18px;padding:22px;border:1px solid #28516a;border-radius:22px;background:#0d2434}h1{font-size:clamp(34px,7vw,68px);margin:0}.tag{color:#69df97;font-weight:900}.warn{color:#ffd875}</style></head><body><main class="shell"><div class="tag">CODE PHI</div><h1>${safe || "Build request"}</h1><section class="card"><b>Agent fallback</b><p>The GPT tool-orchestration pass did not return a runnable artifact. Your request and watcher trace were preserved so the next pass can retry without pretending a tool ran.</p>${note ? `<p class="warn">${note}</p>` : ""}</section></main></body></html>`;
}

function loadProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveProject(project: SavedProject) {
  try {
    const existing = loadProjects();
    localStorage.setItem(PROJECT_KEY, JSON.stringify([project, ...existing.filter((item: SavedProject) => item.id !== project.id)].slice(0, 24)));
  } catch {}
}

export default function PhiCodeBuilderV3() {
  const [prompt, setPrompt] = useState("");
  const [revision, setRevision] = useState("");
  const [revisions, setRevisions] = useState<string[]>([]);
  const [html, setHtml] = useState("");
  const [building, setBuilding] = useState(false);
  const [status, setStatus] = useState("Preparing Code Phi…");
  const [snapshots, setSnapshots] = useState<PhiCodeToolSnapshot[]>([]);
  const [events, setEvents] = useState<PhiCodeWatchEvent[]>([]);
  const [activeRun, setActiveRun] = useState("");
  const [pendingSuccessRun, setPendingSuccessRun] = useState("");
  const [saved, setSaved] = useState("");
  const [summary, setSummary] = useState("");
  const buildSerial = useRef(0);

  const fullRequest = useMemo(() => [prompt, ...revisions].filter(Boolean).join("\n"), [prompt, revisions]);
  const activeEvents = useMemo(() => events.filter((event) => event.runId === activeRun).slice(-30), [events, activeRun]);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("q") || "Build an interactive Infinity app";
    setPrompt(q);
    setEvents(readPhiCodeMoves(100));
    const onWatch = (event: Event) => {
      const move = (event as CustomEvent<PhiCodeWatchEvent>).detail;
      if (move) setEvents((current) => [...current, move].slice(-120));
    };
    window.addEventListener("infinityphi:code-watch", onWatch);
    return () => window.removeEventListener("infinityphi:code-watch", onWatch);
  }, []);

  useEffect(() => {
    if (!prompt) return;
    void runBuild(prompt, [], "");
    // Initial query should build once; later passes are explicit revisions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  async function runBuild(basePrompt: string, nextRevisions: string[], existingHtml: string) {
    const serial = ++buildSerial.current;
    const runId = newPhiCodeRunId();
    setActiveRun(runId);
    setPendingSuccessRun("");
    setBuilding(true);
    setSaved("");
    setSummary("");
    setStatus("Routing the request through the indexed capability catalog…");

    try {
      const toolSnapshots = await loadPhiCodeToolInstructions([basePrompt, ...nextRevisions].join("\n"), runId, "code");
      if (serial !== buildSerial.current) return;
      setSnapshots(toolSnapshots);
      setStatus("GPT is reading the selected skill instructions and building with the tool plan…");
      const result = await buildWithPhiCodeAgent({
        prompt: basePrompt,
        revisions: nextRevisions,
        currentHtml: existingHtml,
        runId,
        snapshots: toolSnapshots,
      });
      if (serial !== buildSerial.current) return;
      setHtml(result.html);
      setSummary(result.summary);
      setPendingSuccessRun(runId);
      setStatus("Artifact generated. Verifying the live iframe now…");
    } catch (error) {
      if (serial !== buildSerial.current) return;
      const message = error instanceof Error ? error.message : "Code Phi build failed";
      recordPhiCodeMove({
        runId,
        phase: "error",
        status: "error",
        tool: "Code Phi agent",
        action: "The build pass stopped without a verified runnable GPT artifact.",
        reason: message,
      });
      setHtml(existingHtml || fallbackArtifact(basePrompt, message));
      setSummary(message);
      setStatus("The watcher preserved the failed pass. Retry will reuse the recorded context without claiming success.");
      setBuilding(false);
    }
  }

  function verifyPreviewLoaded() {
    if (!pendingSuccessRun) return;
    recordPhiCodeMove({
      runId: pendingSuccessRun,
      phase: "verify",
      status: "success",
      tool: "iframe srcDoc",
      action: "Generated HTML loaded successfully in the live Code Phi preview iframe.",
      reason: "The browser fired the preview load event for the generated artifact.",
    });
    recordPhiCodeMove({
      runId: pendingSuccessRun,
      phase: "result",
      status: "success",
      tool: "Code Phi",
      action: "Completed a GPT-orchestrated build using the indexed capability instructions and watcher trace.",
      reason: summary || "The generated artifact reached the live preview.",
    });
    learnPhiCodePlaybook(pendingSuccessRun, fullRequest);
    setPendingSuccessRun("");
    setBuilding(false);
    setStatus("Verified. This run is now documented as a reusable Code Phi playbook.");
  }

  async function iterate(event: FormEvent) {
    event.preventDefault();
    const next = clean(revision, 1600);
    if (!next || building) return;
    const nextRevisions = [...revisions, next];
    setRevisions(nextRevisions);
    setRevision("");
    await runBuild(prompt, nextRevisions, html);
  }

  function retry() {
    if (building) return;
    void runBuild(prompt, revisions, html);
  }

  function save() {
    const project: SavedProject = {
      id: `code-${Date.now().toString(36)}`,
      prompt,
      revisions,
      html,
      tools: snapshots.map((snapshot) => `${snapshot.name} · ${snapshot.repo}`),
      updatedAt: Date.now(),
    };
    saveProject(project);
    setSaved(`Saved with ${project.tools.length} indexed tool record${project.tools.length === 1 ? "" : "s"} and its watcher playbook.`);
  }

  function download() {
    const blob = new Blob([html || fallbackArtifact(prompt)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${clean(prompt, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "code-phi"}.html`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function openPreview() {
    const blob = new Blob([html || fallbackArtifact(prompt)], { type: "text/html;charset=utf-8" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  }

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <a href={appPath("phi")}><ArrowLeft size={18} /><span><b>Code Phi</b><small>GPT + indexed tools + watcher</small></span></a>
        <div />
        <span className={styles.live}>{building ? "AGENT RUNNING" : "WATCHER READY"}</span>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.console}>
          <div className={styles.consoleHead}>
            <Sparkles size={23} />
            <div><b>AI build agent</b><small>GPT chooses from the indexed capability catalog, reads the selected repository instructions, builds the artifact, verifies it, and records every observable move.</small></div>
          </div>

          <div className={styles.prompt}>
            <small>CURRENT BUILD</small>
            <p>{prompt || "Reading request…"}</p>
          </div>

          <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
            <small style={{ color: "#64d990", fontWeight: 950, letterSpacing: ".1em" }}>INDEXED TOOLS READ THIS PASS</small>
            {snapshots.length ? snapshots.map((snapshot) => (
              <div key={`${snapshot.repo}:${snapshot.name}`} style={{ padding: 10, border: "1px solid #24485b", borderRadius: 12, background: "#0d2434" }}>
                <b>{snapshot.name}</b>
                <div style={{ color: "#8fb3a1", fontSize: 12, marginTop: 3 }}>{snapshot.repo}</div>
                <div style={{ color: "#b9cbd5", fontSize: 12, marginTop: 5 }}>{snapshot.files.length ? `Read: ${snapshot.files.map((file) => file.path).join(", ")}` : "Capability indexed; no root instruction file returned."}</div>
              </div>
            )) : <div style={{ color: "#8fa9b9", fontSize: 13 }}>Routing capability index…</div>}
          </div>

          <div className={styles.steps}>
            <small style={{ color: "#64d990", fontWeight: 950, letterSpacing: ".1em", marginBottom: 4 }}>AI WATCHER · DOCUMENTED MOVES</small>
            {activeEvents.length ? activeEvents.map((move) => (
              <div className={styles.step} key={move.id}>
                <span>{move.status === "success" ? <Check size={13} /> : move.status === "error" ? "!" : <RefreshCw size={12} className={move.status === "start" ? styles.spin : ""} />}</span>
                <p><b>{move.phase}{move.tool ? ` · ${move.tool}` : ""}</b><br />{move.action}{move.repo ? <><br /><small>{move.repo}</small></> : null}{move.reason ? <><br /><small>{move.reason}</small></> : null}</p>
              </div>
            )) : <div className={styles.step}><span><RefreshCw size={12} className={styles.spin} /></span><p>{status}</p></div>}
          </div>

          <div className={styles.saved} style={{ marginTop: 16 }}>{status}</div>
          {summary ? <div style={{ marginTop: 10, color: "#b9cbd5", fontSize: 13, lineHeight: 1.45 }}>{summary}</div> : null}

          <form className={styles.iterate} onSubmit={iterate}>
            <label htmlFor="phi-code-revision">Tell GPT what to change next</label>
            <textarea id="phi-code-revision" value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Add a feature, change behavior, use another indexed tool…" />
            <button disabled={building || !revision.trim()}>{building ? "Building with tools…" : "Run next AI iteration"}</button>
          </form>

          <div className={styles.actions}>
            <button type="button" onClick={retry} disabled={building}><RefreshCw size={15} /> Retry</button>
            <button type="button" onClick={save} disabled={!html}><Save size={15} /> Save</button>
            <button type="button" onClick={download} disabled={!html}><Download size={15} /> HTML</button>
            <button type="button" onClick={openPreview} disabled={!html}><ExternalLink size={15} /> Open</button>
          </div>
          {saved ? <div className={styles.saved} style={{ marginTop: 10 }}>{saved}</div> : null}
        </aside>

        <section className={styles.preview}>
          <div className={styles.previewTop}><b>Live artifact</b><span>{building ? "GPT/tool pass in progress" : "verified iframe preview"}</span></div>
          <iframe
            title="Code Phi generated preview"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
            srcDoc={html || fallbackArtifact(prompt)}
            onLoad={verifyPreviewLoaded}
          />
        </section>
      </section>
    </main>
  );
}
