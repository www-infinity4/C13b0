"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "@puckeditor/core/puck.css";
import { Puck, Render, type Data } from "@puckeditor/core";
import { ChevronLeft, Eye, Pencil } from "lucide-react";
import { puckConfig, type InfinityPuckProps } from "./puck-config";

const DRAFTS = "c13b0_infinity_studio_drafts_v1";
const PAGES = "c13b0_infinity_puck_pages_v1";

type StudioDraft = { id?: string; title?: string; summary?: string; research?: { engineering?: string[]; opportunities?: string[] } };
type PuckData = Data<InfinityPuckProps>;
type PuckPageRecord = { id: string; title: string; data: PuckData; updatedAt: string };

function readDrafts(): StudioDraft[] {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS) || "[]");
  } catch {
    return [];
  }
}
function readPages(): Record<string, PuckPageRecord> {
  try {
    return JSON.parse(localStorage.getItem(PAGES) || "{}");
  } catch {
    return {};
  }
}
function savePage(record: PuckPageRecord) {
  const all = readPages();
  all[record.id] = record;
  try {
    localStorage.setItem(PAGES, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}
function starterData(title: string, summary: string, ideas: string[]): PuckData {
  return {
    root: { props: {} },
    content: [
      {
        type: "Hero",
        props: { id: "hero-1", eyebrow: "Built with Infinity", title: title || "Your project title", subtitle: summary || "A short description of this page." },
      },
      { type: "Heading", props: { id: "heading-1", text: "Working directions", level: "h2" } },
      {
        type: "CardGrid",
        props: {
          id: "cards-1",
          cards: (ideas.length ? ideas : ["Define the goal.", "Choose the format.", "Publish a first version."])
            .slice(0, 4)
            .map((idea, i) => ({ title: `Direction ${i + 1}`, body: idea })),
        },
      },
      { type: "CTAButton", props: { id: "cta-1", label: "Get in touch", href: "#" } },
    ],
    zones: {},
  };
}

export default function PuckBuilder() {
  const [ready, setReady] = useState(false);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [data, setData] = useState<PuckData | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const draftId = params.get("id") || crypto.randomUUID();
    const drafts = readDrafts();
    const draft = drafts.find((d) => d.id === draftId);
    const pages = readPages();
    const existing = pages[draftId];
    const initialTitle = draft?.title || params.get("query") || "Untitled page";
    setId(draftId);
    setTitle(initialTitle);
    setData(
      existing?.data ||
        starterData(initialTitle, draft?.summary || "", draft?.research?.engineering || draft?.research?.opportunities || [])
    );
    setReady(true);
  }, []);

  const heading = useMemo(() => title || "Untitled page", [title]);

  function handlePublish(next: PuckData) {
    setData(next);
    savePage({ id, title: heading, data: next, updatedAt: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  if (!ready || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061a30] text-white/60">
        Loading page builder…
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#061a30] text-white">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#061a30]/95 px-4 backdrop-blur-xl sm:px-7">
        <Link href="../../spark/" className="flex items-center gap-2 text-white/75 hover:text-white">
          <ChevronLeft />
          Infinity
        </Link>
        <div className="min-w-0 flex-1 truncate text-center font-serif text-lg font-black sm:text-xl">
          {heading}
          <span className="ml-2 font-sans text-xs font-normal text-white/40">Page builder</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 font-bold"
          >
            {mode === "edit" ? <Eye size={16} /> : <Pencil size={16} />}
            {mode === "edit" ? "Preview" : "Edit"}
          </button>
          {saved && <span className="text-sm font-bold text-emerald-400">Saved</span>}
        </div>
      </header>
      {mode === "edit" ? (
        <div className="puck-shell">
          <Puck config={puckConfig} data={data} onPublish={handlePublish} />
        </div>
      ) : (
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
          <Render config={puckConfig} data={data} />
        </main>
      )}
    </div>
  );
}
