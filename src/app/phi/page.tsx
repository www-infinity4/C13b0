"use client";

import { useEffect } from "react";
import { appPath } from "@/lib/base-path";
import InfinityImageRouteGuard from "@/components/InfinityImageRouteGuard";

export default function InfinityPhiEntry() {
  useEffect(() => {
    const incoming = new URL(window.location.href);
    const tokenId = incoming.searchParams.get("id") || "";
    if (incoming.searchParams.get("codeHandoff") !== "1" || !tokenId) return;

    const target = new URL(appPath("studio/build"), window.location.origin);
    target.searchParams.set("id", tokenId);
    target.searchParams.set("mode", "preview");
    target.searchParams.set("codeHandoff", "1");
    window.location.replace(target.toString());
  }, []);

  return <InfinityImageRouteGuard />;
}
