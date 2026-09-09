export type OpenSourceUsage = {
  id: string;
  name: string;
  repo: string;
  upstream?: string;
  branch: string;
  file: string;
  url: string;
  intent: "search" | "code" | "create";
  purpose: string;
  at: number;
};

export const OPEN_SOURCE_USAGE_KEY = "infinity_phi_open_source_usage_v1";
export const OPEN_SOURCE_USAGE_EVENT = "infinity:open-source-usage";

function safeRead(): OpenSourceUsage[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OPEN_SOURCE_USAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadOpenSourceUsage() {
  return safeRead();
}

/**
 * Record only a file that Infinity actually read/used. Merely ranking or
 * indexing a repository is not enough to create a public credit.
 */
export function recordOpenSourceUsage(item: Omit<OpenSourceUsage, "id" | "at">) {
  if (typeof window === "undefined") return;
  const key = `${item.repo}@${item.branch}/${item.file}`;
  const previous = safeRead();
  const next: OpenSourceUsage[] = [
    {
      ...item,
      id: key,
      at: Date.now(),
    },
    ...previous.filter((entry) => entry.id !== key),
  ].slice(0, 250);
  try {
    localStorage.setItem(OPEN_SOURCE_USAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(OPEN_SOURCE_USAGE_EVENT, { detail: next }));
  } catch {}
}

export function uniqueOpenSourceUsage(items: OpenSourceUsage[]) {
  const seen = new Set<string>();
  return [...items]
    .sort((a, b) => b.at - a.at)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}
