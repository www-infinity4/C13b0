const CACHE="infinity-shell-v5";
// Derive the base path from this service worker's own URL so the same script
// works when served at "/C13b0/" (GitHub Pages) and at "/" (Capacitor Android).
const BASE=new URL("./",self.location.href).pathname;
const SHELL=[BASE+"spark/",BASE+"studio/",BASE+"studio/build/",BASE+"manifest.webmanifest",BASE+"infinity-icon-192.png",BASE+"infinity-icon-512.png",BASE+"infinity-preview-v2.jpg",BASE+"infinity-main.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(response=>response||caches.match(BASE+"spark/"))))});
