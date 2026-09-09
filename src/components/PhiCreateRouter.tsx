"use client";

import { useEffect, useState } from "react";
import PhiCreatorV2 from "@/components/PhiCreatorV2";
import PhiSpreadsheetCreatorV2 from "@/components/PhiSpreadsheetCreatorV2";
import { capabilitiesFor } from "@/lib/coder-capabilities";

export default function PhiCreateRouter(){
  const [kind,setKind]=useState<"loading"|"sheet"|"other">("loading");
  useEffect(()=>{
    const q=(new URLSearchParams(location.search).get("q")||"").toLowerCase();
    const plan=capabilitiesFor(q,"create");
    const spreadsheetEngine=plan.some((cap)=>
      cap.tags.some((tag)=>["spreadsheet","xlsx","csv","workbook","grid","table","database"].includes(tag.toLowerCase())) ||
      cap.artifacts?.some((artifact)=>/spreadsheet|workbook|data grid|business table/i.test(artifact))
    );
    setKind(spreadsheetEngine||/spreadsheet|sheet|table|budget|tracker|inventory|csv|xlsx|workbook/.test(q)?"sheet":"other");
  },[]);
  if(kind==="loading")return null;
  return kind==="sheet"?<PhiSpreadsheetCreatorV2/>:<PhiCreatorV2/>;
}
