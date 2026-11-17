// Service worker Negeri Wkwk: simpan aset game di HP supaya bisa dibuka tanpa internet
// (mode main bareng tanpa internet butuh ini). Halaman: coba jaringan dulu, cadangannya simpanan.
// Aset ber-hash dari Vite: ambil dari simpanan dulu, karena isinya tidak pernah berubah.
const CACHE = "wkwk-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/favicon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // relay, font eksternal, dll: biarkan
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const salin = res.clone();
          caches.open(CACHE).then((c) => c.put("/", salin));
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (ada) =>
        ada ||
        fetch(req).then((res) => {
          if (res.ok) {
            const salin = res.clone();
            caches.open(CACHE).then((c) => c.put(req, salin));
          }
          return res;
        }),
    ),
  );
});
