"use client";

import { useLayoutEffect } from "react";
import PhiUnifiedPage from "@/components/PhiUnifiedPage";

/**
 * Infinity Phi is exported as a static GitHub Pages app. Next.js patches the
 * History API so a same-page query update can accidentally become a client
 * router navigation and stall or 404 on the static export. For an actual Phi
 * search, reload the already-exported /phi/ document with q/run in the query
 * string. PhiPage2 already reads those params on mount and starts the search.
 */
export default function PhiSearchRouteGuard() {
  useLayoutEffect(() => {
    const history = window.history as History & { pushState: History["pushState"]; replaceState: History["replaceState"] };
    const frameworkPushState = history.pushState.bind(history);
    const frameworkReplaceState = history.replaceState.bind(history);

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
      if (isInfinitySearch(data, url) && url) {
        const target = new URL(String(url), window.location.href);
        window.location.assign(target.toString());
        return;
      }
      return frameworkPushState(data, unused, url);
    };

    history.replaceState = function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      if (isInfinitySearch(data, url) && url) {
        const target = new URL(String(url), window.location.href);
        window.location.replace(target.toString());
        return;
      }
      return frameworkReplaceState(data, unused, url);
    };

    return () => {
      history.pushState = frameworkPushState;
      history.replaceState = frameworkReplaceState;
    };
  }, []);

  return <PhiUnifiedPage />;
}