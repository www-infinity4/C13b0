"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ExternalLink, RefreshCw, Save, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { capabilitiesFor, type InfinityIntent } from "@/lib/coder-capabilities";
import { buildWithPhiCodeAgent, importedPhiSkills, loadPhiCodeToolInstructions, type PhiCodeToolSnapshot } from "@/lib/phi-code-agent";

const PROJECT_KEY = "infinity_code_projects_v3";
const clean = (value: unknown, max = 1800) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

function fallbackArtifact(prompt: string, message = "") {
  const title = escapeHtml(clean(prompt, 500) || "Phi build");
  const note = escapeHtml(clean(message, 600));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#071521;color:#eef8ff;font-family:system-ui,sans-serif}.shell{width:min(92vw,880px);margin:auto;padding:42px 20px}.tag{font-weight:950;letter-spacing:.14em;color:#63e39b}h1{font-size:clamp(34px,7vw,68px);line-height:1;margin:14px 0}.card{margin-top:24px;padding:22px;border:1px solid #31536a;border-radius:20px;background:#0d2434}.note{color:#ffd878}</style></head><body><main class="shell"><div class="tag">PHI GPT ARM</div><h1>${title}</h1><section class="card"><b>Responsive fallback</b><p>The editor stayed available while the remote build pass stopped or reached its network deadline. The imported skill index remains loaded and retry is available immediately.</p>${note ? `<p class="note">${note}</p>` : ""}</section></main></body></html>`;
}

export default function PhiCodeBuilderStable({ intentOverride }: { intentOverride?: InfinityIntent } = {}) {
  const [intent] = useState<InfinityIntent>(() => {
    if (intentOverride) return intentOverride;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("intent") === "create") return "create";
    return "code";
  });
  const importedSkills = importedPhiSkills(intent);
  const [prompt, setPrompt] = useState("");
  const [revision, setRevision] = useState("");
  const [revisions, setRevisions] = useState<string[]>([]);
  const [html, setHtml] = useState("");
  const [snapshots, setSnapshots] = useState<PhiCodeToolSnapshot[]>([]);
  const [plannedTools, setPlannedTools] = useState<string[]>([]);
  const [building, setBuilding] = useState(false);
  const [status, setStatus] = useState(`${importedSkills.length} imported Phi skills are indexed and ready.`);
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState("");
  const [previewRevision, setPreviewRevision] = useState(0);
  const buildSerial = useRef(0);

  useEffect(() => {
    const initial = clean(new URLSearchParams(location.search).get("q") || "", 1800);
    if (!initial) return;
    setPrompt(initial);
    setPlannedTools(capabilitiesFor(initial, intent).slice(0, 8).map((cap) => cap.name));
    setStatus(`${importedSkills.length} imported skills indexed. GPT is selecting the best ones for this ${intent} request.`);
    const timer = window.setTimeout(() => void runBuild(initial, [], ""), 40);
    return () => window.clearTimeout(timer);
    // Initial URL request runs once. Later builds are explicit submissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runBuild(basePrompt: string, nextRevisions: string[], existingHtml: string) {
    const request = clean(basePrompt, 1800);
    if (!request) return;
    const serial = ++buildSerial.current;
    const runId = `${intent}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const fullRequest = [request, ...nextRevisions].join("\n");
    const localPlan = capabilitiesFor(fullRequest, intent).slice(0, 8).map((cap) => cap.name);
    setPlannedTools(localPlan);
    setBuilding(true);
    setSaved("");
    setSummary("");
    setStatus(`${importedSkills.length} imported skills are available to GPT. Reading only the most relevant optional repo instructions…`);

    let toolSnapshots: PhiCodeToolSnapshot[] = [];
    try {
      toolSnapshots = await loadPhiCodeToolInstructions(fullRequest, runId, intent);
      if (serial !== buildSerial.current) return;
      setSnapshots(toolSnapshots);
    } catch (error) {
      if (serial !== buildSerial.current) return;
      setSnapshots([]);
      const message = error instanceof Error ? error.message : "Optional repository enrichment was unavailable.";
      setSummary(`${message} GPT still has the complete local 15-skill catalog.`);
    }

    setStatus(`Building with GPT. All ${importedSkills.length} imported skills remain selectable; repo reads cannot block this pass.`);
    try {
      const result = await buildWithPhiCodeAgent({
        prompt: request,
        revisions: nextRevisions,
        currentHtml: existingHtml,
        runId,
        snapshots: toolSnapshots,
        intent,
      });
      if (serial !== buildSerial.current) return;
      setHtml(result.html);
      setSummary(result.summary);
      setPreviewRevision((value) => value + 1);
      setStatus("Build complete. The GPT arm returned a runnable artifact and the editor stayed live.");
    } catch (error) {
      if (serial !== buildSerial.current) return;
      const message = error instanceof Error ? error.message : "The Phi build pass stopped.";
      setHtml(existingHtml || fallbackArtifact(request, message));
      setSummary(message);
      setPreviewRevision((value) => value + 1);
      setStatus("The remote build stopped safely. No old request is left running; edit the request or retry.");
    } finally {
      if (serial === buildSerial.current) setBuilding(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (building) return;
    const request = clean(prompt, 1800);
    if (!request) return;
    setPrompt(request);
    setRevisions([]);
    await runBuild(request, [], "");
  }

  async function iterate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (building) return;
    const next = clean(revision, 1800);
    if (!next) return;
    const nextRevisions = [...revisions, next];
    setRevisions(nextRevisions);
    setRevision("");
    await runBuild(prompt, nextRevisions, html);
  }

  function retry() {
    if (!building && prompt.trim()) void runBuild(prompt, revisions, html);
  }

  function save() {
    if (!html) return;
    const project = { prompt, revisions, html, updatedAt: Date.now(), intent, tools: snapshots.map((item) => item.repo), plannedTools, importedSkills: importedSkills.map((item) => item.repo) };
    try {
      const prior = JSON.parse(localStorage.getItem(PROJECT_KEY) || "[]");
      const list = Array.isArray(prior) ? prior : [];
      localStorage.setItem(PROJECT_KEY, JSON.stringify([project, ...list].slice(0, 24)));
      setSaved("Saved on this device.");
    } catch {
      setSaved("The browser could not save this build locally.");
    }
  }

  function download() {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${clean(prompt, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "phi-build"}.html`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function openPreview() {
    if (!html) return;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const pageStyle: React.CSSProperties = { minHeight: "100dvh", background: "#06131d", color: "#edf7ff", fontFamily: "system-ui, sans-serif" };
  const panelStyle: React.CSSProperties = { border: "1px solid #29495d", borderRadius: 18, background: "#0b2130", padding: 18, minWidth: 0 };
  const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #3b6279", borderRadius: 14, background: "#061722", color: "white", padding: 13, font: "inherit" };
  const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 12, background: "#55df91", color: "#04160d", padding: "11px 14px", fontWeight: 900, cursor: "pointer" };
  const armName = intent === "create" ? "Create Phi GPT arm" : "Code Phi";

  return (
    <main style={pageStyle}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", borderBottom: "1px solid #213e50", position: "sticky", top: 0, zIndex: 20, background: "#06131df2", backdropFilter: "blur(10px)" }}>
        <a href={appPath("phi")} style={{ color: "white", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}><ArrowLeft size={18} /><b>{armName}</b></a>
        <span style={{ fontSize: 12, fontWeight: 900, color: building ? "#ffd66f" : "#67e49b" }}>{building ? "BUILDING · EDITOR LIVE" : `${importedSkills.length} SKILLS READY`}</span>
      </header>

      <section style={{ width: "min(1180px, 96vw)", margin: "0 auto", padding: "20px 0 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: 16 }}>
        <section style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}><Sparkles size={22} /><div><b>AI build agent</b><div style={{ color: "#91adbd", fontSize: 12 }}>GPT + all 15 imported Phi skills, with non-blocking repo enrichment</div></div></div>

          <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
            <label htmlFor="phi-code-prompt" style={{ fontWeight: 850 }}>What should {armName} build?</label>
            <textarea id="phi-code-prompt" rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the app, game, tool, website, document workspace, media tool, or interaction" style={{ ...inputStyle, resize: "vertical" }} />
            <button disabled={building || !prompt.trim()} style={{ ...buttonStyle, opacity: building || !prompt.trim() ? .55 : 1 }}>{building ? "Building…" : `Build with ${armName}`}</button>
          </form>

          <div role="status" style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#071925", color: "#c3d6e1", lineHeight: 1.45 }}>{status}</div>
          {summary ? <p style={{ color: "#9fb9c8", lineHeight: 1.5 }}>{summary}</p> : null}

          <div style={{ marginTop: 16 }}>
            <small style={{ color: "#c89cff", fontWeight: 900 }}>SELECTED FOR THIS BUILD</small>
            <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", gap: 7 }}>
              {plannedTools.length ? plannedTools.map((item) => <span key={item} style={{ padding: "6px 9px", borderRadius: 999, background: "#17152c", border: "1px solid #5f4b84", fontSize: 12 }}>{item}</span>) : <span style={{ color: "#7897a7", fontSize: 13 }}>Describe a build to rank skills.</span>}
            </div>
          </div>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: "#6fe39e", fontWeight: 900 }}>ALL {importedSkills.length} IMPORTED SKILLS INDEXED</summary>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {importedSkills.map((item) => <span key={item.repo} title={item.repo} style={{ padding: "5px 8px", borderRadius: 999, background: "#071925", border: "1px solid #29495d", fontSize: 11 }}>{item.name}</span>)}
            </div>
          </details>

          <div style={{ marginTop: 16 }}>
            <small style={{ color: "#6fe39e", fontWeight: 900 }}>OPTIONAL REPOSITORY ENRICHMENT</small>
            <div style={{ marginTop: 7, display: "grid", gap: 7 }}>
              {snapshots.length ? snapshots.map((item) => <div key={`${item.repo}:${item.name}`} style={{ padding: 9, borderRadius: 10, background: "#071925" }}><b>{item.name}</b><div style={{ color: "#86a5b5", fontSize: 12 }}>{item.repo} · {item.files.length} instruction file{item.files.length === 1 ? "" : "s"}</div></div>) : <div style={{ color: "#7897a7", fontSize: 13 }}>The build does not wait for repository reads. The local 15-skill catalog is already available.</div>}
            </div>
          </div>

          <form onSubmit={iterate} style={{ display: "grid", gap: 9, marginTop: 18 }}>
            <label htmlFor="phi-code-revision" style={{ fontWeight: 850 }}>Change the current build</label>
            <textarea id="phi-code-revision" rows={3} value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Add a feature or tell GPT what to change" style={{ ...inputStyle, resize: "vertical" }} />
            <button disabled={building || !html || !revision.trim()} style={{ ...buttonStyle, opacity: building || !html || !revision.trim() ? .55 : 1 }}>Run revision</button>
          </form>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={retry} disabled={building || !prompt.trim()} style={buttonStyle}><RefreshCw size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Retry</button>
            <button type="button" onClick={save} disabled={!html} style={buttonStyle}><Save size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Save</button>
            <button type="button" onClick={download} disabled={!html} style={buttonStyle}><Download size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />HTML</button>
            <button type="button" onClick={openPreview} disabled={!html} style={buttonStyle}><ExternalLink size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Open</button>
          </div>
          {saved ? <div style={{ marginTop: 10, color: "#6fe39e" }}>{saved}</div> : null}
        </section>

        <section style={{ ...panelStyle, padding: 0, overflow: "hidden", minHeight: "68dvh" }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid #29495d", display: "flex", justifyContent: "space-between", gap: 8 }}><b>Live artifact</b><span style={{ color: "#83a2b2", fontSize: 12 }}>{building ? "working without freezing" : html ? "preview ready" : "waiting for a build"}</span></div>
          <iframe key={`stable-code-preview-${previewRevision}`} title="Phi generated preview" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" srcDoc={html || fallbackArtifact(prompt)} style={{ width: "100%", minHeight: "64dvh", border: 0, background: "white" }} />
        </section>
      </section>
    </main>
  );
}
