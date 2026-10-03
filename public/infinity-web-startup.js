// Retire only Infinity Phi's former offline app shell before React startup.
// Keep wallet, history, IndexedDB and other Phi sites intact.
(() => {
  "use strict";
  const script = document.currentScript;
  const root = new URL(".", script.src);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(registrations.filter((registration) => {
        const scope = new URL(registration.scope);
        return scope.origin === root.origin && scope.pathname === root.pathname;
      }).map((registration) => registration.unregister()))
    ).catch(() => undefined);
  }
  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("infinity-shell-")).map((key) => caches.delete(key))
    )).catch(() => undefined);
  }
})();
