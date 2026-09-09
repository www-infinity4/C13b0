"use client";

import { useLayoutEffect } from "react";
import { INFINITY_CAPABILITIES } from "@/lib/infinity-capabilities";
import { recordOpenSourceUsage } from "@/lib/open-source-usage";

type TrackedWindow = Window & { __infinitySourceFetchWrapped?: boolean };

function currentIntent(): "search" | "code" | "create" {
  if (typeof location === "undefined") return "search";
  if (/\/phi\/code\/?/.test(location.pathname)) return "code";
  if (/\/phi\/create\/?/.test(location.pathname)) return "create";
  return "search";
}

function sourceFromRawUrl(raw: string) {
  try {
    const url = new URL(raw, location.href);
    if (url.hostname !== "raw.githubusercontent.com") return null;
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts.length < 4) return null;
    const repo = `${parts[0]}/${parts[1]}`;
    const branch = parts[2];
    const file = parts.slice(3).join("/");
    const capability = INFINITY_CAPABILITIES.find((cap) =>
      cap.repo.toLowerCase() === repo.toLowerCase() || cap.upstream?.toLowerCase() === repo.toLowerCase()
    );
    if (!capability || !file) return null;
    return { capability, repo, branch, file, url: url.href };
  } catch {
    return null;
  }
}

export default function OpenSourceUsageRuntime() {
  useLayoutEffect(() => {
    const trackedWindow = window as TrackedWindow;
    if (trackedWindow.__infinitySourceFetchWrapped) return;
    trackedWindow.__infinitySourceFetchWrapped = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const response = await originalFetch(input, init);
      const source = sourceFromRawUrl(requestUrl);
      if (response.ok && source) {
        recordOpenSourceUsage({
          name: source.capability.name,
          repo: source.repo,
          upstream: source.capability.upstream,
          branch: source.branch,
          file: source.file,
          url: source.url,
          intent: currentIntent(),
          purpose: source.capability.use,
        });
      }
      return response;
    };
  }, []);

  return null;
}
