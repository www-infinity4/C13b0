"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Sparkles } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable, secureSave, secureSaveDurable } from "@/lib/secure-storage";
import { dedupeSemantic } from "@/lib/phi-semantic-expansion";
import PhiPublicationMenu from "@/components/PhiPublicationMenu";
import styles from "./PhiMagazineV4.module.css";

type Source={title:string;url:string;excerpt:string;provider:string;imageUrl?:string};
type Identity={kind?:string;name?:string;symbol?:string;number?:number};
type Paper={id:string;query:string;resolved:string;identity?:Identity;title:string;overview:string;findings:string[];sources:Source[];created:number};
type Note={id:string;title:string;body:string};
type SelectionState={branches:number[];branchIds?:string[];branchBodies?:string[];terms:string[];imageUrls:string[];noteImages?:Record<string,string[]>;notes:Note[];deepNotes?:string[];updatedAt:string};
type CommonsImage={url:string;title:string;pageUrl:string};
type StorySection={id:string;title:string;paragraphs:string[];bullets:string[];question:string;images:CommonsImage[];source?:Source};
type ResearchPrompt={title:string;body:string;question:string};

const PAPERS="infinity_phi_research_v1";
const PAPER_PREFIX="infinity_phi_paper_v2_";
const SELECTION_PREFIX="infinity_phi_selection_v2_";
const STOP=new Set(["about","after","again","against","because","before","being","between","could","every","first","from","have","into","itself","more","other","over","same","such","than","that","their","these","they","this","through","under","what","when","where","which","while","with","would","your","also","only","some","most","many","much","there","then","them","were","been","does","each","very","will","evidence","research","story","article","subject"]);
const GENERIC=new Set(["chemical","element","elements","metal","metals","material","materials","properties","property","different","important","information","system","systems","process","general"]);
const clean=(value:unknown)=>String(value||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const sentences=(value:string)=>clean(value).split(/(?<=[.!?])\s+/).map(clean).filter((item)=>item.length>42);
const words=(value:string)=>clean(value).toLowerCase().match(/[a-z0-9]+/g)||[];
const keys=(value:string)=>words(value).filter((word)=>word.length>4&&!STOP.has(word));
function setOf(value:string){return new Set(keys(value));}
function overlap(a:string,b:string){const left=setOf(a),right=setOf(b);let score=0;left.forEach((w)=>{if(right.has(w))score+=1;});return score;}
function hashText(value:string){let hash=0;for(let i=0;i<value.length;i+=1)hash=((hash<<5)-hash+value.charCodeAt(i))|0;return Math.abs(hash).toString(36);}
function titleCase(value:string){return value.replace(/\b\w/g,(c)=>c.toUpperCase());}
function dedupeSources(items:Source[]){const seen=new Set<string>();return items.filter((item)=>{const key=item.url||`${item.provider}:${item.title}`;if(!key||seen.has(key))return false;seen.add(key);return true;});}
function dedupeLines(items:string[],limit=80){const out:string[]=[];for(const raw of items){const line=clean(raw);if(!line)continue;const duplicate=out.some((old)=>overlap(old,line)>=Math.min(7,Math.max(3,Math.floor(Math.min(keys(old).length,keys(line).length)*.68))));if(!duplicate)out.push(line);if(out.length>=limit)break;}return out;}
function focusText(selection:SelectionState){return [...(selection.deepNotes||[]),...(selection.notes||[]).flatMap((n)=>[n.title,n.body]),...(selection.branchBodies||[]),...(selection.terms||[])].map(clean).filter(Boolean).join(" ");}
function anchors(value:string){return [...new Set(keys(value).filter((w)=>!GENERIC.has(w)))].slice(0,34);}
function focusScore(text:string,focus:string){if(!focus)return 1;const lower=text.toLowerCase();const hits=anchors(focus).filter((w)=>lower.includes(w)).length;return overlap(text,focus)+hits*1.55;}
function infoScore(text:string){let score=Math.min(5,keys(text).length/6);if(/\d/.test(text))score+=2;if(/\b(measured|mintage|grade|value|temperature|density|isotope|compound|oxidation|production|population|auction|application|mechanism|history|structure|configuration|relationship|interaction|comparison|toxicity|exposure)\b/i.test(text))score+=2;return score;}
function sourceRelevant(source:Source,focus:string){return !focus||focusScore(`${source.title} ${source.excerpt}`,focus)>=3.3;}
function bestSource(text:string,sources:Source[]){return [...sources].sort((a,b)=>focusScore(`${b.title} ${b.excerpt}`,text)-focusScore(`${a.title} ${a.excerpt}`,text))[0];}
function topTerms(value:string,limit=4){const counts=new Map<string,number>();keys(value).filter((w)=>!GENERIC.has(w)).forEach((w)=>counts.set(w,(counts.get(w)||0)+1));return [...counts].sort((a,b)=>b[1]-a[1]).map(([w])=>w).slice(0,limit);}
function subjectLabel(paper:Paper,selection:SelectionState){const explicit=clean(paper.query).replace(/[?.!]+$/g,"");const focus=focusText(selection);const named=[...new Set([explicit,...topTerms(focus,3)].filter(Boolean))];return named[0]||clean(paper.identity?.name)||"This subject";}
function entities(paper:Paper,selection:SelectionState){const text=`${paper.query} ${focusText(selection)}`.toLowerCase();const periodic=["hydrogen","helium","boron","carbon","nitrogen","oxygen","fluorine","aluminum","gallium","yttrium","mercury","rhenium","bohrium","dysprosium","niobium","antimony","selenium","arsenic","potassium","iodine","uranium"];
  return periodic.filter((name)=>new RegExp(`\\b${name}\\b`,"i").test(text)).slice(0,3);
}
function editorialTitle(paper:Paper,selection:SelectionState){const subject=subjectLabel(paper,selection);const ent=entities(paper,selection);const lower=`${paper.query} ${focusText(selection)}`.toLowerCase();
  if(ent.length>=2)return `${titleCase(ent[0])} and ${titleCase(ent[1])}: Where the Chemistry Connects—and Where It Does Not`;
  if(/\b(quarter|dime|nickel|cent|penny|dollar|coin|coinage|numismatic)\b/.test(lower))return `${subject}: The Details That Separate an Ordinary Coin from a Collector Example`;
  if(/\b(element|atomic|chemistry|oxide|isotope|compound)\b/.test(lower))return `${subject}: What Its Chemistry Explains, What Changes, and What Still Needs Testing`;
  if(/\b(magnet|magnetic|field|coerciv)\b/.test(lower))return `${subject}: The Physical Mechanism Behind the Behavior`;
  if(/\b(storage|memory|data)\b/.test(lower))return `${subject}: From Working Principle to a Testable System`;
  return `${subject}: The Key Facts, the Real Connections, and the Questions Worth Pursuing`;
}
function editorialDeck(paper:Paper,selection:SelectionState,material:string[]){const ent=entities(paper,selection);if(ent.length>=2)return `A focused guide to ${titleCase(ent[0])} and ${titleCase(ent[1])}, built around the connections supported by the selected research path while filtering out neighboring material that does not belong.`;return clean(paper.overview)||`A publication shaped from the selected ${subjectLabel(paper,selection)} research path.`;}
function smartTitle(body:string,paper:Paper,selection:SelectionState,index:number){const subject=subjectLabel(paper,selection);const ent=entities(paper,selection);const lower=body.toLowerCase();
  if(/atomic number|periodic table|electron configuration/.test(lower))return `${subject}: Identity, Position, and Atomic Structure`;
  if(/compound|oxide|oxidation|bond|react/.test(lower))return `How ${subject} Behaves in Compounds`;
  if(/isotope|half-life|radioactive|decay/.test(lower))return `${subject}: Isotopes, Stability, and Decay`;
  if(/use|application|device|industry|phosphor|laser|superconductor/.test(lower))return `Where ${subject} Becomes Useful`;
  if(/health|toxicity|exposure|lung|safety|hazard/.test(lower))return `What Exposure to ${subject} Can Change`;
  if(/mintage|minted|production/.test(lower)&&/coin|quarter|dime|cent|dollar/.test(`${paper.query} ${body}`.toLowerCase()))return `How Many Were Made—and Why Mintage Is Only the Beginning`;
  if(/proof/.test(lower))return `Proof Production: A Different Kind of Coin`;
  if(/business strike|circulation strike/.test(lower))return `Business Strikes: The Coins Made to Circulate`;
  if(/grade|pcgs|certif|mint state/.test(lower))return `How Grade Changes the Collector Story`;
  if(/value|auction|price|market/.test(lower))return `From Guide Price to Real Market Value`;
  if(ent.length>=2&&ent.every((name)=>lower.includes(name)))return `Where ${titleCase(ent[0])} and ${titleCase(ent[1])} Actually Meet`;
  const clause=clean(body).split(/[.;:—]/)[0];if(clause.length>=18&&clause.length<=78&&!/^(what|where|how) the evidence/i.test(clause))return clause.replace(/[.]+$/g,"");
  const terms=topTerms(body,4);return terms.length?`${subject}: ${titleCase(terms.join(" · "))}`:`${subject}: A Closer Look ${index+1}`;
}
function questionFor(body:string,paper:Paper,selection:SelectionState){const subject=subjectLabel(paper,selection);const terms=topTerms(body,3);const ent=entities(paper,selection);if(ent.length>=2)return `Which measurements would best separate a real ${titleCase(ent[0])}–${titleCase(ent[1])} connection from a coincidence or neighboring chemistry?`;if(terms.length>=2)return `What changes if we investigate ${terms[0]} and ${terms[1]} together instead of treating them as separate facts about ${subject}?`;return `What additional evidence would most improve this part of the ${subject} story?`;}
function buildMaterial(paper:Paper,selection:SelectionState,sources:Source[]){
  const focus=focusText(selection);
  const noteBodies=(selection.notes||[]).map((n)=>clean(n.body));
  const deep=(selection.deepNotes||[]).map(clean);
  const lines=sources.flatMap((s)=>sentences(s.excerpt).map((body)=>({body,score:focus?focusScore(body,focus):infoScore(body)}))).filter((x)=>!focus||x.score>=3.3).sort((a,b)=>(b.score+infoScore(b.body))-(a.score+infoScore(a.body))).map((x)=>x.body);
  const candidates=focus?[...deep,...noteBodies,...lines]:[...paper.findings,...lines];
  return dedupeSemantic(candidates,[paper.overview],36);
}

async function wiki(query:string):Promise<Source[]>{const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),4800);try{const url=`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=12&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=800&format=json&origin=*`;const response=await fetch(url,{signal:controller.signal,cache:"no-store"});if(!response.ok)return[];const data=await response.json();return Object.values(data?.query?.pages||{}).flatMap((page:any)=>{const title=clean(page.title),excerpt=clean(page.extract);if(!title||!excerpt)return[];return[{title,excerpt,url:page.fullurl||"",provider:"Wikipedia",imageUrl:page.thumbnail?.source}];});}catch{return[];}finally{window.clearTimeout(timer);}}
async function commonsSearch(query:string,limit=24):Promise<CommonsImage[]>{const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),5200);try{const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=720&format=json&origin=*`;const response=await fetch(url,{signal:controller.signal,cache:"force-cache"});if(!response.ok)return[];const data=await response.json();return Object.values(data?.query?.pages||{}).flatMap((page:any)=>{const info=page.imageinfo?.[0];const mime=String(info?.mime||"");if(!info?.thumburl||!mime.startsWith("image/")||/svg/i.test(mime))return[];return[{url:info.thumburl,title:clean(page.title).replace(/^File:/,""),pageUrl:`https://commons.wikimedia.org/?curid=${page.pageid}`}];});}catch{return[];}finally{window.clearTimeout(timer);}}
function sourcePrompts(paper:Paper,selection:SelectionState){const focus=focusText(selection);if(!focus)return[paper.query,paper.resolved,...paper.findings.slice(0,4).map((line)=>topTerms(line,4).join(" "))].filter(Boolean).slice(0,8);return[...(selection.notes||[]).flatMap((n)=>[n.title,`${n.title} ${topTerms(n.body,5).join(" ")}`]),...(selection.deepNotes||[]).map((n)=>topTerms(n,6).join(" ")),...selection.terms].filter(Boolean).slice(0,12);}
async function collectSources(paper:Paper,selection:SelectionState){const focus=focusText(selection);const settled=await Promise.allSettled(sourcePrompts(paper,selection).map(wiki));const fresh=dedupeSources(settled.flatMap((r)=>r.status==="fulfilled"?r.value:[]));if(!focus)return dedupeSources([...paper.sources,...fresh]).slice(0,60);return dedupeSources([...fresh.filter((s)=>sourceRelevant(s,focus)),...paper.sources.filter((s)=>sourceRelevant(s,focus))]).sort((a,b)=>focusScore(`${b.title} ${b.excerpt}`,focus)-focusScore(`${a.title} ${a.excerpt}`,focus)).slice(0,58);}
function seedImages(paper:Paper,selection:SelectionState){const preferred=[...(selection.imageUrls||[]),...Object.values(selection.noteImages||{}).flat(),...paper.sources.map((s)=>s.imageUrl).filter(Boolean) as string[]];const seen=new Set<string>();return preferred.filter((url)=>url&&!seen.has(url)&&seen.add(url)).map((url,index)=>({url,title:`Research visual ${index+1}`,pageUrl:""})).slice(0,14);}
function mergeImages(current:CommonsImage[],incoming:CommonsImage[],limit=90){const seen=new Set<string>();return[...current,...incoming].filter((img)=>img.url&&!seen.has(img.url)&&seen.add(img.url)).slice(0,limit);}
async function imageBatch(prompts:string[],limit=24){const settled=await Promise.allSettled(prompts.map((q)=>commonsSearch(q,limit)));return settled.flatMap((r)=>r.status==="fulfilled"?r.value:[]);}
function matchImages(sectionText:string,images:CommonsImage[],used:Set<string>,count=2){const ranked=images.map((image)=>({image,score:overlap(image.title,sectionText)})).sort((a,b)=>b.score-a.score);const chosen:CommonsImage[]=[];for(const item of ranked){if(used.has(item.image.url))continue;if(item.score<=0&&chosen.length>0)continue;chosen.push(item.image);used.add(item.image.url);if(chosen.length>=count)break;}if(chosen.length<count){for(const image of images){if(!used.has(image.url)){chosen.push(image);used.add(image.url);if(chosen.length>=count)break;}}}return chosen;}
function makeSections(material:string[],sources:Source[],images:CommonsImae[],paper:Paper,selection:SelectionState){
  const unique=dedupeSemantic(material,[paper.overview],30);
  const groups:string[][]=[];
  for(let i=0;i<unique.length;i+=2)groups.push(unique.slice(i,i+2));
  const used=new Set<string>(),usedText:string[]=[];
  return groups.flatMap((paragraphs,index):StorySection[]=>{
    const cleanParagraphs=dedupeSemantic(paragraphs,[paper.overview,...usedText],2);
    if(!cleanParagraphs.length)return[];
    const text=cleanParagraphs.join(" ");
    usedText.push(...cleanParagraphs);
    const source=bestSource(text,sources);
    const bullets=topTerms(text,4).map((term)=>`Follow the ${term} thread through the supporting sources and compare it against the surrounding claims.`).slice(0,3);
    return[{id:`section-${hashText(text)}`,title:smartTitle(text,paper,selection,index),paragraphs:cleanParagraphs,bullets,question:questionFor(text,paper,selection),images:matchImages(text,images,used,index<3?1:2),source}];
  });
}
function takeaways(material:string[]){return material.slice().sort((a,b)=>infoScore(b)-infoScore(a)).slice(0,5);}
function activeResearch(sections:StorySection[],paper:Paper,selection:SelectionState):ResearchPrompt[]{const candidates=sections.slice(0,8).map((section)=>({title:`Investigate: ${section.title}`,body:section.paragraphs.join(" "),question:section.question}));const ent=entities(paper,selection);if(ent.length>=2)candidates.unshift({title:`Test the ${titleCase(ent[0])}–${titleCase(ent[1])} connection directly`,body:`Keep only claims and measurements that address both ${ent[0]} and ${ent[1]} rather than neighboring chemistry that happens to appear in the same source trail.`,question:`What experiment, dataset, or comparison would most clearly establish whether the connection is meaningful?`});return candidates.slice(0,6);}
async function savePaper(paper:Paper){secureSave(`${PAPER_PREFIX}${paper.id}`,paper,"session");secureSave(`${PAPER_PREFIX}${paper.id}`,paper);try{const existing=await secureLoadDurable<Paper[]>(PAPERS,[]);await secureSaveDurable(`${PAPER_PREFIX}${paper.id}`,paper);await secureSaveDurable(PAPERS,[...existing.filter((item)=>item.id!==paper.id),paper].slice(-12));}catch{}}

export default function PhiMagazineV4(){
  const[paper,setPaper]=useState<Paper|null>(null);const[selection,setSelection]=useState<SelectionState>({branches:[],branchIds:[],branchBodies:[],terms:[],imageUrls:[],noteImages:{},notes:[],deepNotes:[],updatedAt:""});const[sources,setSources]=useState<Source[]>([]);const[images,setImages]=useState<CommonsImage[]>([]);const[openStory,setOpenStory]=useState(false);const[chosenCards,setChosenCards]=useState<string[]>([]);const[loading,setLoading]=useState(true);const[visualLoading,setVisualLoading]=useState(false);const[building,setBuilding]=useState<string|null>(null);
  useEffect(()=>{const params=new URLSearchParams(location.search);const id=params.get("id")||"";if(!id){setLoading(false);return;}void(async()=>{let exact=secureLoad<Paper|null>(`${PAPER_PREFIX}${id}`,null,"session")||secureLoad<Paper|null>(`${PAPER_PREFIX}${id}`,null);if(!exact)try{exact=await secureLoadDurable<Paper|null>(`${PAPER_PREFIX}${id}`,null);}catch{}if(!exact)try{exact=(await secureLoadDurable<Paper[]>(PAPERS,[])).find((item)=>item.id===id)||null;}catch{}if(!exact){setLoading(false);return;}const saved=secureLoad<SelectionState|null>(`${SELECTION_PREFIX}${exact.id}`,null)||await secureLoadDurable<SelectionState|null>(`${SELECTION_PREFIX}${exact.id}`,null).catch(()=>null);const next=saved||{branches:[],branchIds:[],branchBodies:[],terms:[],imageUrls:[],noteImages:{},notes:[],deepNotes:[],updatedAt:""};setPaper(exact);setSelection(next);setChosenCards(next.deepNotes||[]);setImages(seedImages(exact,next));const focused=await collectSources(exact,next);setSources(focused);setLoading(false);const material=buildMaterial(exact,next,focused);setVisualLoading(true);const firstPrompts=[editorialTitle(exact,next),...material.slice(0,5).map((line)=>topTerms(line,5).join(" "))].filter(Boolean).slice(0,6);const first=await imageBatch(firstPrompts,18);setImages((current)=>mergeImages(current,first,54));window.setTimeout(()=>{void(async()=>{const laterPrompts=material.slice(5,18).map((line)=>topTerms(line,6).join(" ")).filter(Boolean).slice(0,10);const later=await imageBatch(laterPrompts,18);setImages((current)=>mergeImages(current,later,90));setVisualLoading(false);})();},350);})();},[]);
  const material=useMemo(()=>paper?buildMaterial(paper,selection,sources):[],[paper,selection,sources]);const sections=useMemo(()=>paper?makeSections(material,sources,images,paper,selection):[],[material,sources,images,paper,selection]);const prompts=useMemo(()=>paper?activeResearch(sections,paper,selection):[],[sections,paper,selection]);
  function toggleCard(body:string){setChosenCards((current)=>current.includes(body)?current.filter((x)=>x!==body):[...current,body].slice(-12));}
  async function printDeeper(){if(!paper||!chosenCards.length)return;const next={...selection,deepNotes:chosenCards,notes:chosenCards.map((body,index)=>({id:`deep-${index}`,title:smartTitle(body,paper,selection,index),body})),updatedAt:new Date().toISOString()};setSelection(next);secureSave(`${SELECTION_PREFIX}${paper.id}`,next);try{await secureSaveDurable(`${SELECTION_PREFIX}${paper.id}`,next);}catch{}location.assign(`${appPath("phi/magazine")}?id=${encodeURIComponent(paper.id)}&edition=${Date.now()}`);}
  async function buildFocused(title:string,body:string,question?:string){if(!paper||building)return;setBuilding(title);const core=`${title} ${body} ${question||""}`;const base=topTerms(core,9).join(" ");const queries=[base,`${base} definition`,`${base} mechanism`,`${base} measurements`,`${base} applications`,`${base} unresolved questions`];const settled=await Promise.allSettled(queries.map(wiki));const found=dedupeSources(settled.flatMap((r)=>r.status==="fulfilled"?r.value:[])).filter((s)=>focusScore(`${s.title} ${s.excerpt}`,core)>=2.8).slice(0,42);const lines=dedupeLines(found.flatMap((s)=>sentences(s.excerpt)).sort((a,b)=>(focusScore(b,core)+infoScore(b))-(focusScore(a,core)+infoScore(a))),24);const childId=`phi-card-${Date.now()}-${hashText(core).slice(0,6)}`;const childOverview=dedupeSemantic([body,question||"",...lines],[],2).join(" ");const child:Paper={id:childId,query:title,resolved:base,identity:{kind:"focused",name:title},title,overview:childOverview,findings:dedupeSemantic(lines,[childOverview],18),sources:found,created:Date.now()};const childSelection:SelectionState={branches:[],branchIds:[],branchBodies:[body],terms:topTerms(core,8),imageUrls:[],noteImages:{},notes:[{id:"core-note",title,body}],deepNotes:[],updatedAt:new Date().toISOString()};await savePaper(child);secureSave(`${SELECTION_PREFIX}${child.id}`,childSelection);try{await secureSaveDurable(`${SELECTION_PREFIX}${child.id}`,childSelection);}catch{}location.assign(`${appPath("phi/magazine")}?id=${encodeURIComponent(child.id)}&from=${encodeURIComponent(paper.id)}`);}
  if(loading)return<main className={styles.loading}>Preparing the publication…</main>;if(!paper)return<main className={styles.loading}><a href={appPath("phi")}>Return to Infinity Phi</a></main>;
  const headline=editorialTitle(paper,selection),deck=editorialDeck(paper,selection,material),hero=selection.imageUrls?.[0]||Object.values(selection.noteImages||{}).flat()[0]||images[0]?.url||sources.find((s)=>s.imageUrl)?.imageUrl;const visibleSections=openStory?sections:sections.slice(0,5);
  return<main className={styles.site}>
    <PhiPublicationMenu/><header className={styles.header}><a className={styles.brand} href={appPath("")}>Infinity</a><nav><a href="#story">Story</a><a href="#sources">Sources</a></nav></header>
    <section className={styles.hero}>{hero&&<img src={hero} alt="" fetchPriority="high"/>}<div className={styles.heroShade}/><div className={styles.heroCopy}><small>{paper.query}</small><h1>{headline}</h1><p>{deck}</p></div></section>
    <article className={styles.article}>
      <section id="story" className={styles.story}><div className={styles.eyebrow}>The story</div><h2>A guided reading path—not a pile of search results</h2><div className={styles.sections}>{visibleSections.map((section,index)=>{const body=section.paragraphs.join(" ");const chosen=chosenCards.includes(body);return<section key={section.id} className={`${styles.storySection} ${chosen?styles.chosen:""}`}>
        {section.images[0]&&<img className={styles.sectionImage} src={section.images[0].url} alt={section.images[0].title} loading={index<2?"eager":"lazy"} decoding="async"/>}
        <div className={styles.sectionCopy}><small>{String(index+1).padStart(2,"0")}</small><h3>{section.title}</h3>{section.paragraphs.map((p,i)=><p key={`${hashText(p)}-${i}`}>{p}</p>)}{section.bullets.length>0&&<ul>{section.bullets.map((bullet,i)=><li key={i}>{bullet}</li>)}</ul>}<div className={styles.question}><b>Question to carry forward</b><p>{section.question}</p><button type="button" disabled={Boolean(building)} onClick={()=>void buildFocused(section.title,body,section.question)}><span>φ</span>{building===section.title?"Building…":"Research this question as a new site"}</button></div><div className={styles.sectionActions}><button type="button" onClick={()=>toggleCard(body)}>{chosen?"Remove from deeper edition":"Add to deeper edition"}</button>{section.source?.url&&<a href={section.source.url} target="_blank" rel="noreferrer">Source <ExternalLink size={14}/></a>}</div></div>
        {section.images[1]&&<img className={styles.secondaryImage} src={section.images[1].url} alt={section.images[1].title} loading="lazy" decoding="async"/>}
      </section>;})}</div>{sections.length>5&&<button className={styles.readMore} onClick={()=>setOpenStory((v)=>!v)}>{openStory?"Show a shorter reading path":"Continue the full story"}<ChevronDown size={17} className={openStory?styles.rotate:""}/></button>}</section>
      <section className={styles.deeper}><div><span>φ</span><div className={styles.eyebrow}>Your reading path</div><h2>{chosenCards.length?`${chosenCards.length} selected sections can now become a tighter edition.`:"Select the sections that deserve a more focused edition."}</h2></div>{chosenCards.length>0&&<button onClick={()=>void printDeeper()}><Sparkles size={18}/> Build the deeper edition</button>}</section>
      <details id="sources" className={styles.sources}><summary><span><span className={styles.eyebrow}>Sources</span><b>Supporting source library</b></span><small>{sources.length} sources - tap to expand</small><ChevronDown size={18}/></summary><div className={styles.sourceGrid}>{sources.slice(0,36).map((source,index)=><a key={`${source.url}-${index}`} href={source.url||"#"} target={source.url?"_blank":undefined} rel={source.url?"norefrerrer":undefined}><small>{source.provider}</small><b>{source.title}</b><p>{source.excerpt}</p><ExternalLink size={15}/></a>)}</div></details>
    </article><footer className={styles.footer}><b>Infinity</b><span>{visualLoading?`The publication is already readable while the visual library continues filling in (${images.length} distinct images so far).`:`${images.length} distinct visual candidates were gathered around this edition.`}</span></footer>
  </main>;
}
