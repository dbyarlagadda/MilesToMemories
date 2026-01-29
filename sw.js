// MilesToMemories Service Worker
const CACHE_NAME = 'milestomemories-v1';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/add-trip.html',
    '/profile.html',
    '/api.js',
    '/manifest.json',
    '/offline.html',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app shell');
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests except for specific allowed origins
    if (!url.origin.includes(self.location.origin) &&
        !url.origin.includes('fonts.googleapis.com') &&
        !url.origin.includes('fonts.gstatic.com') &&
        !url.origin.includes('unpkg.com') &&
        !url.origin.includes('images.unsplash.com')) {
        return;
    }

    // Handle API requests - network first, then cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response before caching
                    const responseClone = response.clone();

                    // Only cache GET requests
                    if (request.method === 'GET') {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }

                    return response;
                })
                .catch(() => {
                    // Return cached API response if available
                    return caches.match(request);
                })
        );
        return;
    }

    // Handle image requests - cache first, then network
    if (request.destination === 'image' || url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached image and update cache in background
                        fetch(request).then((response) => {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, response);
                            });
                        });
                        return cachedResponse;
                    }

                    return fetch(request).then((response) => {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                        return response;
                    });
                })
        );
        return;
    }

    // Handle page navigations - network first with offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            return caches.match(OFFLINE_URL);
                        });
                })
        );
        return;
    }

    // Default strategy - stale while revalidate
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, networkResponse.clone());
                        });
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
    );
});

// Handle background sync for offline trip creation
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-trips') {
        event.waitUntil(syncTrips());
    }
});

async function syncTrips() {
    const cache = await caches.open(CACHE_NAME);
    const pendingTrips = await cache.match('/pending-trips');

    if (pendingTrips) {
        const trips = await pendingTrips.json();

        for (const trip of trips) {
            try {
                await fetch('/api/trips', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${trip.token}`
                    },
                    body: JSON.stringify(trip.data)
                });
            } catch (error) {
                console.error('Failed to sync trip:', error);
            }
        }

        // Clear pending trips after sync
        await cache.delete('/pending-trips');
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();

        const options = {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
