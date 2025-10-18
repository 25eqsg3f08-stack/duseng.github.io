const CACHE_NAME = 'dubaizhidusheng-v3';
// 拆分：GitHub Pages 兼容的资源（避免超大文件触发限制）
const CACHE_CORE = [ // 小资源优先，确保100%缓存成功
    '/',
    '/index.html',
    '/manifest.json',
    '/styles.css',
    '/cover.jpg' // 建议压缩至2MB内，适配GitHub Pages
];
const CACHE_LARGE_COMPAT = [ // 大容量资源（单个不超过25MB，GitHub Pages单文件上限）
    '/index.html', // 若EPUB超25MB，拆分为多个小文件
    '/cover.jpg'
];

// 1. 安装：小资源同步缓存，大资源“重试+分段”缓存（适配GitHub Pages超时）
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_CORE)) // 小资源快速完成
            .then(() => {
                console.log('核心资源缓存完成');
                // 大资源缓存：增加重试机制，避免GitHub Pages超时
                const cacheLarge = (url, retry = 3) => {
                    return fetch(url)
                        .then(res => {
                            if (res.ok) return cache.put(url, res);
                            throw new Error('请求失败');
                        })
                        .catch(err => {
                            if (retry > 0) return cacheLarge(url, retry - 1); // 重试3次
                            console.log(`资源${url}缓存失败（已重试）`);
                        });
                };
                // 批量缓存大资源（异步不阻塞SW安装）
                CACHE_LARGE_COMPAT.forEach(url => cacheLarge(url));
                return self.skipWaiting();
            })
    );
});

// 2. 激活：清理旧缓存+补存失败的大资源
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => 
            Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME).map(old => caches.delete(old))
            )
        )
        .then(() => {
            // 补存安装阶段失败的大资源
            caches.open(CACHE_NAME).then(cache => {
                CACHE_LARGE_COMPAT.forEach(url => {
                    cache.match(url).then(match => {
                        if (!match) fetch(url).then(res => res.ok && cache.put(url, res));
                    });
                });
            });
            return self.clients.claim();
        })
    );
});

// 3. 请求拦截：适配GitHub Pages，优先缓存+降级策略
self.addEventListener('fetch', event => {
    const req = event.request;
    // 非GET/跨域请求直接走网络（GitHub Pages不支持非GET缓存）
    if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
        event.respondWith(fetch(req));
        return;
    }

    // 大资源请求：优先缓存，无缓存则走网络（不强制断点续传，避免触发限制）
    const isLarge = CACHE_LARGE_COMPAT.some(url => req.url.includes(url));
    if (isLarge) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(req)
                    .then(cached => cached || fetch(req).then(res => {
                        // 仅在响应成功时缓存（避免缓存错误资源）
                        res.ok && cache.put(req, res.clone());
                        return res;
                    }));
            })
        );
        return;
    }

    // 普通资源：先缓存后更新（极快响应，适配GitHub Pages）
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(req).then(cached => {
                const network = fetch(req).then(res => {
                    res.ok && cache.put(req, res.clone()); // 后台更新
                    return res;
                }).catch(() => cached); // 网络差时用缓存
                return cached || network;
            });
        })
    );
});