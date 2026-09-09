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

export default function OpenSourceBuildCredits({ className, limit = 250, showChatGPT = true }: Props) {
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
      {showChatGPT && <span className="build-credit-chatgpt">Built with ChatGPT</span>}
      <details className="build-source-drawer">
        <summary>
          <span>Build sources</span>
          {visible.length > 0 && <small>{visible.length}</small>}
        </summary>
        <div className="build-source-drawer-body">
          {visible.length > 0 ? (
            <>
              <p>Files actually read or used by this Infinity installation.</p>
              <div className="build-source-file-list">
                {visible.map((item) => (
                  <a
                    key={item.id}
                    href={`https://github.com/${item.repo}/blob/${item.branch}/${item.file}`}
                    target="_blank"
                    rel="noreferrer"
                    title={item.upstream ? `Fork source; upstream ${item.upstream}` : item.repo}
                  >
                    <b>{item.repo.split("/").pop()}/{item.file}</b>
                    <small>{item.purpose}</small>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p>No external capability file has been used on this installation yet.</p>
          )}
          <a className="build-source-full-link" href={appPath("phi/sources")}>Open source record</a>
        </div>
      </details>
    </footer>
  );
}
