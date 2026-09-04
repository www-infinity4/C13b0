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
const APP_BASE=(process.env.NEXT_PUBLIC_APP_BASE||"").replace(/\/+$/,'');

type Research = { title?:string; dek?:string; overview?:string; keyTakeaways?:string[]; engineering?:string[]; findings?:string[]; context?:string[]; opportunities?:string[]; cautions?:string[]; sources?:{title:string;url:string}[] };
type StudioDraft = { id?: string; title?: string; summary?: string; research?: Research };
type PuckData = Data<InfinityPuckProps>;
type PuckPageRecord = { id: string; title: string; data: PuckData; updatedAt: string };
type VisualAsset = { url:string; alt:string; caption:string; sourceUrl:string };
type Pattern = "magazine" | "product" | "dashboard" | "field-guide" | "research";
const patterns:{id:Pattern;label:string;note:string}[]=[
  {id:"magazine",label:"Magazine article",note:"Headline, standfirst, evidence, related stories"},
  {id:"product",label:"Product launch",note:"Promise, benefits, proof, action"},
  {id:"dashboard",label:"Technical dashboard",note:"Status, metrics, decisions, next action"},
  {id:"field-guide",label:"Visual field guide",note:"Introduction, specimens, notes, references"},
  {id:"research",label:"Research brief",note:"Question, findings, cautions, sources"},
];

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
function stripHtml(value:string){return value.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\s+/g," ").trim()}
async function findReusableImages(topic:string):Promise<VisualAsset[]>{
  try{
    const endpoint=new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search=new URLSearchParams({action:"query",generator:"search",gsrsearch:topic,gsrnamespace:"6",gsrlimit:"8",prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"1600",format:"json",origin:"*"}).toString();
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(7000)});
    if(!response.ok)return[];
    const json=await response.json() as {query?:{pages?:Record<string,{title?:string;imageinfo?:{thumburl?:string;url?:string;descriptionurl?:string;extmetadata?:Record<string,{value?:string}>}[]}>}};
    return Object.values(json.query?.pages||{}).flatMap(page=>{const info=page.imageinfo?.[0],meta=info?.extmetadata||{},license=stripHtml(meta.LicenseShortName?.value||""),creator=stripHtml(meta.Artist?.value||meta.Credit?.value||"").slice(0,100);if(!info?.url||!/public domain|cc0|cc by/i.test(license))return[];return[{url:info.thumburl||info.url,alt:stripHtml(meta.ObjectName?.value||page.title?.replace(/^File:/,"")||topic),caption:`${creator?`${creator} · `:""}${license} · Wikimedia Commons`,sourceUrl:info.descriptionurl||info.url}]});
  }catch{return[]}
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
function composedArticle(title:string,summary:string,research:Research|undefined,assets:VisualAsset[]):PuckData{
  const findings=(research?.keyTakeaways?.length?research.keyTakeaways:research?.findings||[]).slice(0,4);
  const context=(research?.engineering?.length?research.engineering:research?.opportunities||[]).slice(0,4);
  const overview=(research?.overview||summary||"A focused, evidence-led introduction to the subject.").split(/\n\n+/).filter(Boolean).slice(0,3);
  const content:PuckData["content"]=[
    {type:"Hero",props:{id:"hero-1",eyebrow:"Research feature",title:cleanText(research?.title||title||"Untitled feature"),subtitle:cleanText(research?.dek||summary||overview[0]||"",true)}},
  ];
  if(assets[0])content.push({type:"Image",props:{id:"lead-image",...assets[0]}});
  content.push({type:"Heading",props:{id:"overview-heading",text:"The essential picture",level:"h2"}});
  for(const [index,text] of overview.entries())content.push({type:"Text",props:{id:`overview-${index}`,text:cleanText(text,true)}});
  if(findings.length)content.push({type:"Heading",props:{id:"findings-heading",text:"What the evidence shows",level:"h2"}},{type:"CardGrid",props:{id:"findings-grid",cards:findings.map((body,index)=>({title:`Finding ${index+1}`,body:cleanText(body,true)}))}});
  if(assets[1])content.push({type:"Image",props:{id:"detail-image",...assets[1]}});
  if(context.length)content.push({type:"Heading",props:{id:"directions-heading",text:"Where the work can go next",level:"h2"}},{type:"CardGrid",props:{id:"directions-grid",cards:context.map((body,index)=>({title:`Direction ${index+1}`,body:cleanText(body,true)}))}});
  if(research?.cautions?.length)content.push({type:"Heading",props:{id:"limits-heading",text:"Limits and safeguards",level:"h2"}},{type:"Text",props:{id:"limits-text",text:cleanText(research.cautions.slice(0,3).join(" "),true)}});
  content.push({type:"CTAButton",props:{id:"sources-cta",label:research?.sources?.length?`Review ${research.sources.length} sources`:"Review the research",href:"../../spark/article/"}});
  return{root:{props:{}},content,zones:{}};
}
function patternData(pattern:Pattern,title:string,summary:string,ideas:string[]):PuckData{
  const source=starterData(title,summary,ideas),cards=(ideas.length?ideas:["Define the goal.","Choose the format.","Publish a first version."]).slice(0,4).map((idea,i)=>({title:`${pattern==="magazine"?"Story":"Direction"} ${i+1}`,body:cleanText(idea,true)}));
  const labels={magazine:["The feature","Read the full story"],product:["Why it matters","Start here"],dashboard:["Current signals","Open the workspace"],"field-guide":["Field notes","Explore the guide"],research:["Evidence summary","Review the sources"]} as const;
  const [heading,cta]=labels[pattern];
  source.content=[source.content[0],{type:"Heading",props:{id:`${pattern}-heading`,text:heading,level:"h2"}},{type:"Text",props:{id:`${pattern}-intro`,text:cleanText(summary||"A focused, evidence-led introduction to the subject.",true)}},{type:"CardGrid",props:{id:`${pattern}-cards`,cards}},{type:"CTAButton",props:{id:`${pattern}-cta`,label:cta,href:"#"}}];
  return source;
}

export default function PuckBuilder() {
  const [ready, setReady] = useState(false);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [data, setData] = useState<PuckData | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);
  const [pattern,setPattern]=useState<Pattern>("magazine");
  const [assetNote,setAssetNote]=useState("Composing the article and finding reusable visuals…");

  useEffect(()=>{const hide=()=>{const bar=document.getElementById("infinity-community");if(bar)bar.hidden=true},observer=new MutationObserver(hide);hide();observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);

  useEffect(() => {
    let active=true;
    async function compose(){
    const params = new URLSearchParams(location.search);
    const draftId = params.get("id") || crypto.randomUUID();
    const drafts = readDrafts();
    const draft = drafts.find((d) => d.id === draftId);
    const pages = readPages();
    const existing = pages[draftId];
    const initialTitle = draft?.title || params.get("query") || "Untitled page";
    setId(draftId);
    setTitle(initialTitle);
    if(existing?.data){setData(existing.data);setAssetNote("Saved composition restored")}else{
      const assets=await findReusableImages(draft?.research?.title||initialTitle);
      if(!active)return;
      setData(composedArticle(initialTitle,draft?.summary||"",draft?.research,assets));
      setAssetNote(assets.length?`${assets.length} credited reusable visual${assets.length===1?"":"s"} selected automatically`:"Article composed; no clearly reusable visual matched this subject");
    }
    if(params.get("mode")==="preview")setMode("preview");
    setReady(true);
    }
    void compose();
    return()=>{active=false};
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
        <Link href={`${APP_BASE}/spark/`} className="flex items-center gap-2 text-slate-600 hover:text-slate-950">
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
        <div><section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-7"><div className="flex flex-wrap items-end justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Page patterns</p><p className="text-sm text-slate-500">{assetNote}</p></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{patterns.map(item=><button key={item.id} onClick={()=>{setPattern(item.id);const draft=readDrafts().find(d=>d.id===id);setData(patternData(item.id,heading,draft?.summary||"",draft?.research?.engineering||draft?.research?.opportunities||[]))}} className={`min-w-44 rounded-xl border px-4 py-3 text-left ${pattern===item.id?'border-[#145f94] bg-[#eaf4fb]':'border-slate-200'}`}><b className="block">{item.label}</b><small className="mt-1 block text-slate-500">{item.note}</small></button>)}</div></section><div className="puck-shell [&_.PuckCanvas-root]:bg-[#f7f8fa]">
          <Puck config={puckConfig} data={data} onPublish={handlePublish} />
        </div></div>
      ) : (
        <main className="published-preview mx-auto max-w-6xl px-3 py-6 sm:px-8 sm:py-10 [&_.edit-mark]:hidden">
          <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500"><Sparkles size={16}/>Finished-page preview</div><Render config={puckConfig} data={data} />
        </main>
      )}
    </div>
  );
}
