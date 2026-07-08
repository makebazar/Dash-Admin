const CACHE_NAME = 'promo-cache-v2';
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png',
];

// Install Event - Pre-cache essential static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network First for API/pages, Cache First for static assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip API requests from caching
  if (url.pathname.startsWith('/api/')) return;

  // For navigation requests (HTML pages) - network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return new Response(
              `<!DOCTYPE html>
              <html lang="ru">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Ошибка сети - DashAdmin</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
                  .container { max-width: 400px; background: white; padding: 32px; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); }
                  h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; }
                  p { font-size: 14px; color: #64748b; margin: 0 0 24px 0; line-height: 1.5; }
                  button { background-color: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background-color 0.2s; }
                  button:hover { background-color: #1e293b; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Ошибка подключения</h1>
                  <p>Не удалось подключиться к серверу. Пожалуйста, проверьте подключение к интернету или попробуйте позже.</p>
                  <button onclick="window.location.reload()">Повторить попытку</button>
                </div>
              </body>
              </html>`,
              {
                status: 503,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }
            );
          });
        })
    );
    return;
  }

  // For static assets (icons, fonts, images) - cache first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For JS/CSS chunks - stale-while-revalidate
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Default: network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return new Response("Network error", { status: 503, statusText: "Service Unavailable" });
        });
      })
  );
});
