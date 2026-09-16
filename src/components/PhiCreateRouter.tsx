"use client";

import { useEffect, useState } from "react";
import PhiCreatorV2 from "@/components/PhiCreatorV2";
import PhiSpreadsheetCreatorV2 from "@/components/PhiSpreadsheetCreatorV2";
import { capabilitiesFor } from "@/lib/coder-capabilities";

type RouteState = {
  kind: "loading" | "sheet" | "other";
  tools: string[];
};

export default function PhiCreateRouter(){
  const [route,setRoute]=useState<RouteState>({kind:"loading",tools:[]});

  useEffect(()=>{
    const q=(new URLSearchParams(location.search).get("q")||"").toLowerCase();
    const plan=capabilitiesFor(q,"create");
    const tools=plan.slice(0,6).map((cap)=>cap.name);
    const spreadsheetEngine=plan.some((cap)=>
      cap.tags.some((tag)=>["spreadsheet","xlsx","csv","workbook","grid","table","database"].includes(tag.toLowerCase())) ||
      cap.artifacts?.some((artifact)=>/spreadsheet|workbook|data grid|business table/i.test(artifact))
    );
    const kind=spreadsheetEngine||/spreadsheet|sheet|table|budget|tracker|inventory|csv|xlsx|workbook/.test(q)?"sheet":"other";
    try{
      sessionStorage.setItem("infinityPhi:createPlan:v1",JSON.stringify({query:q,intent:"create",tools,selectedAt:new Date().toISOString()}));
    }catch{}
    window.dispatchEvent(new CustomEvent("infinity:capabilities-selected",{detail:{intent:"create",query:q,tools}}));
    setRoute({kind,tools});
  },[]);

  const status=(
    <section style={{width:"min(920px,calc(100% - 28px))",margin:"14px auto",padding:"14px 16px",border:"1px solid rgba(169,116,255,.45)",borderRadius:16,background:"rgba(24,13,43,.94)",color:"white",fontFamily:"system-ui,sans-serif"}}>
      <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"8px 12px"}}>
        <strong style={{color:"#c89cff",letterSpacing:".08em"}}>CREATE PHI</strong>
        <span style={{color:"#d7cde6",fontSize:13}}>{route.kind==="loading"?"Selecting the right skills and tools…":route.kind==="sheet"?"Spreadsheet/data maker selected":"Creation maker selected"}</span>
      </div>
      {route.tools.length?<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>{route.tools.map((tool)=><span key={tool} style={{padding:"5px 8px",borderRadius:999,border:"1px solid rgba(200,156,255,.35)",background:"rgba(103,59,142,.25)",fontSize:12}}>{tool}</span>)}</div>:null}
    </section>
  );

  if(route.kind==="loading")return (
    <main style={{minHeight:"70vh",padding:"28px 0",background:"#080515"}}>
      {status}
    </main>
  );

  return (
    <main style={{minHeight:"100dvh",background:"#080515"}}>
      {status}
      {route.kind==="sheet"?<PhiSpreadsheetCreatorV2/>:<PhiCreatorV2/>}
    </main>
  );
}
