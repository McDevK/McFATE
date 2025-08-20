// McFATE Service Worker
const CACHE_NAME = 'mcfate-v2.0.5.5';
const urlsToCache = [
  './', './styles.css', './assets/icons/favicon/favicon.png',
  './assets/icons/button/switch.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('McFATE Cache opened');
        try {
          const tasks = urlsToCache.map(u => cache.add(u).catch(() => null));
          await Promise.allSettled(tasks);
        } catch (e) {
          // 忽略外链缓存错误
        }
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('McFATE Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // FATE数据文件网络优先
  if (url.pathname.includes('fate_data.json') || url.pathname.includes('fate_common_data.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // HTML导航请求网络优先
  const isHTMLRequest = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTMLRequest) {
    event.respondWith(networkFirst(req, 'index.html'));
    return;
  }

  // JS/CSS网络优先
  const dest = req.destination;
  if (dest === 'script' || dest === 'style') {
    event.respondWith(networkFirst(req));
    return;
  }

  // 其他静态资源缓存优先
  event.respondWith(cacheFirst(req));
});

function cacheFirst(request) {
  return caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return resp;
    });
  });
}

function networkFirst(request, fallbackHtml) {
  return fetch(request)
    .then(resp => {
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return resp;
      }
      return caches.match(request) || (fallbackHtml ? caches.match(fallbackHtml) : undefined);
    })
    .catch(() => caches.match(request) || (fallbackHtml ? caches.match(fallbackHtml) : undefined));
}
