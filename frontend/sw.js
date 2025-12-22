self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('fpv-store').then((cache) => cache.addAll([
            '/dashboard.html',
            '/control.html',
            '/css/style.css',
            '/js/api.js'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
