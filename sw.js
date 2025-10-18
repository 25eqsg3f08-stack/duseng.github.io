// 定义缓存版本和需要缓存的资源
const CACHE_NAME = 'dubaizhidusheng-v1';
const CACHE_RESOURCES = [
    '/',
    '/index.html',
    '/manifest.json',
    '/styles.css',
    '/cover.jpg', // 书籍封面图（需确保路径正确）
    // 若有其他需要缓存的资源（如 EPUB 文件、额外图片等），也可添加在此
];

// 安装 Service Worker 时缓存资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_RESOURCES))
            .then(() => self.skipWaiting())
    );
});

// 激活时清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// 拦截网络请求，优先从缓存获取资源，无缓存则请求网络
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});