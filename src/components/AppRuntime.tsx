"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export default function AppRuntime() {
  useEffect(() => {
    // Capacitor serves the WebView over http(s)://localhost, so detect the native
    // bridge rather than the protocol. This keeps native from being misread as "web".
    const isNative =
      typeof window.Capacitor?.isNativePlatform === "function"
        ? window.Capacitor.isNativePlatform()
        : Boolean(window.Capacitor);

    document.documentElement.dataset.runtime = isNative ? "native" : "web";

    // Never register a service worker inside the native WebView.
    if (isNative || !("serviceWorker" in navigator)) return;
    const base = location.pathname.startsWith("/C13b0/") ? "/C13b0/" : "/";
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  }, []);

  return null;
}
