import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Infinity Phi",
  description: "The clean-sheet Infinity Phi search, research, and website system.",
};

export default function HomePage() {
  return (
    <main style={{minHeight:"100dvh",background:"linear-gradient(180deg,#06172b 0%,#0a2747 58%,#07111f 100%)",color:"white",fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",padding:"max(24px,env(safe-area-inset-top)) 22px 48px"}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16}}>
          <strong style={{fontSize:18,letterSpacing:5,textTransform:"uppercase"}}>Infinity</strong>
          <details style={{position:"relative"}}>
            <summary aria-label="Open menu" style={{cursor:"pointer",listStyle:"none",fontSize:27,border:"1px solid rgba(255,255,255,.28)",borderRadius:999,padding:"7px 13px"}}>☰</summary>
            <nav style={{position:"absolute",right:0,top:54,width:220,padding:14,borderRadius:18,background:"#fff",color:"#07111f",boxShadow:"0 18px 50px rgba(0,0,0,.3)",zIndex:10}}>
              <div style={{fontWeight:800,marginBottom:8}}>Infinity Phi</div>
              <div style={{fontSize:14,lineHeight:1.6}}>New clean-sheet system is now the primary index.</div>
              <Link href="/legacy-spark" style={{display:"block",marginTop:12,color:"#0a4d87"}}>Legacy Spark</Link>
            </nav>
          </details>
        </header>

        <section style={{padding:"16vh 0 8vh",textAlign:"center"}}>
          <div aria-hidden="true" style={{width:104,height:104,borderRadius:"50%",margin:"0 auto 28px",display:"grid",placeItems:"center",background:"#e3322b",boxShadow:"0 0 0 16px rgba(227,50,43,.08),0 28px 80px rgba(0,0,0,.28)",fontSize:48,fontFamily:"Georgia,serif"}}>φ</div>
          <h1 style={{fontSize:"clamp(38px,11vw,74px)",lineHeight:.98,letterSpacing:-2,margin:"0 0 18px"}}>Infinity Phi</h1>
          <p style={{maxWidth:620,margin:"0 auto 34px",fontSize:"clamp(17px,4.5vw,21px)",lineHeight:1.55,color:"#c8d9eb"}}>A new search-to-build system is taking over this index. The broken Spark builder has been moved out of the primary path instead of being allowed to strand searches.</p>
          <form action="/legacy-spark" method="get" style={{display:"flex",background:"white",borderRadius:999,padding:7,boxShadow:"0 22px 70px rgba(0,0,0,.3)"}}>
            <input name="q" aria-label="Search Infinity" placeholder="Search anything…" style={{minWidth:0,flex:1,border:0,outline:0,padding:"12px 15px",fontSize:17,borderRadius:999}} />
            <button type="submit" style={{border:0,borderRadius:999,padding:"12px 19px",background:"#e3322b",color:"white",fontWeight:800,fontSize:16}}>Search</button>
          </form>
          <p style={{marginTop:15,fontSize:13,color:"#8fa9c2"}}>Legacy search remains available temporarily while the new Phi research engine and website generator replace it.</p>
        </section>

        <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {[['01','Context','History helps determine what a query means before retrieval.'],['02','Research','A complete research package stays attached to its exact token.'],['03','Storyboard','Research becomes a visual script before a website is composed.'],['04','Build','The generated site inherits the research instead of losing it.']].map(([n,t,d])=><article key={n} style={{padding:18,border:"1px solid rgba(255,255,255,.13)",borderRadius:20,background:"rgba(255,255,255,.055)"}}><div style={{fontSize:12,color:"#78bff4",fontWeight:800}}>{n}</div><h2 style={{fontSize:18,margin:"8px 0"}}>{t}</h2><p style={{fontSize:14,lineHeight:1.5,color:"#b9cce0",margin:0}}>{d}</p></article>)}
        </section>
      </div>
    </main>
  );
}
