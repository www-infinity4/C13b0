"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type HistoryItem={query:string;resolved:string;kind:string;at:number};
const HISTORY="infinity_phi_context_v1";
const ELEMENTS:Record<string,{symbol:string;number:number}>={
 hydrogen:{symbol:"H",number:1},helium:{symbol:"He",number:2},boron:{symbol:"B",number:5},carbon:{symbol:"C",number:6},nitrogen:{symbol:"N",number:7},oxygen:{symbol:"O",number:8},fluorine:{symbol:"F",number:9},aluminum:{symbol:"Al",number:13},potassium:{symbol:"K",number:19},iron:{symbol:"Fe",number:26},copper:{symbol:"Cu",number:29},arsenic:{symbol:"As",number:33},selenium:{symbol:"Se",number:34},yttrium:{symbol:"Y",number:39},niobium:{symbol:"Nb",number:41},antimony:{symbol:"Sb",number:51},iodine:{symbol:"I",number:53},ytterbium:{symbol:"Yb",number:70},hafnium:{symbol:"Hf",number:72},tantalum:{symbol:"Ta",number:73},tungsten:{symbol:"W",number:74},rhenium:{symbol:"Re",number:75},platinum:{symbol:"Pt",number:78},gold:{symbol:"Au",number:79},mercury:{symbol:"Hg",number:80},lead:{symbol:"Pb",number:82},bismuth:{symbol:"Bi",number:83},uranium:{symbol:"U",number:92},dysprosium:{symbol:"Dy",number:66}
};
const MUSIC=/\b(queen|freddie|music|song|album|singer|band|rock|vocal|concert)\b/i;
const SCIENCE=/\b(element|atom|atomic|chem|chemistry|metal|oxide|ion|alloy|periodic|material|molecule|electron|isotope|physics|rhenium|helium|yttrium|dysprosium|bismuth|antimony|fluorine)\b/i;
function resolve(query:string,history:HistoryItem[]){
 const raw=query.trim(), lower=raw.toLowerCase();
 if(lower!=="mercury"){
  const e=ELEMENTS[lower];
  return e?{kind:"element",resolved:`${raw} chemical element ${e.symbol} atomic number ${e.number}`,element:e}:{kind:"general",resolved:raw};
 }
 const context=history.slice(-24).map(x=>`${x.query} ${x.resolved} ${x.kind}`).join(" ");
 if(SCIENCE.test(context)||!MUSIC.test(context)) return {kind:"element",resolved:"Mercury chemical element Hg atomic number 80",element:ELEMENTS.mercury};
 return {kind:"music",resolved:"Mercury music Queen Freddie Mercury"};
}

export default function PhiPage(){
 const [query,setQuery]=useState(""); const [history,setHistory]=useState<HistoryItem[]>([]); const [result,setResult]=useState<ReturnType<typeof resolve>|null>(null);
 useEffect(()=>{try{setHistory(JSON.parse(localStorage.getItem(HISTORY)||"[]"))}catch{}},[]);
 const recent=useMemo(()=>history.slice(-6).reverse(),[history]);
 function submit(e:FormEvent){e.preventDefault();if(!query.trim())return;const r=resolve(query,history);setResult(r);const next=[...history,{query:query.trim(),resolved:r.resolved,kind:r.kind,at:Date.now()}];setHistory(next);localStorage.setItem(HISTORY,JSON.stringify(next));}
 return <main style={{minHeight:"100dvh",background:"#06172b",color:"white",fontFamily:"system-ui,-apple-system,sans-serif",padding:"max(22px,env(safe-area-inset-top)) 20px 60px"}}><div style={{maxWidth:780,margin:"auto"}}>
  <header style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><Link href="/" style={{color:"white",textDecoration:"none",fontWeight:900,letterSpacing:4}}>INFINITY</Link><span style={{fontSize:12,color:"#8db6d9"}}>PHI / NEW ENGINE</span></header>
  <section style={{padding:"10vh 0 34px"}}><div style={{width:78,height:78,borderRadius:999,background:"#e3322b",display:"grid",placeItems:"center",font:"38px Georgia",marginBottom:25}}>φ</div><h1 style={{fontSize:"clamp(38px,10vw,70px)",lineHeight:1,margin:"0 0 14px"}}>Search with context.</h1><p style={{color:"#b9cee2",fontSize:18,lineHeight:1.55,maxWidth:620}}>This is the first clean-sheet Phi route. Meaning is resolved from the active subject and accumulated search context before research retrieval.</p></section>
  <form onSubmit={submit} style={{display:"flex",background:"white",borderRadius:999,padding:7}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try Bismuth, then Mercury…" style={{flex:1,minWidth:0,border:0,outline:0,borderRadius:999,padding:"12px 14px",fontSize:17}}/><button style={{border:0,borderRadius:999,background:"#e3322b",color:"white",fontWeight:900,padding:"12px 18px"}}>Research</button></form>
  {result&&<section style={{marginTop:28,padding:22,borderRadius:24,background:"#fff",color:"#071526"}}><div style={{fontSize:12,fontWeight:900,color:"#3877a8",letterSpacing:1}}>CONTEXT RESOLUTION</div><h2 style={{fontSize:30,margin:"8px 0"}}>{query}</h2><p style={{fontSize:17,lineHeight:1.55,margin:"0 0 14px"}}>Resolved research subject: <strong>{result.resolved}</strong></p>{result.kind==="element"&&result.element&&<div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{width:74,height:74,border:"2px solid #0a4d87",borderRadius:14,display:"grid",placeItems:"center",fontSize:30,fontWeight:900}}>{result.element.symbol}</div><div><b>Atomic number {result.element.number}</b><br/><span style={{color:"#587087"}}>Element context is locked before retrieval.</span></div></div>}<p style={{marginTop:18,paddingTop:16,borderTop:"1px solid #dbe4ec",color:"#587087",lineHeight:1.5}}>Next stage: this resolved subject feeds the new multi-source ResearchPackage. It will not hand off to the broken Spark builder.</p></section>}
  {recent.length>0&&<section style={{marginTop:30}}><h2 style={{fontSize:15,letterSpacing:2,color:"#8db6d9"}}>ACTIVE CONTEXT</h2>{recent.map((x,i)=><div key={`${x.at}-${i}`} style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.12)"}}><b>{x.query}</b><div style={{fontSize:13,color:"#9db7ce"}}>{x.resolved}</div></div>)}</section>}
 </div></main>
}
