"use client";

import { useEffect } from "react";

export default function CanonicalInfinityPhiRedirect() {
  useEffect(() => {
    const target = new URL("../", window.location.href);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
  }, []);

  return (
    <main className="grid min-h-[70vh] place-items-center px-5 text-center">
      <div>
        <p className="text-sm font-black uppercase tracking-[.16em] text-violet-700">Infinity Phi</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Opening the canonical Infinity Phi search…</h1>
        <a className="mt-5 inline-flex rounded-full bg-violet-700 px-4 py-3 text-sm font-black text-white" href="../">Open Infinity Phi</a>
      </div>
    </main>
  );
}
