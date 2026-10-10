"use client";
import { useEffect } from "react";

/**
 * Infinity and Omni use one Code Phi runtime, rather than two diverging
 * iteration engines. The original token and query travel in the URL.
 * The separate /phi/code/builder/ route remains available as the companion
 * Infinity starter builder and sends its HTML to the shared Oracle viewer.
 */
export default function SharedCodePhiPage() {
  useEffect(() => {
    const target = new URL("https://quantaphi.org/omni-phi/code/");
    target.search = window.location.search;
    target.hash = window.location.hash;
    target.searchParams.set("from", "infinity");
    window.location.replace(target.href);
  }, []);

  return <main style={{minHeight:"100dvh",padding:"28px",fontFamily:"system-ui",background:"#21133b",color:"#fff"}}>
    <h1>Code Phi · Oracle Viewer</h1>
    <p>Opening the shared Infinity and Omni website builder, preserving this search.</p>
    <p><a style={{color:"#ffdc6b"}} href="https://quantaphi.org/omni-phi/code/">Open Code Phi</a></p>
  </main>;
}
