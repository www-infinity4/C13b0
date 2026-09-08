"use client";

import { useEffect } from "react";
import { appPath } from "@/lib/base-path";

export default function PhiRedirect() {
  useEffect(() => {
    location.replace(`${appPath("")}${location.search}`);
  }, []);

  return <main className="phi-build-loading">Opening Infinity Phi…</main>;
}
