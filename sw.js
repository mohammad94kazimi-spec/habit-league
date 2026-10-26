const SHELL_CACHE = "habit-league-shell-v6";
const DATA_CACHE = "habit-league-data-v1";
const READ_TIMEOUT_MS = 8000; // اگه سرور تا این مدت جواب نده، از کش جواب می‌دیم
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
// فونت پیش‌کش می‌شه ولی اگه فایلش (به هر دلیل) روی هاست نبود، نصب سرویس‌ورکر خراب نشه
const OPTIONAL_FILES = ["./fonts/Vazirmatn-Variable.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await cache.addAll(SHELL_FILES);
      await Promise.all(OPTIONAL_FILES.map((u) => cache.add(u).catch(() => {})));
    })
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

// خواندن از Supabase: اول شبکه (با timeout)، اگه نشد نسخه‌ی کش‌شده با هدر x-sw-cache
// تا خودِ اپ بفهمه این داده تازه نیست و سرور در دسترس نیست.
async function readWithCacheFallback(request) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetch(request, { signal: ctrl.signal });
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(DATA_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await caches.match(request);
    if (!hit) return Response.error();
    const headers = new Headers(hit.headers);
    headers.set("x-sw-cache", "1");
    return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // پوسته‌ی خودِ اپ: اول از کش (سریع + آفلاین)، پشت‌صحنه از شبکه به‌روز کن
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // فایل‌های Storage (مثل فایل‌های صوتی) بزرگ و درخواست‌هاشون Range-دارن؛ کش‌شون نمی‌کنیم
  const isStorage = url.pathname.startsWith("/storage/");
  const isSupabase = url.hostname.endsWith(".supabase.co");
  if (isSupabase && !isStorage && event.request.method === "GET") {
    event.respondWith(readWithCacheFallback(event.request));
    return;
  }

  // بقیه (نوشتن‌ها، احراز هویت و غیره): مستقیم به شبکه، دست نمی‌زنیم
});
