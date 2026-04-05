/**
 * clerq — Service Worker v1.0
 * Production Grade Caching Strategy
 *
 * Strategies:
 * - Shell:  Cache First (app shell, fonts, CSS, JS)
 * - Data:   Network First (Firebase, API calls)
 * - Images: Stale While Revalidate
 */

const APP_VERSION   = 'v1.0.0';
const CACHE_SHELL   = `clerq-shell-${APP_VERSION}`;
const CACHE_IMAGES  = `clerq-images-${APP_VERSION}`;
const ALL_CACHES    = [CACHE_SHELL, CACHE_IMAGES];

// App Shell — cache on install
const SHELL_ASSETS = [
  '/',
  './index.html',
  './home.html',
  './scan.html',
  './join.html',
  './session.html',
  './summary.html',
  './profile.html',
  './design.css',
  './core.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  // Offline fallback
  './offline.html',
];

// ── Install ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install failed:', err))
  );
});

// ── Activate ──
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => !ALL_CACHES.includes(key))
            .map(key => caches.delete(key))
        )
      ),
      // Take control immediately
      self.clients.claim(),
    ])
  );
});

// ── Fetch ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Firebase / external APIs → Network Only
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('fonts.g')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images → Stale While Revalidate
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  // App Shell → Cache First with Network Fallback
  event.respondWith(cacheFirst(request));
});

// ── Caching Strategies ──

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offline = await caches.match('./offline.html');
      return offline || new Response('אין חיבור לאינטרנט', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
    throw new Error('Network request failed');
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached  = await caches.match(request);
  const network = fetch(request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || await network;
}

// ── Push Notifications (future) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'clerq', {
      body: data.body,
      icon: './assets/icon-192.png',
      badge: '/assets/badge-72.png',
      tag: data.tag || 'clerq-notification',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
