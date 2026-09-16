"use client";

import { useLayoutEffect } from "react";
import { appPath } from "@/lib/base-path";

export default function InfinityPhiRootRedirect() {
  useLayoutEffect(() => {
    const target = `${appPath("phi")}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);

  return (
    <main className="grid min-h-[100svh] place-items-center bg-[#06131f] px-6 text-center text-white">
      <a
        href={appPath("phi")}
        className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-black"
      >
        Open Infinity Phi results
      </a>
    </main>
  );
}
