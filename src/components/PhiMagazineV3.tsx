"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import styles from "./PhiMagazine.module.css";

type Source = { title: string; url: string; excerpt: string; provider: string; imageUrl?: string };
type Identity = { kind?: string; name?: string; symbol?: string; number?: number };
type Paper = { id: string; query: string; resolved: string; identity?: Identity; title: string; overview: string; findings: string[]; sources: Source[]; created: number };
type Note = { id: string; title: string; body: string };
type SelectionState = { branches: number[]; branchIds?: string[]; branchBodies?: string[]; terms: string[]; imageUrls: string[]; noteImages?: Record<string,string[]>; notes: Note[]; deepNotes?: string[]; updatedAt: string };
type CommonsImage = { url: string; title: string; pageUrl: string };
type Section = { id: string; title: string; body: string; images: CommonsImage[]; source?: Source };

const PAPERS = "infinity_phi_research_v1";
const PAPER_PREFIX = "infinity_phi_paper_v2_";
const SELECTION_PREFIX = "infinity_phi_selection_v2_";
const STOP = new Set(["about","after","again","against","because","before","being","between","could","every","first","from","have","into","itself","more","other","over","same","such","than","that","their","these","they","this","through","under","what","when","where","which","while","with","would","your","also","only","some","most","many","much","there","then","than","them","were","been","does","into","each","very","will"]);
const GENERIC = new Set(["chemical","element","elements","metal","metals","research","story","evidence","material","materials","properties","property","different","important","information","system","systems","article","subject"]);

const clean = (value: unknown) => String(value || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const sentences = (value: string) => clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item) => item.length > 45);
const words = (value: string) => clean(value).toLowerCase().match(/[a-z0-9]+/g) || [];
const keyWords = (value: string) => words(value).filter((word) => word.length > 4 && !STOP.has(word));
function wordSet(value: string) { return new Set(keyWords(value)); }
function overlap(a: string,b: string) { const left=wordSet(a), right=wordSet(b); let score=0; left.forEach((word)=>{if(right.has(word)) score+=1;}); return score; }
function hashText(value: string) { let hash=0; for(let i=0;i<value.length;i+=1) hash=((hash<<5)-hash+value.charCodeAt(i))|0; return Math.abs(hash).toString(36); }
function shortTitle(text: string,fallback: string) { const clause=clean(text).split(/[.;:—]/)[0].replace(/^[^a-z0-9]+/i,""); if(clause.length>=12&&clause.length<=82) return clause; const key=keyWords(text).slice(0,7).join(" "); return key?key.replace(/\b\w/g,(char)=>char.toUpperCase()):fallback; }
function dedupeSources(sources: Source[]) { const seen=new Set<string>(); return sources.filter((source)=>{const key=source.url||`${source.provider}:${source.title}`; if(!key||seen.has(key)) return false; seen.add(key); return true;}); }
function dedupeLines(lines: string[],limit=80) { const out:string[]=[]; for(const raw of lines){const line=clean(raw); if(!line) continue; const duplicate=out.some((old)=>overlap(old,line)>=Math.min(7,Math.max(3,Math.floor(Math.min(keyWords(old).length,keyWords(line).length)*.68)))); if(!duplicate) out.push(line); if(out.length>=limit) break;} return out; }
function informationScore(text: string) { let score=Math.min(5,keyWords(text).length/6); if(/\d/.test(text)) score+=2; if(/\b(measured|mintage|grade|value|temperature|density|isotope|compound|oxidation|production|population|auction|application|process|mechanism|history|structure|configuration|relationship|interaction|comparison)\b/i.test(text)) score+=2; if(text.length>100&&text.length<520) score+=1; return score; }
function focusText(selection: SelectionState) { return [...(selection.deepNotes||[]),...(selection.notes||[]).flatMap((note)=>[note.title,note.body]),...(selection.branchBodies||[]),...(selection.terms||[])].map(clean).filter(Boolean).join(" "); }
function anchors(text: string) { return [...new Set(keyWords(text).filter((word)=>!GENERIC.has(word)))].slice(0,32); }
function focusScore(text: string,focus: string) { if(!focus) return 1; const lower=text.toLowerCase(); const hit=anchors(focus).filter((word)=>lower.includes(word)).length; return overlap(text,focus)+hit*1.6; }
function sourceRelevant(source: Source,focus: string) { if(!focus) return true; return focusScore(`${source.title} ${source.excerpt}`,focus)>=3.5; }
function bestSource(text: string,sources: Source[]) { return [...sources].sort((a,b)=>focusScore(`${b.title} ${b.excerpt}`,text)-focusScore(`${a.title} ${a.excerpt}`,text))[0]; }

async function wiki(query: string): Promise<Source[]> {
  const controller=new AbortController(); const timer=window.setTimeout(()=>controller.abort(),5200);
  try { const url=`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=14&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=1100&format=json&origin=*`; const response=await fetch(url,{signal:controller.signal,cache:"no-store"}); if(!response.ok) return []; const data=await response.json(); return Object.values(data?.query?.pages||{}).flatMap((page:any)=>{const title=clean(page.title), excerpt=clean(page.extract); if(!title||!excerpt) return []; return [{title,excerpt,url:page.fullurl||"",provider:"Wikipedia",imageUrl:page.thumbnail?.source}];}); } catch{return [];} finally{window.clearTimeout(timer);}
}
async function commonsSearch(query: string): Promise<CommonsImage[]> {
  const controller=new AbortController(); const timer=window.setTimeout(()=>controller.abort(),6800);
  try { const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=50&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1300&format=json&origin=*`; const response=await fetch(url,{signal:controller.signal,cache:"force-cache"}); if(!response.ok) return []; const data=await response.json(); return Object.values(data?.query?.pages||{}).flatMap((page:any)=>{const info=page.imageinfo?.[0]; const mime=String(info?.mime||""); if(!info?.thumburl||!mime.startsWith("image/")||/svg/i.test(mime)) return []; return [{url:info.thumburl,title:clean(page.title).replace(/^File:/,""),pageUrl:`https://commons.wikimedia.org/?curid=${page.pageid}`}];}); } catch{return [];} finally{window.clearTimeout(timer);}
}
function sourcePrompts(paper: Paper,selection: SelectionState) {
  const focus=focusText(selection);
  if(!focus) return [paper.query,paper.resolved,...paper.findings.slice(0,5).map((line)=>shortTitle(line,""))].filter(Boolean).slice(0,10);
  const notePrompts=(selection.notes||[]).flatMap((note)=>[note.title,`${note.title} ${keyWords(note.body).slice(0,8).join(" ")}`]);
  const deep=(selection.deepNotes||[]).map((line)=>shortTitle(line,""));
  return [...deep,...notePrompts,...selection.terms].map(clean).filter(Boolean).slice(0,14);
}
async function collectSources(paper: Paper,selection: SelectionState) {
  const focus=focusText(selection); const prompts=sourcePrompts(paper,selection); const settled=await Promise.allSettled(prompts.map(wiki));
  const fresh=dedupeSources(settled.flatMap((result)=>result.status==="fulfilled"?result.value:[]));
  if(!focus) return dedupeSources([...paper.sources,...fresh]).slice(0,65);
  const parentRelevant=paper.sources.filter((source)=>sourceRelevant(source,focus));
  return dedupeSources([...fresh.filter((source)=>sourceRelevant(source,focus)),...parentRelevant]).sort((a,b)=>focusScore(`${b.title} ${b.excerpt}`,focus)-focusScore(`${a.title} ${a.excerpt}`,focus)).slice(0,60);
}
function buildStoryMaterial(paper: Paper,selection: SelectionState,sources: Source[]) {
  const focus=focusText(selection); const noteBodies=(selection.notes||[]).map((note)=>clean(note.body)).filter(Boolean); const deep=(selection.deepNotes||[]).map(clean).filter(Boolean);
  const sourceLines=sources.flatMap((source)=>sentences(source.excerpt).map((body)=>({body,score:focus?focusScore(body,focus):informationScore(body)}))).filter((item)=>!focus||item.score>=3.5).sort((a,b)=>(b.score+informationScore(b.body))-(a.score+informationScore(a.body))).map((item)=>item.body);
  if(focus) return dedupeLines([...deep,...noteBodies,...sourceLines],30);
  return dedupeLines([...sentences(paper.overview),...paper.findings,...sourceLines],30);
}
async function collectImages(paper: Paper,selection: SelectionState,material: string[]) {
  const focus=focusText(selection); const noteTitles=(selection.notes||[]).map((note)=>note.title); const prompts=[...noteTitles,...material.slice(0,16).map((line)=>shortTitle(line,"")),...(focus?[shortTitle(focus,"")]:[paper.query])].filter(Boolean).slice(0,18);
  const settled=await Promise.allSettled(prompts.map(commonsSearch));
  const preferred=[...(selection.imageUrls||[]),...Object.values(selection.noteImages||{}).flat()].map((url,index)=>({url,title:`Selected visual ${index+1}`,pageUrl:""}));
  const seen=new Set<string>(); return [...preferred,...settled.flatMap((result)=>result.status==="fulfilled"?result.value:[])].filter((image)=>{if(!image.url||seen.has(image.url)) return false; seen.add(image.url); return true;}).slice(0,120);
}
function makeSections(material: string[],sources: Source[],images: CommonsImage[]) {
  const count=Math.min(30,material.length); const imageTarget=Math.min(images.length,Math.max(50,count*2)); const perSection=count?Math.max(2,Math.min(6,Math.ceil(imageTarget/count))):2; let cursor=1;
  return material.slice(0,count).map((body,index):Section=>{const source=bestSource(body,sources); const sectionImages=images.slice(cursor,cursor+perSection); cursor+=perSection; return {id:`section-${hashText(body)}`,title:shortTitle(body,`A closer look ${index+1}`),body,images:sectionImages,source};});
}
function editionTitle(paper: Paper,selection: SelectionState) {
  const notes=selection.notes||[], deep=selection.deepNotes||[];
  if(deep.length) return shortTitle(deep[0],paper.title);
  if(notes.length>=2) return `${shortTitle(notes[0].title,"Focused research")} — ${shortTitle(notes[1].title,"connected evidence")}`;
  if(notes.length===1) return shortTitle(notes[0].title,paper.title);
  return paper.title||`${paper.query}: A Complete Guide`;
}
async function savePaper(paper: Paper) {
  secureSave(`${PAPER_PREFIX}${paper.id}`,paper,"session"); secureSave(`${PAPER_PREFIX}${paper.id}`,paper);
  try { const existing=await secureLoadDurable<Paper[]>(PAPERS,[]); await secureSaveDurable(`${PAPER_PREFIX}${paper.id}`,paper); await secureSaveDurable(PAPERS,[...existing.filter((item)=>item.id!==paper.id),paper].slice(-12)); } catch {}
}

export default function PhiMagazineV3() {
  const [paper,setPaper]=useState<Paper|null>(null);
  const [selection,setSelection]=useState<SelectionState>({branches:[],branchIds:[],branchBodies:[],terms:[],imageUrls:[],noteImages:{},notes:[],deepNotes:[],updatedAt:""});
  const [sources,setSources]=useState<Source[]>([]);
  const [images,setImages]=useState<CommonsImage[]>([]);
  const [openStory,setOpenStory]=useState(false);
  const [chosenCards,setChosenCards]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [buildingSection,setBuildingSection]=useState<string|null>(null);

  useEffect(()=>{
    const params=new URLSearchParams(location.search); const id=params.get("id")||""; if(!id){setLoading(false);return;}
    void(async()=>{
      let exact=secureLoad<Paper|null>(`${PAPER_PREFIX}${id}`,null,"session")||secureLoad<Paper|null>(`${PAPER_PREFIX}${id}`,null);
      if(!exact) try{exact=await secureLoadDurable<Paper|null>(`${PAPER_PREFIX}${id}`,null);}catch{}
      if(!exact) try{exact=(await secureLoadDurable<Paper[]>(PAPERS,[])).find((item)=>item.id===id)||null;}catch{}
      if(!exact){setLoading(false);return;}
      const saved=secureLoad<SelectionState|null>(`${SELECTION_PREFIX}${exact.id}`,null)||await secureLoadDurable<SelectionState|null>(`${SELECTION_PREFIX}${exact.id}`,null).catch(()=>null);
      const next=saved||{branches:[],branchIds:[],branchBodies:[],terms:[],imageUrls:[],noteImages:{},notes:[],deepNotes:[],updatedAt:""};
      setPaper(exact); setSelection(next); setChosenCards(next.deepNotes||[]);
      const focusedSources=await collectSources(exact,next); setSources(focusedSources);
      const material=buildStoryMaterial(exact,next,focusedSources); const visualPool=await collectImages(exact,next,material); setImages(visualPool); setLoading(false);
    })();
  },[]);

  const material=useMemo(()=>paper?buildStoryMaterial(paper,selection,sources):[],[paper,selection,sources]);
  const sections=useMemo(()=>makeSections(material,sources,images),[material,sources,images]);
  const focus=useMemo(()=>focusText(selection),[selection]);

  function toggleCard(body:string){setChosenCards((current)=>current.includes(body)?current.filter((item)=>item!==body):[...current,body].slice(-12));}
  async function printDeeperEdition(){if(!paper||!chosenCards.length)return; const next:SelectionState={...selection,deepNotes:chosenCards,notes:chosenCards.map((body,index)=>({id:`deep-${index}`,title:shortTitle(body,`Selected idea ${index+1}`),body})),updatedAt:new Date().toISOString()}; setSelection(next); secureSave(`${SELECTION_PREFIX}${paper.id}`,next); try{await secureSaveDurable(`${SELECTION_PREFIX}${paper.id}`,next);}catch{} location.assign(`${appPath("phi/magazine")}?id=${encodeURIComponent(paper.id)}&edition=${Date.now()}`);}

  async function buildSectionSite(section: Section){
    if(buildingSection)return; setBuildingSection(section.id);
    const coreTitle=section.title; const coreTerms=keyWords(section.body).filter((word)=>!GENERIC.has(word)).slice(0,10).join(" "); const coreQuery=`${coreTitle} ${coreTerms}`.trim();
    const prompts=[coreQuery,`${coreTitle} definition evidence`,`${coreTitle} history development`,`${coreTitle} mechanism process`,`${coreTitle} measurements data`,`${coreTitle} applications implications`];
    const settled=await Promise.allSettled(prompts.map(wiki)); const found=dedupeSources(settled.flatMap((result)=>result.status==="fulfilled"?result.value:[]));
    const strict=found.filter((source)=>focusScore(`${source.title} ${source.excerpt}`,`${coreTitle} ${section.body}`)>=3).slice(0,45);
    const sourceSet=strict.length?strict:found.slice(0,25);
    const lines=dedupeLines(sourceSet.flatMap((source)=>sentences(source.excerpt)).sort((a,b)=>(focusScore(b,coreQuery)+informationScore(b))-(focusScore(a,coreQuery)+informationScore(a))),22);
    const childId=`phi-card-${Date.now()}-${hashText(coreQuery).slice(0,6)}`;
    const child:Paper={id:childId,query:coreTitle,resolved:coreQuery,identity:{kind:"focused",name:coreTitle},title:`${coreTitle}: A Focused Guide`,overview:dedupeLines([section.body,...lines],4).join(" "),findings:lines.slice(1,18),sources:sourceSet,created:Date.now()};
    const childSelection:SelectionState={branches:[],branchIds:[],branchBodies:[section.body],terms:keyWords(coreTitle).filter((word)=>!GENERIC.has(word)).slice(0,8),imageUrls:section.images.map((image)=>image.url),noteImages:{},notes:[{id:"core-note",title:coreTitle,body:section.body}],deepNotes:[],updatedAt:new Date().toISOString()};
    await savePaper(child); secureSave(`${SELECTION_PREFIX}${child.id}`,childSelection); try{await secureSaveDurable(`${SELECTION_PREFIX}${child.id}`,childSelection);}catch{}
    location.assign(`${appPath("phi/magazine")}?id=${encodeURIComponent(child.id)}&from=${encodeURIComponent(paper?.id||"")}`);
  }

  if(loading)return <main className={styles.loading}>Preparing the focused publication…</main>;
  if(!paper)return <main className={styles.loading}><a href={appPath("phi")}>Return to Infinity Phi</a></main>;

  const title=editionTitle(paper,selection); const hero=selection.imageUrls?.[0]||Object.values(selection.noteImages||{}).flat()[0]||images[0]?.url||sources.find((source)=>source.imageUrl)?.imageUrl; const storyParagraphs=material.slice(0,openStory?16:4);

  return <main className={styles.site}>
    <header className={styles.header}><a className={styles.brand} href={appPath("")}>Infinity</a><nav><a href="#story">Story</a><a href="#explore">Explore</a><a href="#sources">Sources</a></nav></header>
    <section className={styles.hero}>{hero&&<img src={hero} alt=""/>}<div className={styles.heroShade}/><div className={styles.heroCopy}><small>{focus?"Focused edition":paper.query}</small><h1>{title}</h1><p>{focus?(selection.notes||[]).slice(0,2).map((note)=>note.body).join(" ")||material[0]:paper.overview}</p></div></section>

    <article className={styles.article}>
      <section id="story" className={styles.fullStory}><div className={styles.eyebrow}>The full story</div><h2>{focus?"The evidence that survived the research focus":"The subject, connected from beginning to end"}</h2><div className={styles.storyText}>{storyParagraphs.map((paragraph,index)=><p key={`${hashText(paragraph)}-${index}`} className={index===0?styles.lead:""}>{paragraph}</p>)}</div>{material.length>4&&<button type="button" className={styles.readMore} onClick={()=>setOpenStory((value)=>!value)}>{openStory?"Show less":"Read more"} <ChevronDown size={17} className={openStory?styles.rotate:""}/></button>}</section>

      <section id="explore" className={styles.explore}><div className={styles.eyebrow}>Explore the ideas</div><h2>Each card can become a completely new researched website.</h2><div className={styles.cards}>{sections.map((section,index)=>{const chosen=chosenCards.includes(section.body); const building=buildingSection===section.id; return <article key={section.id} className={`${styles.card} ${chosen?styles.cardChosen:""}`} onClick={()=>toggleCard(section.body)}>
        <div className={styles.cardMedia}>{section.images.length?<div className={styles.imageMosaic}>{section.images.map((image,imageIndex)=><img key={image.url} src={image.url} alt={image.title} loading={index<2&&imageIndex===0?"eager":"lazy"}/>)}</div>:<div className={styles.imageFallback}>φ</div>}<button type="button" disabled={Boolean(buildingSection)} className={styles.cardPhi} aria-label={`Build a new website about ${section.title}`} onClick={(event)=>{event.stopPropagation();void buildSectionSite(section);}}>{building?"…":"φ"}</button></div>
        <div className={styles.cardCopy}><small>{String(index+1).padStart(2,"0")}</small><h3>{section.title}</h3><p>{section.body}</p>{section.source?.url&&<a href={section.source.url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>Read source <ExternalLink size={14}/></a>}{building&&<p style={{marginTop:14,fontFamily:"Arial, sans-serif",fontSize:13,color:"#75419a",fontWeight:800}}>Researching multiple source pages and building the new focused website…</p>}</div>
      </article>;})}</div></section>

      <section className={styles.noteSection}><div className={styles.noteHead}><span>φ</span><div><div className={styles.eyebrow}>Your selected reading path</div><h2>{chosenCards.length?`${chosenCards.length} ideas are ready for a deeper edition.`:"Tap article cards to collect ideas, or use a card’s φ to branch into a brand-new website."}</h2></div></div>{chosenCards.length>0&&<div className={styles.noteGrid}>{chosenCards.map((body,index)=><button type="button" key={`${hashText(body)}-${index}`} onClick={()=>toggleCard(body)}><small>SELECTED {String(index+1).padStart(2,"0")}</small><b>{shortTitle(body,`Idea ${index+1}`)}</b><p>{body}</p></button>)}</div>}<button type="button" className={styles.deepButton} disabled={!chosenCards.length} onClick={()=>void printDeeperEdition()}><span>φ</span><div><b>Create a deeper magazine from these selected ideas</b><small>The selected cards become the next controlling research brief, and unrelated material is filtered out again.</small></div></button></section>

      <section id="sources" className={styles.sources}><div className={styles.eyebrow}>Sources</div><h2>Sources that support this edition</h2><div className={styles.sourceGrid}>{sources.slice(0,36).map((source,index)=><a key={`${source.url}-${index}`} href={source.url||"#"} target={source.url?"_blank":undefined} rel={source.url?"noreferrer":undefined}><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p><ExternalLink size={15}/></a>)}</div></section>
    </article>

    <footer className={styles.footer}><b>Infinity</b><span>{images.length>=50?`${Math.min(images.length,120)} distinct visual candidates were gathered around the active brief.`:`${images.length} focused visual candidates were found; the builder avoids intentional repetition when enough distinct images are available.`}</span></footer>
  </main>;
}
