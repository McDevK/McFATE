// McFATE Service Worker (优化版)
const CACHE_NAME = 'mcfate-v2.0.5.14';
const urlsToCache = [
  './', './styles.css', './script.js',
  './assets/icons/favicon/favicon.png',
  './assets/icons/button/FATE.png',
  './assets/icons/button/list.png',
  './assets/icons/button/light.png',
  './assets/icons/button/dark.png',
  './assets/icons/button/setting.png',
  './assets/icons/button/hide.png',
  './assets/icons/button/present.png',
  './assets/icons/button/filter.webp',
  './assets/icons/img/fatal.png',
  './assets/icons/img/fever.png',
  './assets/icons/img/power.png',
  // 天气图标 - 修正路径
  './assets/icons/weather/薄雾.png',
  './assets/icons/weather/暴雪.png',
  './assets/icons/weather/暴雨.png',
  './assets/icons/weather/碧空.png',
  './assets/icons/weather/打雷.png',
  './assets/icons/weather/雷雨.png',
  './assets/icons/weather/强风.png',
  './assets/icons/weather/晴朗.png',
  './assets/icons/weather/热浪.png',
  './assets/icons/weather/微风.png',
  './assets/icons/weather/小雪.png',
  './assets/icons/weather/小雨.png',
  './assets/icons/weather/扬沙.png',
  './assets/icons/weather/妖雾.png',
  './assets/icons/weather/阴云.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 网络优先策略
const networkFirst = async (request, fallbackHtml) => {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
    return await caches.match(request) || (fallbackHtml ? await caches.match(fallbackHtml) : undefined);
  } catch {
    return await caches.match(request) || (fallbackHtml ? await caches.match(fallbackHtml) : undefined);
  }
};

// 缓存优先策略
const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Network error', { status: 503 });
  }
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('McFATE Cache opened');
        const promises = urlsToCache.map(url => 
          cache.add(url).catch(() => console.warn(`Failed to cache: ${url}`))
        );
        await Promise.allSettled(promises);
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
  const { request } = event;
  const url = new URL(request.url);

  // FATE数据文件网络优先
  if (url.pathname.includes('fate_data.json') || url.pathname.includes('fate_common_data.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML导航请求网络优先
  const isHTMLRequest = request.mode === 'navigate' || 
    (request.headers.get('accept') || '').includes('text/html');
  if (isHTMLRequest) {
    event.respondWith(networkFirst(request, 'index.html'));
    return;
  }

  // JS/CSS网络优先
  const dest = request.destination;
  if (dest === 'script' || dest === 'style') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他静态资源缓存优先
  event.respondWith(cacheFirst(request));
});

// 消息处理
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
