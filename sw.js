/* ============================================================================
 * Service Worker — 极简离线缓存层
 * 策略：
 *   1. 预缓存 App Shell（安装即可离线）
 *   2. 导航请求 network-first（拿得到新版就更新，断网回落缓存的 index.html）
 *   3. 静态资源 stale-while-revalidate（秒开 + 后台静默更新）
 * 隐私：SW 只缓存公开的静态壳，绝不触碰 localStorage 中的密文，也不发起任何
 *      跨域请求；应用本身没有任何后端。
 * ==========================================================================*/
const VERSION = 'v1.0.0';
const CACHE = 'course-cal-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

/** 允许进入运行时缓存的静态资源类型（用户数据文件不在其列） */
const SHELL_ASSET = /\.(?:html|css|js|mjs|png|jpe?g|svg|webp|ico|woff2?|ttf|webmanifest)$/i;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {/* 单个资源缺失不阻断安装 */})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 不代理任何第三方请求

  // 导航请求：network-first，断网时回落 App Shell
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const preload = await e.preloadResponse;
        const res = preload || await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', res.clone());
        return res;
      } catch (_) {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('离线且无缓存', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // 其他同源静态资源：stale-while-revalidate
  // 只缓存 App Shell 类型的静态资源；任何用户数据文件（如导出的课表 .json）
  // 一律不进 Cache Storage —— Cache Storage 是明文的，缓存它等于泄漏隐私。
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => {
      const cacheable = res && res.status === 200 && res.type === 'basic' &&
        (SHELL_ASSET.test(url.pathname) || url.pathname.endsWith('/manifest.json'));
      if (cacheable) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || new Response('', { status: 504 });
  })());
});
