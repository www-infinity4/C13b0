"use client";

import { useEffect, useState } from "react";
import PhiCreatorV2 from "@/components/PhiCreatorV2";
import PhiSpreadsheetCreatorV2 from "@/components/PhiSpreadsheetCreatorV2";
import PhiCodeBuilderStable from "@/components/PhiCodeBuilderStable";
import { CODER_CAPABILITIES, capabilitiesFor } from "@/lib/coder-capabilities";

type RouteState = {
  kind: "loading" | "sheet" | "live" | "other";
  tools: string[];
  imported: string[];
};

const importedCreateSkills = CODER_CAPABILITIES
  .filter((cap) => Boolean(cap.upstream) && cap.repo.startsWith("www-infinity4/") && (!cap.intents?.length || cap.intents.includes("create")))
  .map((cap) => cap.name);

export default function PhiCreateRouter(){
  const [route,setRoute]=useState<RouteState>({kind:"loading",tools:[],imported:importedCreateSkills});

  useEffect(()=>{
    const raw=new URLSearchParams(location.search).get("q")||"";
    const q=raw.toLowerCase();
    const plan=capabilitiesFor(q,"create");
    const tools=plan.slice(0,8).map((cap)=>cap.name);
    const spreadsheetEngine=plan.some((cap)=>
      cap.tags.some((tag)=>["spreadsheet","xlsx","csv","workbook","grid","table","database"].includes(tag.toLowerCase())) ||
      cap.artifacts?.some((artifact)=>/spreadsheet|workbook|data grid|business table/i.test(artifact))
    );
    const fixedDocument=/\b(invoice|letter|memo|receipt|proposal|report|document|docx|pdf|spreadsheet|sheet|csv|xlsx|workbook)\b/.test(q);
    const interactiveWords=/\b(website|site|app|application|game|interactive|calculator|search engine|marketplace|tool|player|record player|recorder|channel|audio|music|video|media|3d|webgl|webgpu|canvas|whiteboard|diagram|dashboard|chart|workflow|form|survey|quiz|editor|builder)\b/.test(q);
    const importedInteractive=plan.slice(0,4).some((cap)=>
      cap.repo.startsWith("www-infinity4/") && cap.tags.some((tag)=>/game|3d|audio|music|video|media|canvas|whiteboard|workflow|form|survey|quiz|chart|dashboard|visual|builder|editor/.test(tag.toLowerCase()))
    );
    const liveEngine=!fixedDocument&&(interactiveWords||importedInteractive);
    const kind=liveEngine?"live":spreadsheetEngine||/spreadsheet|sheet|table|budget|tracker|inventory|csv|xlsx|workbook/.test(q)?"sheet":"other";
    try{
      sessionStorage.setItem("infinityPhi:createPlan:v2",JSON.stringify({
        query:raw,
        intent:"create",
        tools,
        importedSkills:importedCreateSkills,
        importedSkillCount:importedCreateSkills.length,
        route:kind,
        selectedAt:new Date().toISOString()
      }));
    }catch{}
    window.dispatchEvent(new CustomEvent("infinity:capabilities-selected",{detail:{intent:"create",query:raw,tools,importedSkills:importedCreateSkills,route:kind}}));
    setRoute({kind,tools,imported:importedCreateSkills});
  },[]);

  const status=(
    <section style={{width:"min(920px,calc(100% - 28px))",margin:"14px auto",padding:"14px 16px",border:"1px solid rgba(169,116,255,.45)",borderRadius:16,background:"rgba(24,13,43,.94)",color:"white",fontFamily:"system-ui,sans-serif"}}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"8px 12px"}}>
        <strong style={{color:"#c89cff",letterSpacing:".08em"}}>CREATE PHI</strong>
        <span style={{color:"#d7cde6",fontSize:13}}>{route.kind==="loading"?`Indexing ${route.imported.length} imported skills…`:route.kind==="live"?`GPT live builder · all ${route.imported.length} imported skills available`:route.kind==="sheet"?`Spreadsheet/data maker · ${route.imported.length} imported skills indexed`:`Creation maker · ${route.imported.length} imported skills indexed`}</span>
      </div>
      {route.tools.length?<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>{route.tools.map((tool)=><span key={tool} style={{padding:"5px 8px",borderRadius:999,border:"1px solid rgba(200,156,255,.35)",background:"rgba(103,59,142,.25)",fontSize:12}}>{tool}</span>)}</div>:null}
      <details style={{marginTop:10}}>
        <summary style={{cursor:"pointer",color:"#86e3b0",fontSize:12,fontWeight:850}}>All {route.imported.length} imported skills</summary>
        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:7}}>{route.imported.map((tool)=><span key={tool} style={{padding:"4px 7px",borderRadius:999,border:"1px solid rgba(105,224,159,.25)",fontSize:11}}>{tool}</span>)}</div>
      </details>
    </section>
  );

  if(route.kind==="loading")return (
    <main style={{minHeight:"70vh",padding:"28px 0",background:"#080515"}}>
      {status}
    </main>
  );

  if(route.kind==="live")return (
    <div style={{minHeight:"100dvh",background:"#080515"}}>
      {status}
      <PhiCodeBuilderStable intentOverride="create" />
    </div>
  );

  return (
    <main style={{minHeight:"100dvh",background:"#080515"}}>
      {status}
      {route.kind==="sheet"?<PhiSpreadsheetCreatorV2/>:<PhiCreatorV2/>}
    </main>
  );
}
