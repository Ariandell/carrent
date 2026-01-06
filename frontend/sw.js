const CACHE_NAME = 'fpv-racer-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/control.html',
    '/auth.html',
    '/profile.html',
    '/favicon.svg',
    '/css/antigravity.css',
    '/css/dashboard.css',
    '/css/style.css',
    '/js/config.js',
    '/js/lang.js',
    '/js/api.js',
    '/js/toast.js',
    '/js/theme.js',
    '/js/tailwind_config.js',
    '/js/mobile_detect.js',
    '/js/scroll_reveal.js',
    '/js/prism.js',
    '/js/fluid.js',
    '/js/dashboard.js',
    '/js/control.js',
    '/js/auth.js',
    'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});
