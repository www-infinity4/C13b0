"use client";
import { useEffect, useState } from "react";
import { resolvePhiSearchToken, syncPhiSearchTokenResearch } from "@/lib/phi-search-token";
import { appPath } from "@/lib/base-path";

type Source = { title: string; url: string; excerpt: string; provider?: string; selectionReason?: string; readScope?: string };
type Result = { title: string; sources: Source[]; websiteUrl: string; tokenId: string };
export default function BubblesResearch() {
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  const id=new URL(location.href).searchParams.get("id")||"";
  try{
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error("Invalid research handoff");
   const packet=JSON.parse(localStorage.getItem("bubbles:research:"+id)||sessionStorage.getItem("bubbles:research:"+id)||"null");
   if(!packet||packet.id!==id||typeof packet.query!=="string"||!packet.query.trim())throw Error("Research packet is missing in this browser session");
   const sources:Source[]=(Array.isArray(packet.sources)?packet.sources:[]).filter((source:Source)=>{
    try{const url=new URL(source.url);return url.protocol==="https:"&&!url.username&&!url.password;}catch{return false;}
   }).slice(0,8).map((source:Source)=>({...source,title:String(source.title||"").slice(0,300),excerpt:String(source.excerpt||"").slice(0,2400)}));
   if(!sources.length)throw Error("No verified research sources");
   const saved=localStorage.getItem("bubbles:research-token:"+id)||sessionStorage.getItem("bubbles:research-token:"+id)||id;
   const token=resolvePhiSearchToken(packet.query.slice(0,500),saved);
   localStorage.setItem("bubbles:research-token:"+id,token.id);
   const savedTokens=JSON.parse(localStorage.getItem("infinityPhi:searchTokens:v1")||"[]");
   if(!Array.isArray(savedTokens)||!savedTokens.some((saved:{id?:string})=>saved.id===token.id))throw Error("Search token persistence was not confirmed");
   syncPhiSearchTokenResearch(token.id,token.query,{title:packet.title,resolved:packet.query,overview:String(packet.overview||"").slice(0,6000),sources});
   const site=new URL(appPath("studio/build"),location.origin);site.searchParams.set("id",token.id);site.searchParams.set("query",token.query);site.searchParams.set("mode","preview");
   setResult({title:packet.query,sources,websiteUrl:site.href,tokenId:token.id});
   // This receipt proves local token/research persistence and builder handoff.
   // It does not claim a server wallet credit, finished build or publication.
   window.parent.postMessage({type:"infinity:bubbles-research-result",id,tokenId:token.id,websiteUrl:site.href,websiteStatus:"requested",walletCreditVerified:false},location.origin);
  }catch(reason){const message=reason instanceof Error?reason.message:"Research handoff failed";setError(message);window.parent.postMessage({type:"infinity:bubbles-research-result",id,error:message},location.origin);}
 },[]);
 return <main style={{background:"#f7f4f0",color:"#312722",padding:16,fontSize:16,borderRadius:18}}>
  <h1 style={{fontSize:22}}>Infinity Phi · Article research</h1>
  {error?<p role="alert">{error}</p>:!result?<p role="status">Connecting research to your search token…</p>:<>
   <h2 style={{fontSize:20}}>{result.title}</h2>
   <p role="status">Research saved to {result.tokenId}. Website build requested. Wallet credit and publication have separate receipts.</p>
   <a href={result.websiteUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-block",padding:12,color:"#b83b32",minHeight:44}}>Open research website</a>
   {result.sources.map(source=><article key={source.url} style={{background:"white",padding:14,marginTop:12,borderRadius:18}}><h3><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></h3><p>{source.excerpt}</p><small>{source.provider} · {source.selectionReason} {source.readScope}</small></article>)}
   <iframe title="Research website builder" src={result.websiteUrl} style={{width:"100%",height:520,border:0,marginTop:16}} />
  </>}
 </main>;
}
