"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { INFINITY_CAPABILITIES } from "@/lib/infinity-capabilities";
import {
  loadOpenSourceUsage,
  OPEN_SOURCE_USAGE_EVENT,
  type OpenSourceUsage,
  uniqueOpenSourceUsage,
} from "@/lib/open-source-usage";

export default function PhiSourceCredits() {
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

  const grouped = useMemo(() => {
    const map = new Map<string, OpenSourceUsage[]>();
    usage.forEach((item) => {
      const list = map.get(item.repo) || [];
      list.push(item);
      map.set(item.repo, list);
    });
    return [...map.entries()];
  }, [usage]);

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fa", color: "#172431", padding: "22px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href={appPath("phi")} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#172431", fontWeight: 850, textDecoration: "none" }}>
          <ArrowLeft size={17} /> Infinity Phi
        </a>

        <section style={{ marginTop: 28, background: "white", borderRadius: 28, padding: "clamp(22px,5vw,48px)", boxShadow: "0 16px 45px rgba(20,40,60,.08)" }}>
          <small style={{ fontWeight: 900, letterSpacing: ".14em", color: "#198c4f" }}>OPEN-SOURCE BUILD RECORD</small>
          <h1 style={{ fontSize: "clamp(36px,8vw,72px)", lineHeight: .95, letterSpacing: "-.045em", margin: "12px 0 18px" }}>Credit exactly what Infinity used.</h1>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: "#5b6977", maxWidth: 760 }}>
            Infinity Phi has {INFINITY_CAPABILITIES.length} open-source capabilities indexed for Search, Code and Create. This page deliberately does not list all of them as if they powered every result. It lists only exact repository files that this Infinity installation actually read or used while building.
          </p>
        </section>

        <section style={{ marginTop: 18, display: "grid", gap: 14 }}>
          {grouped.length === 0 ? (
            <div style={{ background: "white", borderRadius: 22, padding: 24, color: "#667482" }}>
              No external fork file has been recorded as used in this browser yet. Indexed capabilities do not become public credits until an exact file is actually read.
            </div>
          ) : grouped.map(([repo, items]) => (
            <article key={repo} style={{ background: "white", borderRadius: 22, padding: 24, boxShadow: "0 10px 30px rgba(20,40,60,.05)" }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>{repo}</h2>
              {items[0]?.upstream && items[0].upstream !== repo && (
                <p style={{ margin: "0 0 14px", color: "#77838e", fontSize: 13 }}>Fork of {items[0].upstream}</p>
              )}
              <div style={{ display: "grid", gap: 9 }}>
                {items.map((item) => (
                  <a
                    key={item.id}
                    href={`https://github.com/${item.repo}/blob/${item.branch}/${item.file}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "12px 14px", border: "1px solid #e4e9ee", borderRadius: 14, color: "#1e3448", textDecoration: "none" }}
                  >
                    <span><b>{item.file}</b><br/><small style={{ color: "#768391" }}>{item.intent} · {item.purpose}</small></span>
                    <ExternalLink size={16}/>
                  </a>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
