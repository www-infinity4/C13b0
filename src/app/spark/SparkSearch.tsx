"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function SparkSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) router.push(`/business?query=${encodeURIComponent(query.trim())}`);
  }
  return <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#050711] px-4 text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(124,58,237,.24),transparent_46%)]"/><form onSubmit={submit} className="relative w-full max-w-3xl text-center"><h1 className="shimmer-text text-6xl font-black tracking-[-.06em] sm:text-8xl">Infinity</h1><label className="mt-10 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[.07] p-2 shadow-2xl backdrop-blur-xl"><Search className="ml-3 text-cyan-300" aria-hidden="true"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} aria-label="Ask Infinity Spark" className="min-w-0 flex-1 bg-transparent px-2 py-4 text-lg outline-none" placeholder="Ask a question or describe what you want to build"/><button className="rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 px-5 py-4 font-black" aria-label="Begin research">Begin</button></label></form></main>;
}
