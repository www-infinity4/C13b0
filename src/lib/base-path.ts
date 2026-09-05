/**
 * Return the absolute path prefix for the current deployment.
 *
 * On GitHub Pages the exported site is mounted under /C13b0, so a hardcoded
 * absolute path like "/spark" becomes a 404. During the build
 * NEXT_PUBLIC_APP_BASE is set to "/C13b0"; in dev it is empty. This helper
 * centralises the base-path handling so navigation links stay valid in both
 * environments.
 */
export function appBase(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_BASE) {
    return process.env.NEXT_PUBLIC_APP_BASE.replace(/\/+$/, "") || "";
  }
  if (typeof document !== "undefined") {
    const path = location.pathname;
    if (path.startsWith("/C13b0/")) return "/C13b0";
  }
  return "";
}

export function appPath(route: string): string {
  const base = appBase();
  const clean = route.replace(/^\/+/, "");
  return clean ? `${base}/${clean}` : base || "/";
}
