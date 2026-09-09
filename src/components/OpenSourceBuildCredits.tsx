"use client";

import { useEffect, useMemo, useState } from "react";
import { appPath } from "@/lib/base-path";
import {
  loadOpenSourceUsage,
  OPEN_SOURCE_USAGE_EVENT,
  type OpenSourceUsage,
  uniqueOpenSourceUsage,
} from "@/lib/open-source-usage";

type Props = { className?: string; limit?: number; showChatGPT?: boolean };

export default function OpenSourceBuildCredits({ className, limit = 3, showChatGPT = true }: Props) {
  const [usage, setUsage] = useState<OpenSourceUsage[]>([]);

  useEffect(() => {
    const refresh = () => setUsage(uniqueOpenSourceUsage(loadOpenSourceUsage()));
    refresh();
    window.addEventListener(OPEN_SOURCE_USAGE_EVENT, refresh as EventListener);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OPEN_SOURCE_USAGE_EVENT, refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const visible = useMemo(() => usage.slice(0, limit), [usage, limit]);

  return (
    <footer className={className}>
      {showChatGPT && <span>Built with ChatGPT</span>}
      {visible.length > 0 && (
        <>
          {showChatGPT && <span> · </span>}
          <span>Built using </span>
          {visible.map((item, index) => (
            <span key={item.id}>
              {index > 0 ? " · " : ""}
              <a
                href={`https://github.com/${item.repo}/blob/${item.branch}/${item.file}`}
                target="_blank"
                rel="noreferrer"
                title={item.upstream ? `Fork source; upstream ${item.upstream}` : item.repo}
              >
                {item.repo.split("/").pop()}/{item.file}
              </a>
            </span>
          ))}
        </>
      )}
      {(showChatGPT || visible.length > 0) && <span> · </span>}
      <a href={appPath("phi/sources")}>Sources</a>
    </footer>
  );
}
