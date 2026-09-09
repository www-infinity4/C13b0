"use client";

import { useEffect, useState } from "react";
import PhiCreator from "@/components/PhiCreator";
import PhiSpreadsheetCreator from "@/components/PhiSpreadsheetCreator";

export default function PhiCreateRouter(){
  const [kind,setKind]=useState<"loading"|"sheet"|"other">("loading");
  useEffect(()=>{const q=(new URLSearchParams(location.search).get("q")||"").toLowerCase();setKind(/spreadsheet|sheet|table|budget|tracker|inventory|csv|xlsx|workbook/.test(q)?"sheet":"other")},[]);
  if(kind==="loading")return null;
  return kind==="sheet"?<PhiSpreadsheetCreator/>:<PhiCreator/>;
}
