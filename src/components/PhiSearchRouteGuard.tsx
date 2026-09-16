"use client";

import { useEffect } from "react";
import PhiUnifiedPage from "@/components/PhiUnifiedPage";

/**
 * Next.js patches window.history.pushState so App Router state follows URL changes.
 * Infinity Phi is a fully static GitHub Pages export, so a search-query-only URL
 * update must stay a same-document history update instead of becoming a route load.
 *
 * We only bypass the Next router for the Infinity Phi search state marker. Every
 * other pushState call keeps the framework behavior unchanged.
 */
export default function PhiSearchRouteGuard() {
  useEffect(() => {
    const frameworkPushState = window.history.pushState.bind(window.history);
    const nativePushState = Object.getOwnPropertyDescriptor(History.prototype, "pushState")?.value as
      | History["pushState"]
      | undefined;

    if (!nativePushState) return;

    (window.history as any).pushState = function guardedPushState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ) {
      const infinitySearch = Boolean(
        data &&
        typeof data === "object" &&
        "infinityPhiSearch" in data,
      );

      if (infinitySearch) {
        // Native History API updates the visible q/run URL without asking Next.js
        // or GitHub Pages to load another document.
        return nativePushState.call(window.history, data, unused, url);
      }

      return frameworkPushState(data, unused, url);
    };

    return () => {
      (window.history as any).pushState = frameworkPushState;
    };
  }, []);

  return <PhiUnifiedPage />;
}
