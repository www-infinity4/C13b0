"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "@puckeditor/core/puck.css";
import { Puck, Render, type Data } from "@puckeditor/core";
import { Check, ChevronLeft, Eye, Pencil, Sparkles } from "lucide-react";
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
function cleanText(value: string, sentence = false) {
  const text = value.trim().replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1");
  if (!text) return text;
  const capitalized = text[0].toUpperCase() + text.slice(1);
  return sentence && capitalized.length > 24 && !/[.!?]$/.test(capitalized) ? `${capitalized}.` : capitalized;
}
function polishPage(input: PuckData): PuckData {
  const copy = structuredClone(input);
  for (const block of copy.content) {
    const props = block.props as Record<string, unknown>;
    for (const key of ["eyebrow", "title", "text", "label", "caption", "alt"]) if (typeof props[key] === "string") props[key] = cleanText(props[key] as string);
    for (const key of ["subtitle", "body"]) if (typeof props[key] === "string") props[key] = cleanText(props[key] as string, true);
    if (Array.isArray(props.cards)) props.cards = props.cards.map(card => ({...card,title:cleanText(String(card.title||"")),body:cleanText(String(card.body||""),true)}));
  }
  return copy;
}
function starterData(title: string, summary: string, ideas: string[]): PuckData {
  return {
    root: { props: {} },
    content: [
      {
        type: "Hero",
        props: { id: "hero-1", eyebrow: "A focused Infinity project", title: cleanText(title || "Your project title"), subtitle: cleanText(summary || "A clear introduction to this project and why it matters.", true) },
      },
      { type: "Heading", props: { id: "heading-1", text: "What this project makes possible", level: "h2" } },
      { type: "Text", props: { id: "text-1", text: "Start with the strongest useful idea, explain it clearly, and give visitors an obvious next step." } },
      {
        type: "CardGrid",
        props: {
          id: "cards-1",
          cards: (ideas.length ? ideas : ["Define the goal.", "Choose the format.", "Publish a first version."])
            .slice(0, 4)
            .map((idea, i) => ({ title: `Direction ${i + 1}`, body: cleanText(idea, true) })),
        },
      },
      { type: "CTAButton", props: { id: "cta-1", label: "Explore the next step", href: "#" } },
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
    const polished=polishPage(next);
    setData(polished);
    savePage({ id, title: cleanText(heading), data: polished, updatedAt: new Date().toISOString() });
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
    <div className="min-h-screen bg-[#eef2f6] text-slate-950">
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur-xl sm:px-7">
        <Link href="../../spark/" className="flex items-center gap-2 text-slate-600 hover:text-slate-950">
          <ChevronLeft />
          Infinity
        </Link>
        <div className="min-w-0 flex-1 truncate text-center font-serif text-lg font-black sm:text-xl">
          {heading}
          <span className="ml-2 font-sans text-xs font-normal text-slate-400">Website builder</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-bold shadow-sm"
          >
            {mode === "edit" ? <Eye size={16} /> : <Pencil size={16} />}
            {mode === "edit" ? "Preview" : "Edit"}
          </button>
          {saved && <span className="flex items-center gap-1 text-sm font-bold text-emerald-600"><Check size={15}/>Saved</span>}
        </div>
      </header>
      {mode === "edit" ? (
        <div className="puck-shell [&_.PuckCanvas-root]:bg-[#f7f8fa]">
          <Puck config={puckConfig} data={data} onPublish={handlePublish} />
        </div>
      ) : (
        <main className="published-preview mx-auto max-w-6xl px-3 py-6 sm:px-8 sm:py-10 [&_.edit-mark]:hidden">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500"><Sparkles size={16}/>Finished-page preview</div><Render config={puckConfig} data={data} />
        </main>
      )}
    </div>
  );
}
