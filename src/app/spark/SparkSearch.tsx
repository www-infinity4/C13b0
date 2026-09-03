"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, ExternalLink, LoaderCircle, Search, Sparkles } from "lucide-react";

type Source = { title: string; url: string; excerpt: string; kind: string };
type Report = { title: string; overview: string; findings: string[]; sources: Source[]; limitations: string };

const HISTORY_KEY = "c13b0_infinity_spark_history_v1";
const HANDOFF_KEY = "c13b0_infinity_spark_handoff_v1";

function plain(value: unknown) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function reportText(query: string, report: Report) {
  return `${report.title}\n\nQuestion\n${query}\n\nOverview\n${report.overview}\n\nKey findings\n${report.findings.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nLimits and uncertainty\n${report.limitations}`;
}

export default function SparkSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const router = useRouter();

  async function research(event: FormEvent) {
    event.preventDefault();
    const topic = query.trim();
    if (!topic || loading) return;
    setLoading(true); setError(""); setReport(null);
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(topic)}&gsrlimit=6&prop=extracts%7Cinfo&exintro=1&explaintext=1&inprop=url&format=json&origin=*`;
      const duckUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`;
      const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(topic)}&rows=4&select=DOI,title,abstract,URL,author,published`;
      const settled = await Promise.allSettled([
        fetch(wikiUrl).then(r => { if (!r.ok) throw new Error("Wikipedia unavailable"); return r.json(); }),
        fetch(duckUrl).then(r => { if (!r.ok) throw new Error("DuckDuckGo unavailable"); return r.json(); }),
        fetch(crossrefUrl).then(r => { if (!r.ok) throw new Error("Crossref unavailable"); return r.json(); }),
      ]);
      const wiki = settled[0].status === "fulfilled" ? settled[0].value : null;
      const duck = settled[1].status === "fulfilled" ? settled[1].value : null;
      const crossref = settled[2].status === "fulfilled" ? settled[2].value : null;
      const wikiPages = Object.values(wiki?.query?.pages || {}) as Array<{ title?: string; extract?: string; fullurl?: string; index?: number }>;
      wikiPages.sort((a, b) => Number(a.index || 99) - Number(b.index || 99));
      const sources: Source[] = wikiPages.filter(p => p.extract && p.fullurl).map(p => ({
        title: plain(p.title), url: String(p.fullurl), excerpt: plain(p.extract).slice(0, 520), kind: "Reference",
      }));
      const duckAbstract = plain(duck?.AbstractText);
      if (duckAbstract && duck?.AbstractURL) sources.unshift({
        title: plain(duck.Heading) || topic, url: String(duck.AbstractURL), excerpt: duckAbstract.slice(0, 520), kind: "Instant answer",
      });
      const papers = (crossref?.message?.items || []) as Array<{ title?: string[]; abstract?: string; URL?: string }>;
      papers.filter(p => p.title?.[0] && p.URL).forEach(p => sources.push({
        title: plain(p.title?.[0]), url: String(p.URL),
        excerpt: plain(p.abstract).slice(0, 420) || "Scholarly record located through Crossref; open the source to review its complete findings.",
        kind: "Scholarly record",
      }));
      if (!sources.length) throw new Error("No public sources returned a usable result.");
      const overviewParts = sources.filter(s => s.excerpt && !s.excerpt.startsWith("Scholarly record located")).slice(0, 2).map(s => s.excerpt);
      const findings = sources.slice(0, 6).map(s => `${s.title}: ${s.excerpt.slice(0, 250)}${s.excerpt.length > 250 ? "…" : ""}`);
      const next: Report = {
        title: `Infinity research report: ${topic}`,
        overview: overviewParts.join(" ") || `Public records related to ${topic} were located. Review the linked sources before relying on individual claims.`,
        findings, sources,
        limitations: "This is an automatic extractive report from public endpoints, not an expert verdict. Source coverage can be incomplete, snippets can omit context, and conflicting claims require direct source review.",
      };
      setReport(next);
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      localStorage.setItem(HISTORY_KEY, JSON.stringify([{ query: topic, report: next, createdAt: new Date().toISOString() }, ...history].slice(0, 25)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research failed. Please try again.");
    } finally { setLoading(false); }
  }

  function turnInto(siteType: string) {
    if (!report) return;
    localStorage.setItem(HANDOFF_KEY, JSON.stringify({
      query: query.trim(), report: reportText(query.trim(), report), sources: report.sources.map(s => s.url),
      overview: report.overview, siteType, createdAt: new Date().toISOString(),
    }));
    router.push(`/business?query=${encodeURIComponent(query.trim())}`);
  }

  return <main className="min-h-[calc(100vh-4rem)] bg-[#020504] text-[#f4f7f2]">
    <section className="relative overflow-hidden border-b border-emerald-300/20 px-4 py-16 sm:py-24">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(70,255,155,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(70,255,155,.08)_1px,transparent_1px)] [background-size:42px_42px]"/>
      <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-[100px]"/>
      <form onSubmit={research} className="relative mx-auto w-full max-w-4xl text-center">
        <div className="inline-flex items-center gap-2 border border-emerald-300/25 bg-emerald-300/[.06] px-3 py-1 text-xs font-black uppercase tracking-[.32em] text-emerald-300"><Sparkles size={14}/> Free public research</div>
        <h1 className="mt-6 font-serif text-6xl font-black tracking-[-.07em] text-white sm:text-8xl">Infinity <span className="text-emerald-300">Spark</span></h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/58">Ask once. Spark finds public sources, assembles the report, preserves the citations, and carries the work into a website asset.</p>
        <label className="mt-10 flex items-center gap-3 rounded-2xl border border-emerald-200/25 bg-[#07100c]/95 p-2 shadow-[0_25px_80px_rgba(0,255,135,.12)]">
          <Search className="ml-3 shrink-0 text-emerald-300" aria-hidden="true"/>
          <input autoFocus value={query} onChange={e=>setQuery(e.target.value)} aria-label="Ask Infinity Spark" className="min-w-0 flex-1 bg-transparent px-2 py-4 text-lg text-white outline-none placeholder:text-white/30" placeholder="What do you want to understand or build?"/>
          <button disabled={loading || !query.trim()} className="rounded-xl bg-emerald-300 px-5 py-4 font-black text-[#00150b] transition hover:bg-white disabled:opacity-40">{loading?<LoaderCircle className="animate-spin"/>:"Research"}</button>
        </label>
        <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs uppercase tracking-[.16em] text-white/35"><span>Wikipedia</span><span>DuckDuckGo</span><span>Crossref</span><span>Automatic citations</span></div>
      </form>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-10">
      {loading && <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[.04] p-10 text-center"><LoaderCircle className="mx-auto animate-spin text-emerald-300" size={34}/><p className="mt-4 font-bold">Retrieving and organizing public sources…</p></div>}
      {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100"><strong>Search did not complete.</strong> {error}</div>}
      {!loading && !report && !error && <div className="grid gap-4 sm:grid-cols-3">{[["01","RETRIEVE","Search public knowledge and scholarly records."],["02","REPORT","Organize findings, citations, and uncertainty."],["03","BUILD","Turn the report into a page, tool, or website-token draft."]].map(([n,t,d])=><div key={n} className="border-l border-emerald-300/30 bg-white/[.025] p-6"><div className="font-mono text-sm text-emerald-300">{n}</div><h2 className="mt-8 font-serif text-2xl font-black">{t}</h2><p className="mt-2 leading-7 text-white/50">{d}</p></div>)}</div>}
      {report && <article className="grid gap-7 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#07100c] p-6 shadow-2xl sm:p-9">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.25em] text-emerald-300"><BookOpen size={16}/> Research report</div>
          <h2 className="mt-4 font-serif text-4xl font-black leading-tight sm:text-5xl">{report.title}</h2>
          <h3 className="mt-9 text-sm font-black uppercase tracking-[.2em] text-[#e3bd66]">Overview</h3><p className="mt-3 text-lg leading-8 text-white/75">{report.overview}</p>
          <h3 className="mt-9 text-sm font-black uppercase tracking-[.2em] text-[#e3bd66]">Key findings</h3>
          <ol className="mt-4 space-y-4">{report.findings.map((finding,index)=><li key={finding} className="grid grid-cols-[32px_1fr] gap-3 leading-7 text-white/68"><span className="font-mono text-emerald-300">{String(index+1).padStart(2,"0")}</span><span>{finding}</span></li>)}</ol>
          <h3 className="mt-9 text-sm font-black uppercase tracking-[.2em] text-[#e3bd66]">Limits and uncertainty</h3><p className="mt-3 leading-7 text-white/55">{report.limitations}</p>
        </div>
        <aside className="space-y-5">
          <section className="rounded-3xl border border-[#e3bd66]/25 bg-[#e3bd66]/[.06] p-5"><h3 className="font-serif text-2xl font-black">Build from this research</h3><p className="mt-2 text-sm leading-6 text-white/55">One tap carries the report, citations, and provenance into the builder.</p><div className="mt-5 grid gap-2">{["Product page","Service page","Learning page","Research page","Tool or application"].map(type=><button key={type} onClick={()=>turnInto(type)} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left font-bold hover:border-emerald-300/40 hover:text-emerald-200"><span>{type}</span><ArrowRight size={17}/></button>)}</div></section>
          <section className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><h3 className="text-sm font-black uppercase tracking-[.2em] text-emerald-300">Sources</h3><div className="mt-4 space-y-3">{report.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block border-b border-white/10 pb-3 text-sm hover:text-emerald-200"><span className="block text-xs uppercase tracking-wider text-[#e3bd66]">{source.kind}</span><span className="mt-1 flex gap-2 font-semibold">{source.title}<ExternalLink size={13} className="mt-1 shrink-0"/></span></a>)}</div></section>
        </aside>
      </article>}
    </section>
  </main>;
}
