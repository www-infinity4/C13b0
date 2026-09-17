"use client";

import { useEffect } from "react";
import PhiSearchRouteGuard from "@/components/PhiSearchRouteGuard";
import { appPath } from "@/lib/base-path";

export default function InfinityImageRouteGuard() {
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!label.startsWith("images")) return;

      const resultsArea = button.closest("main");
      if (!resultsArea) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const params = new URLSearchParams(window.location.search);
      const q = params.get("q")?.trim() || "";
      const targetPath = appPath("phi/images");
      window.location.assign(q ? `${targetPath}?q=${encodeURIComponent(q)}` : targetPath);
    };

    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, []);

  return <PhiSearchRouteGuard />;
}
