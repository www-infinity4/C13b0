"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import PhiPage from "./phi/page";

const base = process.env.NODE_ENV === "production" ? "/C13b0" : "";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [showPhi, setShowPhi] = useState(false);
  const route = (path: string) => `${base}${path}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q") || params.get("id")) setShowPhi(true);
  }, []);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;

    // Infinity Phi now owns the repository root. Search never leaves the
    // canonical index, so old /phi, /spark and PWA entry points cannot race
    // the main experience.
    const url = `${route("/")}?q=${encodeURIComponent(q)}&run=1`;
    window.history.pushState({}, "", url);
    setShowPhi(true);
  }

  if (showPhi) return <PhiPage />;

  return (
    <main style={{minHeight:"100dvh",background:"radial-gradient(circle at 50% 42%,#12375c 0,#082744 28%,#06192d 58%,#040d18 100%)",color:"white",fontFamily:"Arial Black,Arial,Helvetica,sans-serif",padding:"max(22px,env(safe-area-inset-top)) 22px 48px"}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:64}}>
          <Link href={route("/")} style={{color:"white",textDecoration:"none",fontSize:22,fontWeight:900,letterSpacing:6,lineHeight:1}}>INFINITY</Link>
          <details style={{position:"relative"}}>
            <summary aria-label="Open menu" style={{cursor:"pointer",listStyle:"none",fontSize:30,lineHeight:1,border:"1px solid #ffffff55",borderRadius:999,width:58,height:58,display:"grid",placeItems:"center",fontFamily:"Arial,Helvetica,sans-serif"}}>☰</summary>
            <nav style={{position:"absolute",right:0,marginTop:8,width:220,padding:16,borderRadius:18,background:"#fff",color:"#07111f",zIndex:20,boxShadow:"0 20px 60px #0008"}}>
              <Link href={route("/")} style={{display:"block",color:"#1467d8",fontWeight:900,textDecoration:"none"}}>Infinity Phi</Link>
            </nav>
          </details>
        </header>

        <section style={{minHeight:"calc(100dvh - 150px)",display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center",padding:"4vh 0 10vh"}}>
          <button type="button" onClick={()=>setShowPhi(true)} aria-label="Open Infinity Phi" style={{width:132,height:132,border:0,borderRadius:999,margin:"0 auto 30px",display:"grid",placeItems:"center",background:"linear-gradient(145deg,#a855f7,#6d28d9)",color:"white",boxShadow:"0 0 0 16px #8b5cf622,0 30px 90px #0008,0 0 55px #8b5cf655",font:"64px Georgia,serif",cursor:"pointer"}}>φ</button>
          <h1 style={{fontSize:"clamp(48px,14vw,84px)",fontWeight:900,lineHeight:.9,letterSpacing:-4,margin:"0 0 38px",color:"#4ea1ff",textShadow:"0 8px 35px #0008,0 0 30px #1677ff55"}}>Infinity Phi</h1>
          <form onSubmit={search} style={{display:"flex",alignItems:"center",background:"#fff",border:"3px solid #4ea1ff",borderRadius:999,padding:6,boxShadow:"0 22px 70px #0007,0 0 28px #1677ff33"}}>
            <input value={query} onChange={(event)=>setQuery(event.target.value)} aria-label="Search Infinity Phi" autoComplete="off" placeholder="Search anything" style={{minWidth:0,flex:1,border:0,outline:0,padding:"15px 18px",fontSize:19,fontWeight:700,borderRadius:999,background:"#fff",color:"#07111f",caretColor:"#6d28d9",fontFamily:"Arial,Helvetica,sans-serif"}} />
            <button type="submit" style={{border:0,borderRadius:999,padding:"15px 22px",background:"#1467d8",color:"white",fontWeight:900,fontSize:17,cursor:"pointer"}}>Search</button>
          </form>
        </section>
      </div>
    </main>
  );
}
