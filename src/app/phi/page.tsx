"use client";

import { useEffect } from "react";
import { appPath } from "@/lib/base-path";

export default function CanonicalInfinityPhiRedirect() {
  useEffect(() => {
    const incoming = new URL(window.location.href);
    const tokenId = incoming.searchParams.get("id") || "";
    const codeHandoff = incoming.searchParams.get("codeHandoff") === "1";

    // A Code Phi completion is not a search redirect. It belongs to the
    // selected Infinity token's website workspace, where the saved Code Phi
    // handoff is consumed and incorporated into that token's page.
    if (codeHandoff && tokenId) {
      const target = new URL(appPath("studio/build"), window.location.origin);
      target.searchParams.set("id", tokenId);
      target.searchParams.set("mode", "preview");
      target.searchParams.set("codeHandoff", "1");
      window.location.replace(target.toString());
      return;
    }

    const target = new URL("../", window.location.href);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
  }, []);

  return (
    <main className="grid min-h-[70vh] place-items-center px-5 text-center">
      <div>
        <p className="text-sm font-black uppercase tracking-[.16em] text-violet-700">Infinity Phi</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Connecting your selected token…</h1>
        <p className="mt-3 text-sm text-slate-600">Code Phi designs open in that token's Infinity website workspace.</p>
      </div>
    </main>
  );
}
