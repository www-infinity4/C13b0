"use client";

import { useLayoutEffect } from "react";
import PhiUnifiedPage from "@/components/PhiUnifiedPage";

/**
 * Infinity Phi is exported as a static GitHub Pages app. Next.js patches the
 * History API so URL changes can become router navigations, but a Phi search is
 * only changing q/run on the document that is already open. Keep those updates
 * native so a search never waits on, or accidentally asks, the static router.
 */
export default function PhiSearchRouteGuard() {
  useLayoutEffect(() => {
    const history = window.history as History & { pushState: History["pushState"]; replaceState: History["replaceState"] };
    const prototype = Object.getPrototypeOf(history) as History | null;
    const nativePushState = prototype?.pushState;
    const nativeReplaceState = prototype?.replaceState;
    const frameworkPushState = history.pushState.bind(history);
    const frameworkReplaceState = history.replaceState.bind(history);

    if (typeof nativePushState !== "function") return;

    const isInfinitySearch = (data: unknown, url?: string | URL | null) => {
      if (data && typeof data === "object" && "infinityPhiSearch" in data) return true;
      if (!url) return false;
      try {
        const target = new URL(String(url), window.location.href);
        const current = window.location.pathname.replace(/\/$/, "");
        const next = target.pathname.replace(/\/$/, "");
        return current === next && target.searchParams.has("q") && target.searchParams.get("run") === "1";
      } catch {
        return false;
      }
    };

    history.pushState = function guardedPushState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url)) {
        return nativePushState.call(history, data, unused, url);
      }
      return frameworkPushState(data, unused, url);
    };

    if (typeof nativeReplaceState === "function") {
      history.replaceState = function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
        if (isInfinitySearch(data, url)) {
          return nativeReplaceState.call(history, data, unused, url);
        }
        return frameworkReplaceState(data, unused, url);
      };
    }

    return () => {
      history.pushState = frameworkPushState;
      history.replaceState = frameworkReplaceState;
    };
  }, []);

  return <PhiUnifiedPage />;
}
