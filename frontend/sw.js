// Service worker : met l'app shell en cache pour l'installation en PWA et le
// chargement hors ligne. Les appels /api/** ne sont JAMAIS mis en cache (données
// de jeu en temps réel) ; ils partent sur le réseau sans interception.
// À chaque livraison du frontend : bumper CACHE (aligné sur le ?v= de index.html).
const CACHE = "lemotjuste-v29";
const SHELL = [
  "./",
  "./index.html",
  "./theme.js?v=29",
  "./styles.css?v=29",
  "./app.js?v=29",
  "./favicon.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// Filet : si la page demande explicitement d'activer la version en attente (bouton
// « Mettre à jour »), on saute l'attente. skipWaiting() est déjà appelé à l'install,
// ce handler couvre les cas où un worker resterait en attente.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== location.origin) return; // gateway sur un autre port, Google Fonts...
  if (url.pathname.startsWith("/api/")) return; // jamais de cache sur l'API

  // Cache d'abord (app shell versionné par ?v=), réseau en repli avec mise en cache.
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
    )
  );
});
