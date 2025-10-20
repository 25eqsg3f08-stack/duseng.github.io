// 缓存版本号（更新文件时改这里，如v2→v3）
const CACHE = 'site-cache-v1';
// 已填入你提供的所有文件路径，可直接用
const TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/cover.jpg',
  '/sw.js',
  '/favicon.icon'
];

// 1. 安装：缓存所有指定文件（支持大尺寸的cover.jpg，无5MB限制）
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(TO_CACHE)) // 批量缓存你的所有文件
      .then(() => self.skipWaiting()) // 立即激活新SW，不用等刷新
  );
});

// 2. 激活：删除旧缓存，避免冗余文件占用空间
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => keys.filter(key => key !== CACHE)) // 筛选旧缓存
      .then(oldKeys => oldKeys.map(oldKey => caches.delete(oldKey))) // 删除旧缓存
      .then(() => self.clients.claim()) // 让所有打开的页面立即用新SW
  );
});

// 3. 请求：优先读缓存（极速响应），后台更缓存（确保文件最新）
self.addEventListener('fetch', e => {
  // 跳过跨域请求（如第三方API，避免报错）
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request)
      .then(cacheRes => {
        const networkRes = fetch(e.request)
          .then(netRes => {
            // 后台更新缓存（新文件覆盖旧文件）
            caches.open(CACHE).then(cache => cache.put(e.request, netRes.clone()));
            return netRes;
          });
        // 先返回缓存（秒开），没缓存再等网络
        return cacheRes || networkRes;
      })
  );
});