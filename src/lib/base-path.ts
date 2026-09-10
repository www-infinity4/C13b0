/**
 * Return the absolute path prefix for the current deployment.
 *
 * GitHub Pages mounts this application at /C13b0. During static export there
 * is no browser pathname yet, so the build must also know the Pages base.
 */
export function appBase(): string {
  if (typeof process !== "undefined") {
    if (process.env?.NEXT_PUBLIC_APP_BASE) {
      return process.env.NEXT_PUBLIC_APP_BASE.replace(/\/+$/, "") || "";
    }
    if (process.env?.GITHUB_PAGES === "true" || process.env?.GITHUB_PAGES === "1") {
      return "/C13b0";
    }
  }
  if (typeof document !== "undefined") {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/C13b0" || path.startsWith("/C13b0/")) return "/C13b0";
  }
  return "";
}

export function appPath(route: string): string {
  const base = appBase();
  const clean = route.replace(/^\/+|\/+$/g, "");
  return clean ? `${base}/${clean}/` : `${base}/` || "/";
}
