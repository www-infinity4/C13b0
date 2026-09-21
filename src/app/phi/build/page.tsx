"use client";

import { useEffect, useState } from "react";
import PhiWorkbenchV3 from "@/components/PhiWorkbenchV3";
import { appPath } from "@/lib/base-path";

export default function PhiBuildRoute() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "website") {
      setAllowed(true);
      return;
    }
    const next = new URLSearchParams();
    const query = params.get("q")?.trim() || "";
    const token = params.get("token")?.trim() || "";
    if (query) next.set("q", query);
    next.set("run", "1");
    if (token) next.set("token", token);
    window.location.replace(`${appPath("phi")}?${next.toString()}`);
  }, []);

  if (!allowed) {
    return <main className="min-h-screen bg-white p-6 font-black text-slate-900">Opening AI Overview…</main>;
  }
  return <PhiWorkbenchV3 />;
}
