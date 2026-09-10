"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Menu, Search } from "lucide-react";
import { appPath } from "@/lib/base-path";
import styles from "./InfinityPhiFront.module.css";

export default function InfinityPhiFront() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const setEmbeddedMenu = (embedded: boolean) => {
      window.dispatchEvent(
        new CustomEvent("infinity-shell-menu-ready", { detail: { embedded } }),
      );
    };

    setEmbeddedMenu(true);
    const timer = window.setTimeout(() => setEmbeddedMenu(true), 0);
    return () => {
      window.clearTimeout(timer);
      setEmbeddedMenu(false);
    };
  }, []);

  function resizeInput(target: HTMLTextAreaElement) {
    target.style.height = "0px";
    target.style.height = `${Math.min(target.scrollHeight, 142)}px`;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    const params = new URLSearchParams({ q, run: "1" });
    window.location.assign(`${appPath("phi")}?${params.toString()}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function openMenu() {
    window.dispatchEvent(new Event("infinity-open-menu"));
  }

  return (
    <main className={`${styles.page} infinity-phi-front`}>
      <section className={styles.stage} aria-label="Infinity Phi Search">
        <img
          className={styles.art}
          src="/C13b0/infinity-phi-share.png"
          alt=""
          aria-hidden="true"
        />
        <div className={styles.scrim} aria-hidden="true" />
        <h1 className={styles.srOnly}>Infinity Phi Search — C13b0</h1>

        <div className={styles.controls}>
          <nav className={styles.modeSwitch} aria-label="Infinity Phi modes">
            <a
              href={appPath("")}
              className={`${styles.modeButton} ${styles.searchMode}`}
              aria-current="page"
            >
              Search <span>φ</span>
            </a>
            <a
              href={appPath("phi/code")}
              className={`${styles.modeButton} ${styles.codeMode}`}
            >
              Code <span>φ</span>
            </a>
            <a
              href={appPath("phi/create")}
              className={`${styles.modeButton} ${styles.createMode}`}
            >
              Create <span>φ</span>
            </a>
          </nav>

          <form className={styles.searchBar} onSubmit={submit}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={openMenu}
              aria-label="Open Infinity Phi menu"
            >
              <Menu size={28} strokeWidth={2.2} />
            </button>

            <Search className={styles.searchIcon} size={25} strokeWidth={2} aria-hidden="true" />

            <textarea
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resizeInput(event.target);
              }}
              onKeyDown={onKeyDown}
              rows={1}
              spellCheck
              autoCapitalize="sentences"
              enterKeyHint="search"
              aria-label="Search Infinity"
              placeholder="Search Infinity"
            />

            <button type="submit" className={styles.phiButton} aria-label="Search Infinity">
              φ
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
