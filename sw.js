/* =========================================================
   sw.js — Service Worker（PWA：可離線開啟、載入更快）
   策略：
     - 官方即時 API（etabus.gov.hk）→ 不快取，直接走網路
     - HTML 導覽 → 網路優先，離線時回快取
     - 其他同源靜態檔（css/js/圖示）→ 快取優先，背景更新
   ========================================================= */
const CACHE = 'kmb-bus-pwa-v5';

const SHELL = [
  './',
  './index.html',
  './tutorial.html',
  './playground.html',
  './bus-app.html',
  './api-reference.html',
  './css/style.css',
  './js/common.js',
  './js/tutorial.js',
  './js/playground.js',
  './js/bus-app.js',
  './img/bus-hero.jpg',
  './img/bus-hero.webp',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 官方即時資料：不快取（永遠拿最新）
  if (url.hostname.endsWith('etabus.gov.hk')) return;

  // 只處理同來源資源
  if (url.origin !== self.location.origin) return;

  // HTML 導覽：網路優先，失敗時回快取
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 靜態資源：快取優先，同時背景更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
