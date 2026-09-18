"use client";
import { useEffect, useState } from "react";
import { appPath } from "@/lib/base-path";

type Item={id:string;title:string;description:string;source:string;image:string;files:{name:string;url:string}[]};
const clean=(v:any)=>String(Array.isArray(v)?v[0]:v||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const SHARED="phiShared:collection:v1";
const NEWS="https://www-infinity4.github.io/News-Phi/";

function starShare(reference:string){
  try{
    const read=(k:string,f:any)=>{try{return JSON.parse(localStorage.getItem(k)||"null")||f}catch{return f}};
    const session=read("starquest_session",null),users=read("starquest_users",{}),signed=session?.key&&users[session.key];
    const w:any=signed||read("starquest_guest_profile_v1",{tokens:0,shareCount:0,pendingShareCredits:0,shareEvents:[],ledger:[]});
    w.tokens=Math.max(0,Number(w.tokens)||0);w.shareCount=Math.max(0,Number(w.shareCount)||0)+1;w.pendingShareCredits=Math.max(0,Number(w.pendingShareCredits)||0)+1;
    w.shareEvents=Array.isArray(w.shareEvents)?w.shareEvents:[];w.ledger=Array.isArray(w.ledger)?w.ledger:[];
    const id="phi-media-"+Date.now().toString(36);w.shareEvents.push({id,reference,method:"web_share_api",confirmed:true,createdAt:Date.now()});
    let awarded=0;while(w.pendingShareCredits>=10){w.pendingShareCredits-=10;w.tokens++;awarded++}
    w.ledger.push({id:"tx-"+id,type:awarded?"share_reward":"share_credit",amount:awarded,balance:w.tokens,pendingShareCredits:w.pendingShareCredits,referenceId:id,createdAt:Date.now()});
    if(signed){users[session.key]=w;localStorage.setItem("starquest_users",JSON.stringify(users))}else localStorage.setItem("starquest_guest_profile_v1",JSON.stringify(w));
    window.dispatchEvent(new Event("infinity-wallet-updated"));return awarded?"Shared · 1 StarCoin!":`Shared · ${w.pendingShareCredits}/10 ⭐`;
  }catch{return"Shared ✓"}
}

export default function ArchiveMediaFeed({kind}:{kind:"audio"|"video"}){
  const[q,setQ]=useState(""),[items,setItems]=useState<Item[]>([]),[busy,setBusy]=useState(false),[collected,setCollected]=useState<Record<string,boolean>>({}),[shared,setShared]=useState<Record<string,string>>({});
  async function run(term:string){if(!term)return;setBusy(true);try{const u=new URL("https://archive.org/advancedsearch.php");u.search=new URLSearchParams({q:`(${term}) AND mediatype:${kind==="audio"?"audio":"movies"}`,"fl[]":"identifier,title,description",rows:"40",page:"1",output:"json"}).toString();const d=await(await fetch(u)).json();const docs=(d.response?.docs||[]).slice(0,20);const built=(await Promise.all(docs.map(async(x:any)=>{const id=clean(x.identifier);try{const m=await(await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`)).json(),ok=kind==="audio"?/\.(mp3|ogg|oga|flac|m4a)$/i:/\.(mp4|ogv|webm|m4v)$/i,files=(m.files||[]).filter((z:any)=>ok.test(z.name||"")&&!/sample|thumb/i.test(z.name||"")).slice(0,20).map((z:any)=>({name:clean(z.title||z.name),url:`https://archive.org/download/${encodeURIComponent(id)}/${String(z.name).split("/").map(encodeURIComponent).join("/")}`}));return files.length?{id,title:clean(x.title)||id,description:clean(x.description),source:`https://archive.org/details/${encodeURIComponent(id)}`,image:`https://archive.org/services/img/${encodeURIComponent(id)}`,files}:null}catch{return null}}))).filter(Boolean) as Item[];setItems(built)}finally{setBusy(false)}}
  useEffect(()=>{const t=new URLSearchParams(location.search).get("q")||"";setQ(t);if(t)void run(t)},[]);

  function record(x:Item){return{id:`archive-${kind}-${x.id}`,storyKey:x.source,title:x.title,sourceTitle:x.title,extract:x.description,url:x.source,domain:"archive.org",provider:"Internet Archive",image:x.image,imageVerified:true,sourceBacked:true,sourceLocked:true,searchQuery:q,collectedAt:new Date().toISOString(),collectedFrom:"Infinity Phi",mediaKind:kind,files:x.files}}
  function collect(x:Item){const card=record(x);let list:any[]=[];try{const raw=JSON.parse(localStorage.getItem(SHARED)||"[]");list=Array.isArray(raw)?raw:[]}catch{}const i=list.findIndex(v=>(v?.storyKey||v?.url||v?.id)===card.storyKey);if(i>=0)list[i]={...list[i],...card};else list.unshift(card);try{localStorage.setItem(SHARED,JSON.stringify(list.slice(0,300)))}catch{}window.dispatchEvent(new CustomEvent("controlphi:shared",{detail:{source:"infinity-phi",storyKey:card.storyKey}}));setCollected(v=>({...v,[x.id]:true}))}
  function newsUrl(x:Item,similar=false){const p=new URLSearchParams({collect:"1",from:"infinity-phi",sharedTitle:x.title,sharedBody:x.description.slice(0,1800),sharedUrl:x.source,sharedImage:x.image,sharedDomain:"archive.org",sharedQuery:q});if(similar)p.set("buildSimilar","1");return`${NEWS}?${p.toString()}#story=${encodeURIComponent(x.source)}`}
  async function share(x:Item){const url=newsUrl(x);if(!navigator.share){try{await navigator.clipboard.writeText(url);setShared(v=>({...v,[x.id]:"Link copied"}))}catch{}return}try{await navigator.share({title:x.title,text:x.description.slice(0,320),url});setShared(v=>({...v,[x.id]:starShare(url)}))}catch(e:any){if(e?.name!=="AbortError")setShared(v=>({...v,[x.id]:"Share again"}))}}

  return <main className="min-h-screen bg-white text-slate-950"><div className="mx-auto max-w-6xl px-4 pb-24 pt-20">
    <a href={appPath("phi")} className="font-black text-violet-700">← Infinity Phi</a>
    <h1 className="mt-4 text-4xl font-black">{kind==="audio"?"Audio φ":"Video φ"}</h1>
    <p className="mt-2 text-slate-600">Infinity Phi playable Internet Archive results. Collect, build and share these cards through the same Infinity card connections.</p>
    <form className="mt-5 flex gap-2" onSubmit={e=>{e.preventDefault();void run(q)}}><input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-3 text-slate-950" value={q} onChange={e=>setQ(e.target.value)}/><button className="rounded-xl bg-violet-700 px-5 font-black text-white">{busy?"Searching…":"Search"}</button></form>
    <section className="mt-7 grid gap-5 md:grid-cols-2">{items.map(x=><article key={x.id} className="overflow-hidden rounded-[26px] border-2 border-orange-400 bg-white text-slate-950 shadow-lg">
      <img src={x.image} alt={x.title} className="h-48 w-full object-cover"/><div className="p-5"><small className="font-black text-orange-700">Internet Archive · Infinity Phi</small><h2 className="mt-1 text-xl font-black text-slate-950">{x.title}</h2>{x.description&&<p className="mt-2 text-sm text-slate-700">{x.description.slice(0,300)}</p>}
      <div className="mt-4 space-y-3">{x.files.slice(0,20).map(z=><div key={z.url}><b className="mb-1 block text-xs text-slate-700">{z.name}</b>{kind==="audio"?<audio controls preload="none" className="w-full" src={z.url}/>:<video controls preload="metadata" className="w-full rounded-xl bg-black" src={z.url}/>}</div>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={()=>collect(x)} className="rounded-full bg-emerald-800 px-4 py-2 text-xs font-black text-white">{collected[x.id]?"✓ Collected":"Collect"}</button>
        <a href={`${appPath("phi/build")}?${new URLSearchParams({q,focus:x.title})}`} className="rounded-full bg-yellow-300 px-4 py-2 text-xs font-black text-red-950">Build this story</a>
        <a href={newsUrl(x,true)} className="rounded-full bg-violet-800 px-4 py-2 text-xs font-black text-white">Build similar cards</a>
        <button type="button" onClick={()=>void share(x)} className="rounded-full bg-amber-800 px-4 py-2 text-xs font-black text-white">{shared[x.id]||"Share card · +1/10 ⭐"}</button>
        <a href={x.source} target="_blank" rel="noopener" className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white">Internet Archive source</a>
      </div></div></article>)}</section>
    {!busy&&q&&!items.length&&<p className="mt-8">No playable {kind} files returned on this pass.</p>}
  </div></main>
}