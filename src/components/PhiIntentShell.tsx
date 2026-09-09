"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { appPath } from "@/lib/base-path";
import PhiPage2 from "@/components/PhiPage2";
import styles from "./PhiIntentShell.module.css";

type Intent = "search" | "code" | "create";

const intentCopy: Record<Intent, { label: string; hint: string; placeholder: string }> = {
  search: {
    label: "Search",
    hint: "Research it, learn the important directions, and build a readable magazine.",
    placeholder: "Search anything",
  },
  code: {
    label: "Code",
    hint: "Describe software. Infinity builds the interaction and keeps the source out of the way.",
    placeholder: "Describe the app, game, tool, or interactive system",
  },
  create: {
    label: "Create",
    hint: "Describe the finished thing you need: invoice, document, app, form, letter, tool, or site.",
    placeholder: "Describe what you want created in plain language",
  },
};

export default function PhiIntentShell() {
  const [intent, setIntent] = useState<Intent>("search");
  const rootRef = useRef<HTMLDivElement>(null);
  const intentBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]');
    if (!input) return;
    input.placeholder = intentCopy[intent].placeholder;
    input.setAttribute("data-infinity-intent", intent);
  }, [intent]);

  useEffect(() => {
    const root = rootRef.current;
    const bar = intentBarRef.current;
    if (!root || !bar) return;
    const form = root.querySelector<HTMLFormElement>("form.phi-search-box");
    if (!form) return;
    form.insertAdjacentElement("afterend", bar);
  }, []);

  function choose(next: Intent) {
    setIntent(next);
    window.setTimeout(() => rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]')?.focus(), 0);
  }

  function captureSubmit(event: FormEvent<HTMLDivElement>) {
    if (intent === "search") return;
    const form = event.target as HTMLFormElement;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("phi-search-box")) return;
    const input = form.querySelector<HTMLInputElement>('input[aria-label="Research topic"]');
    const query = String(input?.value || "").trim();
    if (!query) return;
    event.preventDefault();
    event.stopPropagation();
    const target = intent === "code" ? appPath("phi/code") : appPath("phi/create");
    window.location.assign(`${target}?q=${encodeURIComponent(query)}`);
  }

  return (
    <div ref={rootRef} className={`${styles.shell} ${styles[intent]}`} onSubmitCapture={captureSubmit}>
      <div ref={intentBarRef} className={styles.intentBar} aria-label="Infinity intent">
        <div className={styles.buttons}>
          {(["search", "code", "create"] as Intent[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`${styles.intentButton} ${styles[item]} ${intent === item ? styles.active : ""}`}
              aria-pressed={intent === item}
              onClick={() => choose(item)}
            >
              {intentCopy[item].label}
            </button>
          ))}
        </div>
        <p><b>{intentCopy[intent].label} intent.</b> {intentCopy[intent].hint}</p>
      </div>
      <PhiPage2 />
    </div>
  );
}
