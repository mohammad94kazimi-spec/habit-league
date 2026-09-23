const SHELL_CACHE = "habit-league-shell-v2";
const DATA_CACHE = "habit-league-data-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css",
  "./app.js",
  "./config.js",
  "./vendor-supabase.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = [SHELL_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // پوسته‌ی خودِ اپ: اول از کش (سریع + آفلاین)، پشت‌صحنه از شبکه به‌روز کن
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // درخواست‌های خواندنیِ Supabase: اول شبکه (تازه‌ترین دیتا)، اگه آفلاین بودی از کش
  const isSupabase = url.hostname.endsWith(".supabase.co");
  if (isSupabase && event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // بقیه (نوشتن‌ها، احراز هویت و غیره): مستقیم به شبکه، دست نمی‌زنیم
});
