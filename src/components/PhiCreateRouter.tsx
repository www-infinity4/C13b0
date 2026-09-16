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

  if(route.kind==="loading")return (
    <main style={{minHeight:"70vh",display:"grid",placeItems:"center",padding:"32px 18px",background:"#080515",color:"white"}}>
      <section style={{width:"min(680px,100%)",padding:"26px",border:"1px solid rgba(169,116,255,.45)",borderRadius:22,background:"rgba(24,13,43,.88)"}}>
        <small style={{fontWeight:900,letterSpacing:".12em",color:"#c89cff"}}>CREATE PHI</small>
        <h1 style={{margin:"10px 0 8px",fontSize:"clamp(28px,7vw,46px)"}}>Selecting the right skills and tools…</h1>
        <p style={{margin:0,color:"#d7cde6",lineHeight:1.6}}>Create Phi is routing this request through the shared Infinity capability index before opening the maker.</p>
      </section>
    </main>
  );

  return route.kind==="sheet"?<PhiSpreadsheetCreatorV2/>:<PhiCreatorV2/>;
}
