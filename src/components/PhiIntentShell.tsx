"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { appPath } from "@/lib/base-path";
import PhiPage2 from "@/components/PhiPage2";
import styles from "./PhiIntentShell.module.css";

type Intent = "search" | "code" | "create";
type Suggestion = { label: string; subject: string; focus: string; detail: string };
type ClickPath = { subject: string; focus: string; at: number };

const CLICK_PATH = "infinity_phi_click_path_v1";
const intentCopy: Record<Intent, { label: string; hint: string; placeholder: string }> = {
  search: { label: "Search", hint: "Research, learn, and build a readable publication.", placeholder: "Search anything" },
  code: { label: "Code", hint: "Describe software and iterate on the working preview.", placeholder: "Describe the app, game, tool, or interactive system" },
  create: { label: "Create", hint: "Describe the finished invoice, document, spreadsheet, app, form, or tool.", placeholder: "Describe what you want created in plain language" },
};

const clean = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

function suggestion(label: string, subject: string, focus: string, detail: string): Suggestion {
  return { label: clean(label), subject: clean(subject), focus: clean(focus), detail: clean(detail) };
}

function suggestionsFor(subject: string, focus = ""): Suggestion[] {
  const base = clean(subject);
  const f = clean(focus);
  const text = `${base} ${f}`.toLowerCase();
  if (!base) return [];
  if (/\b(coin|quarter|dime|nickel|cent|penny|dollar|numismatic|mint)\b/.test(text)) {
    if (/proof/.test(text)) return [
      suggestion(`${base} proof identification`, base, "proof", "identification"),
      suggestion(`${base} proof vs business strike`, base, "proof", "vs business strike"),
      suggestion(`${base} proof mintage by mint`, base, "proof", "mintage"),
      suggestion(`${base} proof grades PCGS`, base, "proof", "PCGS grades"),
      suggestion(`${base} cameo deep cameo proofs`, base, "proof", "cameo / deep cameo"),
      suggestion(`${base} proof values by grade`, base, "proof", "values by grade"),
      suggestion(`${base} impaired proof identification`, base, "proof", "impaired proofs"),
    ];
    return [
      suggestion(`${base} mintage and mint production`, base, "mintage", "mint production"),
      suggestion(`${base} business strike identification`, base, "business strike", "identification"),
      suggestion(`${base} proof issues`, base, "proof", "collector strikes"),
      suggestion(`${base} PCGS grading and values`, base, "grading", "PCGS values"),
      suggestion(`${base} varieties and mint errors`, base, "varieties", "mint errors"),
      suggestion(`${base} population condition rarity`, base, "population", "condition rarity"),
      suggestion(`${base} auction records`, base, "market", "auction records"),
    ];
  }
  if (/\b(invoice|billing|bill|payment)\b/.test(text)) return [
    suggestion(`${base} customer invoice`, base, "invoice", "customer details"),
    suggestion(`${base} itemized invoice`, base, "invoice", "itemized charges"),
    suggestion(`${base} invoice with tax and due date`, base, "invoice", "tax + due date"),
  ];
  if (/\b(code|game|app|application|software|8 bit|pixel)\b/.test(text)) return [
    suggestion(`${base} 8 bit pixel art`, base, "visual engine", "8-bit pixel art"),
    suggestion(`${base} touch controls Android`, base, "interaction", "touch controls"),
    suggestion(`${base} levels enemies scoring`, base, "gameplay", "levels + enemies"),
    suggestion(`${base} sound music animation`, base, "media", "sound + animation"),
    suggestion(`${base} save state and progress`, base, "state", "persistence"),
  ];
  const topic = f || "deeper explanation";
  return [
    suggestion(`${base} ${topic}`, base, topic, "focused search"),
    suggestion(`${base} ${topic} examples`, base, topic, "examples"),
    suggestion(`${base} ${topic} comparison`, base, topic, "comparison"),
    suggestion(`${base} ${topic} measurements data`, base, topic, "measurements"),
    suggestion(`${base} ${topic} active research`, base, topic, "active research"),
    suggestion(`${base} ${topic} practical applications`, base, topic, "applications"),
  ];
}

export default function PhiIntentShell() {
  const [intent, setIntent] = useState<Intent>("search");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const intentBarRef = useRef<HTMLDivElement>(null);
  const clickPathRef = useRef<ClickPath[]>([]);

  useEffect(() => {
    try { clickPathRef.current = JSON.parse(localStorage.getItem(CLICK_PATH) || "[]").slice(0, 20); } catch {}
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]');
    if (input?.value) {
      const latest = clickPathRef.current.find((item) => item.subject.toLowerCase() === input.value.toLowerCase());
      setSuggestions(suggestionsFor(input.value, latest?.focus || ""));
    }
  }, []);

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
    const place = () => {
      const form = root.querySelector<HTMLFormElement>("form.phi-search-box");
      if (form && bar.previousElementSibling !== form) form.insertAdjacentElement("afterend", bar);
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const input = root?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]');
    if (!input) return;
    const update = () => {
      const subject = clean(input.value);
      const latest = clickPathRef.current.find((item) => item.subject.toLowerCase() === subject.toLowerCase());
      setSuggestions(subject ? suggestionsFor(subject, latest?.focus || "") : []);
    };
    input.addEventListener("input", update);
    input.addEventListener("focus", update);
    return () => { input.removeEventListener("input", update); input.removeEventListener("focus", update); };
  }, []);

  function choose(next: Intent) {
    setIntent(next);
    window.setTimeout(() => rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]')?.focus(), 0);
  }

  function setSearchValue(value: string) {
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  function captureClick(event: any) {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest(".phi-orange-main,.phi-orange-actions button");
    const card = trigger?.closest(".phi-orange-card");
    if (!card) return;
    const focus = clean(card.querySelector("h3")?.textContent);
    const subject = clean(rootRef.current?.querySelector<HTMLInputElement>('input[aria-label="Research topic"]')?.value);
    if (!focus || !subject) return;
    const next = [{ subject, focus, at: Date.now() }, ...clickPathRef.current.filter((item) => !(item.subject === subject && item.focus === focus))].slice(0, 20);
    clickPathRef.current = next;
    try { localStorage.setItem(CLICK_PATH, JSON.stringify(next)); } catch {}
    setSuggestions(suggestionsFor(subject, focus));
  }

  function captureSubmit(event: FormEvent<HTMLDivElement>) {
    if (intent === "search") return;
    const form = event.target as HTMLFormElement;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("phi-search-box")) return;
    const input = form.querySelector<HTMLInputElement>('input[aria-label="Research topic"]');
    const query = clean(input?.value);
    if (!query) return;
    event.preventDefault();
    event.stopPropagation();
    const target = intent === "code" ? appPath("phi/code") : appPath("phi/create");
    window.location.assign(`${target}?q=${encodeURIComponent(query)}`);
  }

  return (
    <div ref={rootRef} className={`${styles.shell} ${styles[intent]}`} onSubmitCapture={captureSubmit} onClickCapture={captureClick}>
      <div ref={intentBarRef} className={styles.intentBar} aria-label="Infinity intent">
        <div className={styles.buttons}>
          {(["search", "code", "create"] as Intent[]).map((item) => <button key={item} type="button" className={`${styles.intentButton} ${styles[item]} ${intent === item ? styles.active : ""}`} aria-pressed={intent === item} onClick={() => choose(item)}>{intentCopy[item].label}</button>)}
        </div>
        {suggestions.length > 0 && intent === "search" && <div className={styles.suggestions} aria-label="Search ideas learned from your path">
          <small>Suggested from what you searched and clicked</small>
          <div className={styles.suggestionRail}>{suggestions.map((item, index) => <button type="button" key={`${item.label}-${index}`} onClick={() => setSearchValue(item.label)} title={item.label}><span className={styles.subject}>{item.subject}</span><span className={styles.focus}>{item.focus}</span><span className={styles.detail}>{item.detail}</span></button>)}</div>
        </div>}
        <p><b>{intentCopy[intent].label} intent.</b> {intentCopy[intent].hint}</p>
      </div>
      <PhiPage2 />
      <footer className={styles.chatFooter}>Built with ChatGPT</footer>
    </div>
  );
}
