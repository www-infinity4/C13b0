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
      // A page already delivered by the retired cache will not repair itself
      // until it navigates again. Move every open C13b0 tab to one cache-busted
      // network request; the marker prevents a reload loop.
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.all(
        clients.map((client) => {
          const url = new URL(client.url);
          if (url.searchParams.get("cache-repair") === "2") return undefined;
          url.searchParams.set("cache-repair", "2");
          return client.navigate(url.href);
        }),
      );
    })(),
  );
});
