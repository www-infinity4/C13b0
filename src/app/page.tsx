import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Infinity Phi",
  description: "Infinity Phi search, research, and build engine.",
};

export default function HomePage() {
  return (
    <main style={{minHeight:"100dvh",background:"radial-gradient(circle at 50% 42%,#12375c 0,#082744 28%,#06192d 58%,#040d18 100%)",color:"white",fontFamily:"Arial Black,Arial,Helvetica,sans-serif",padding:"max(22px,env(safe-area-inset-top)) 22px 48px"}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",minHeight:64}}>
          <Link href="/" style={{color:"white",textDecoration:"none",fontSize:22,fontWeight:900,letterSpacing:6,lineHeight:1}}>INFINITY</Link>
          <details style={{position:"relative"}}>
            <summary aria-label="Open menu" style={{cursor:"pointer",listStyle:"none",fontSize:30,lineHeight:1,border:"1px solid #ffffff55",borderRadius:999,width:58,height:58,display:"grid",placeItems:"center",fontFamily:"Arial,Helvetica,sans-serif"}}>☰</summary>
            <nav style={{position:"absolute",right:0,marginTop:8,width:220,padding:16,borderRadius:18,background:"#fff",color:"#07111f",zIndex:20,boxShadow:"0 20px 60px #0008"}}>
              <Link href="/phi/" style={{display:"block",color:"#0a4d87",fontWeight:900,textDecoration:"none"}}>Phi Search</Link>
              <Link href="/infinity-index/" style={{display:"block",marginTop:14,color:"#243b53",fontWeight:800,textDecoration:"none"}}>Infinity Index</Link>
              <Link href="/legacy-spark/" style={{display:"block",marginTop:14,color:"#64788c",fontWeight:800,textDecoration:"none"}}>Legacy Spark</Link>
            </nav>
          </details>
        </header>

        <section style={{minHeight:"calc(100dvh - 150px)",display:"flex",flexDirection:"column",justifyContent:"center",textAlign:"center",padding:"4vh 0 10vh"}}>
          <Link href="/phi/" aria-label="Open Infinity Phi" style={{width:132,height:132,borderRadius:999,margin:"0 auto 30px",display:"grid",placeItems:"center",background:"#ed302b",color:"white",textDecoration:"none",boxShadow:"0 0 0 16px #ed302b12,0 30px 90px #0008",font:"64px Georgia,serif"}}>φ</Link>
          <h1 style={{fontSize:"clamp(48px,14vw,84px)",fontWeight:900,lineHeight:.9,letterSpacing:-4,margin:"0 0 38px",textShadow:"0 8px 35px #0008"}}>Infinity Phi</h1>
          <form action="./phi/" method="get" style={{display:"flex",alignItems:"center",background:"#fff",border:"3px solid #fff",borderRadius:999,padding:6,boxShadow:"0 22px 70px #0007"}}>
            <input name="q" aria-label="Search Infinity Phi" autoComplete="off" placeholder="Search anything" style={{minWidth:0,flex:1,border:0,outline:0,padding:"15px 18px",fontSize:19,fontWeight:700,borderRadius:999,background:"#fff",color:"#07111f",caretColor:"#ed302b",fontFamily:"Arial,Helvetica,sans-serif"}} />
            <button type="submit" style={{border:0,borderRadius:999,padding:"15px 22px",background:"#ed302b",color:"white",fontWeight:900,fontSize:17,cursor:"pointer"}}>Search</button>
          </form>
        </section>
      </div>
    </main>
  );
}
