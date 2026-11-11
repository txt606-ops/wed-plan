// Giữ một bản game trong máy để mở được khi không có mạng.
// Có mạng: luôn lấy bản mới nhất trên web rồi cất lại. Mất mạng (hoặc mạng treo quá 3 giây): dùng bản đã cất.
const CACHE = "wedplan-v1";
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;700&family=VT323&display=swap";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(["./", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"]);
    try { // phông chữ: cất cả file CSS lẫn các file phông nó trỏ tới; hỏng thì game vẫn chạy bằng phông của máy
      const r = await fetch(FONT_CSS);
      if (r.ok) {
        await c.put(FONT_CSS, r.clone());
        const urls = [...(await r.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
        await Promise.all(urls.map(u => c.add(u).catch(() => {})));
      }
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE), hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const cached = () => c.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? c.match("./") : undefined));
    try {
      const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 3000))]);
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (_) {
      return (await cached()) || Response.error();
    }
  })());
});
