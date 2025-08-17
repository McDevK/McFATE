// McFATE Service Worker
const CACHE_NAME = 'mcfate-v1.0.4'; // bump 以清理旧缓存
// 仅缓存纯静态资源，避免缓存 index.html 与 script.js 导致页面回退
const urlsToCache = [
  './',
  './styles.css',
  // 不缓存 fate_data.json、index.html、script.js
  './assets/icons/favicon/favicon.png',
  // 删除未使用的 close.png 与 Countdown.png
  './assets/icons/button/switch.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 安装事件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('McFATE Cache opened');
        try {
          // 避免单个资源失败导致整个安装失败
          const tasks = urlsToCache.map(u => cache.add(u).catch(() => null));
          await Promise.allSettled(tasks);
        } catch (e) {
          // 忽略外链缓存错误
        }
      })
  );
  // 让新 SW 立即进入激活阶段
  self.skipWaiting();
});

// 激活事件
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
  // 立即接管所有客户端
  self.clients.claim();
});

// 拦截请求
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) fate_data.json 一律网络优先
  if (url.pathname.includes('fate_data.json')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) HTML 导航请求使用网络优先，确保拿到最新页面
  const isHTMLRequest = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTMLRequest) {
    event.respondWith(networkFirst(req, 'index.html'));
    return;
  }

  // 3) JS/CSS 也走网络优先，避免脚本/样式回退
  const dest = req.destination;
  if (dest === 'script' || dest === 'style') {
    event.respondWith(networkFirst(req));
    return;
  }

  // 4) 其他静态资源：缓存优先，降低请求开销
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
