/**
 * Return the absolute path prefix for the current deployment.
 *
 * GitHub Pages mounts this application at /C13b0. The landing page itself is
 * exactly `/C13b0` (no trailing slash), while child routes begin `/C13b0/`.
 * Both forms must resolve to the same base or links created on the opening
 * screen incorrectly jump to domain-root routes such as /spark/article and
 * /studio/build, which are 404s on GitHub Pages.
 */
export function appBase(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_BASE) {
    return process.env.NEXT_PUBLIC_APP_BASE.replace(/\/+$/, "") || "";
  }
  if (typeof document !== "undefined") {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/C13b0" || path.startsWith("/C13b0/")) return "/C13b0";
  }
  return "";
}

export function appPath(route: string): string {
  const base = appBase();
  const clean = route.replace(/^\/+/, "");
  return clean ? `${base}/${clean}` : base || "/";
}
