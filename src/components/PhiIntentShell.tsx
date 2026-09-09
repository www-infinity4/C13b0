"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { appPath } from "@/lib/base-path";
import { secureLoad, secureLoadDurable } from "@/lib/secure-storage";
import PhiPage2 from "@/components/PhiPage2";
import styles from "./PhiIntentShell.module.css";

type Intent = "search" | "code" | "create";
type Suggestion = { label: string; subject: string; focus: string; detail: string };
type ClickPath = { subject: string; focus: string; at: number };
type HistoryItem = { query: string; resolved: string; kind: string; at: number };
type MenuItem = { label: string; detail: string; kind: "recent" | "orange" | "idea" };

const CLICK_PATH = "infinity_phi_click_path_v1";
const HISTORY = "infinity_phi_context_v1";
const intentCopy: Record<Intent, { label: string; placeholder: string }> = {
  search: { label: "Search", placeholder: "Search anything" },
  code: { label: "Code", placeholder: "Describe the app, game, tool, or interactive system" },
  create: { label: "Create", placeholder: "Describe what you want created in plain language" },
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

function newestUniqueHistory(history: HistoryItem[]) {
  const seen = new Set<string>();
  return [...history]
    .sort((a, b) => b.at - a.at)
    .filter((item) => {
      const key = clean(item.query).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 14);
}

function buildSearchMenu(typed: string, history: HistoryItem[], clickPath: ClickPath[]): MenuItem[] {
  const recent: MenuItem[] = newestUniqueHistory(history).map((item) => ({
    label: clean(item.query),
    detail: item.resolved && clean(item.resolved).toLowerCase() !== clean(item.query).toLowerCase() ? clean(item.resolved) : "Recent Infinity search",
    kind: "recent",
  }));

  const orange: MenuItem[] = [];
  const seenOrange = new Set<string>();
  [...clickPath]
    .sort((a, b) => b.at - a.at)
    .slice(0, 12)
    .forEach((path) => {
      const direct = clean(`${path.subject} ${path.focus}`);
      if (direct && !seenOrange.has(direct.toLowerCase())) {
        seenOrange.add(direct.toLowerCase());
        orange.push({ label: direct, detail: `Next step from orange card · ${path.focus}`, kind: "orange" });
      }
      suggestionsFor(path.subject, path.focus).slice(0, 2).forEach((item) => {
        const key = item.label.toLowerCase();
        if (seenOrange.has(key)) return;
        seenOrange.add(key);
        orange.push({ label: item.label, detail: `Learned from ${path.focus}`, kind: "orange" });
      });
    });

  const mixed: MenuItem[] = [];
  const max = Math.max(recent.length, orange.length);
  for (let index = 0; index < max; index += 1) {
    if (recent[index]) mixed.push(recent[index]);
    if (orange[index]) mixed.push(orange[index]);
  }

  const q = clean(typed).toLowerCase();
  const filtered = q
    ? mixed.filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(q))
    : mixed;

  if (q) {
    const clicked = clickPath.find((item) => item.subject.toLowerCase() === q);
    suggestionsFor(typed, clicked?.focus || "").forEach((item) => {
      if (!filtered.some((existing) => existing.label.toLowerCase() === item.label.toLowerCase())) {
        filtered.push({ label: item.label, detail: clicked?.focus ? `Suggested from your ${clicked.focus} path` : "Possible next search", kind: "idea" });
      }
    });
  }

  const seen = new Set<string>();
  return filtered.filter((item) => {
    const key = item.label.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 14);
}

export default function PhiIntentShell() {
  const [intent, setIntent] = useState<Intent>("search");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [focused, setFocused] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const clickPathRef = useRef<ClickPath[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { clickPathRef.current = JSON.parse(localStorage.getItem(CLICK_PATH) || "[]").slice(0, 30); } catch {}
    const localHistory = secureLoad<HistoryItem[]>(HISTORY, []);
    setHistory(localHistory);
    const params = new URLSearchParams(location.search);
    const initial = params.get("q") || "";
    const context = Boolean(initial || params.get("id") || params.get("run"));
    setQuery(initial);
    setHasContext(context);
    setContextReady(true);
    setMenuItems(buildSearchMenu(initial, localHistory, clickPathRef.current));
    void secureLoadDurable<HistoryItem[]>(HISTORY, localHistory).then((durable) => {
      setHistory(durable);
      setMenuItems(buildSearchMenu(initial, durable, clickPathRef.current));
    });
  }, []);

  useEffect(() => {
    if (!contextReady) return;
    window.dispatchEvent(new CustomEvent("infinity-shell-menu-ready", { detail: { embedded: !hasContext } }));
    return () => {
      window.dispatchEvent(new CustomEvent("infinity-shell-menu-ready", { detail: { embedded: false } }));
    };
  }, [contextReady, hasContext]);

  useEffect(() => {
    const area = inputRef.current;
    if (!area) return;
    area.style.height = "0px";
    area.style.height = `${Math.min(Math.max(area.scrollHeight, 32), 210)}px`;
  }, [query, intent]);

  function choose(next: Intent) {
    setIntent(next);
    setFocused(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (intent === "search") setMenuItems(buildSearchMenu(value, history, clickPathRef.current));
  }

  function goSearch(value: string) {
    const next = clean(value);
    if (!next) return;
    window.location.assign(`${appPath("phi")}?q=${encodeURIComponent(next)}&run=1`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = clean(query);
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    if (intent === "search") return goSearch(value);
    const target = intent === "code" ? appPath("phi/code") : appPath("phi/create");
    window.location.assign(`${target}?q=${encodeURIComponent(value)}`);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function openMenu() {
    setFocused(true);
    if (intent === "search") setMenuItems(buildSearchMenu(query, history, clickPathRef.current));
  }

  function chooseMenuItem(item: MenuItem) {
    setQuery(item.label);
    setFocused(false);
    goSearch(item.label);
  }

  function openSiteMenu() {
    window.dispatchEvent(new Event("infinity-open-menu"));
  }

  function captureClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest(".phi-orange-main,.phi-orange-actions button");
    const card = trigger?.closest(".phi-orange-card");
    if (!card) return;
    const focus = clean(card.querySelector("h3")?.textContent);
    const subject = clean(query);
    if (!focus || !subject) return;
    const next = [{ subject, focus, at: Date.now() }, ...clickPathRef.current.filter((item) => !(item.subject === subject && item.focus === focus))].slice(0, 30);
    clickPathRef.current = next;
    try { localStorage.setItem(CLICK_PATH, JSON.stringify(next)); } catch {}
    setMenuItems(buildSearchMenu(query, history, next));
  }

  const showSearchMenu = intent === "search" && focused;

  return (
    <div className={`${styles.shell} ${styles[intent]}`} onClickCapture={captureClick}>
      {!hasContext && (
        <section className={`${styles.frontSearch} phi-front-center`} aria-label="Infinity Phi">
          <div className="phi-front-brand">Infinity Phi</div>

          <div className={styles.intentBar} aria-label="Infinity Phi intent">
            <div className={styles.buttons}>
              {(["search", "code", "create"] as Intent[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`${styles.intentButton} ${styles[item]} ${intent === item ? styles.active : ""}`}
                  aria-pressed={intent === item}
                  onClick={() => choose(item)}
                >
                  <span>{intentCopy[item].label}</span>
                  <span className={styles.intentPhi}>φ</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.composerWrap}>
            <form className={`${styles.searchBox} phi-front-search-card`} onSubmit={submit}>
              <span className={styles.searchPhi} aria-hidden="true">φ</span>
              <textarea
                ref={inputRef}
                value={query}
                rows={1}
                onChange={(event) => updateQuery(event.target.value)}
                onFocus={openMenu}
                onBlur={() => window.setTimeout(() => setFocused(false), 140)}
                onKeyDown={onComposerKeyDown}
                placeholder={intentCopy[intent].placeholder}
                aria-label={`${intentCopy[intent].label} with Infinity Phi`}
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="search"
              />
              <button type="submit" className={styles.omni} aria-label={`${intentCopy[intent].label} with Omni Phi`}><span aria-hidden="true">⊙</span></button>
              <button type="button" className="phi-front-menu-button" onClick={openSiteMenu} aria-label="Open Infinity Phi menu"><Menu size={23} /></button>
            </form>

            {showSearchMenu && (
              <div className={styles.searchMenu} role="listbox" aria-label="Recent and learned Infinity searches">
                {menuItems.length > 0 ? menuItems.map((item, index) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={`${item.kind}-${item.label}-${index}`}
                    className={styles.searchMenuItem}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      chooseMenuItem(item);
                    }}
                  >
                    <span className={`${styles.menuIcon} ${styles[item.kind]}`}>{item.kind === "recent" ? "↺" : item.kind === "orange" ? "φ" : "→"}</span>
                    <span className={styles.menuCopy}><b>{item.label}</b><small>{item.detail}</small></span>
                  </button>
                )) : (
                  <div className={styles.emptyMenu}>Recent searches and orange-card paths will appear here as you use Infinity Phi.</div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <PhiPage2 />
      <footer className={styles.chatFooter}>Built with ChatGPT</footer>
    </div>
  );
}
