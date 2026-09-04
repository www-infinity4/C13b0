"use client";

import { useEffect } from "react";

export default function AppRuntime() {
  useEffect(() => {
    document.documentElement.dataset.runtime =
      location.protocol === "capacitor:" || location.protocol === "file:" ? "native" : "web";

    if (!("serviceWorker" in navigator) || location.protocol === "capacitor:" || location.protocol === "file:") return;
    const base = location.pathname.startsWith("/C13b0/") ? "/C13b0/" : "/";
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  }, []);

  return null;
}
