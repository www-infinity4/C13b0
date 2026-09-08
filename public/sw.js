// Infinity Phi now uses the GitHub Pages network directly.
// This retirement worker exists only to remove older multi-page caches and
// release any stale worker that could keep /spark/, /phi/ or /studio/ in
// control of the repository root.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("infinity-shell-"))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});
