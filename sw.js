// Service Worker for PromptRoot
// Provides offline support and dramatic performance improvements for repeat visits
// Expected: 88% faster repeat loads (~50ms vs 409ms)

const CACHE_VERSION = 'promptroot-v7';
const CACHE_NAME = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Critical assets to cache on install (cache-first strategy)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/styles.css',
  '/src/firebase-init.js',
  '/src/shared-init.js',
  '/src/font-init.js',
  '/src/app.js',
  '/assets/favicon.ico',
  
  // Core modules (most frequently used)
  '/src/modules/auth.js',
  '/src/modules/github-api.js',
  '/src/modules/prompt-list.js',
  '/src/modules/prompt-renderer.js',
  '/src/modules/prompt-viewer.js',
  '/src/modules/prompt-service.js',
  '/src/modules/sidebar.js',
  '/src/modules/header.js',
  '/src/modules/toast.js',
  '/src/modules/dropdown.js',
  
  // Utilities (only include files that exist)
  '/src/utils/constants.js',
  '/src/utils/dom-helpers.js',
  '/src/utils/session-cache.js',
  '/src/utils/lazy-loaders.js',
  '/src/utils/debounce.js',
  
  // Page initializers
  '/src/pages/index-page.js',
  '/src/pages/jules-page.js',
  '/src/pages/queue-page.js',
  '/src/pages/profile-page.js',
  '/src/pages/sessions-page.js',
  
  // External dependencies (high priority - largest performance win)
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',
  'https://cdn.jsdelivr.net/npm/marked@11.1.0/marked.min.js',
  
  // Google Fonts (cache to avoid FOIT - Flash of Invisible Text)
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block'
];

// Assets to exclude from caching (dynamic data)
const CACHE_EXCLUDE_PATTERNS = [
  /\/api\//,
  /github\.com\/api/,
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /oauth2\.googleapis\.com/,
  /firebaselogging\.googleapis\.com/,
  /chrome-extension:\/\//,
  /hot-update/
];

// Install event - cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Use addAll for atomic caching - fails if any asset fails
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force activate immediately (skip waiting)
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
        // Still install even if some assets fail to cache
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (cacheName.startsWith('promptroot-') && cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for excluded patterns (API calls, external auth, etc.)
  if (CACHE_EXCLUDE_PATTERNS.some(pattern => pattern.test(request.url))) {
    return; // Let browser handle normally
  }
  
  // Skip caching for non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip caching for chrome-extension URLs
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  event.respondWith(
    cacheFirstStrategy(request)
  );
});

// Cache-first strategy: Try cache, fallback to network, then cache response
async function cacheFirstStrategy(request) {
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Not in cache, fetch from network
    const networkResponse = await fetch(request);
    
    // Cache successful responses (200-299)
    if (networkResponse && networkResponse.status >= 200 && networkResponse.status < 300) {
      const cache = await caches.open(RUNTIME_CACHE);
      // Clone response before caching (can only read once)
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // Try cache again as fallback (for offline scenarios)
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If offline and no cache, return offline page or error
    if (request.mode === 'navigate') {
      return new Response(
        `<!DOCTYPE html>
        <html>
        <head>
          <title>Offline - PromptRoot</title>
          <style>
            body { 
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .offline-message {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { margin: 0.5rem 0; color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="offline-message">
            <div class="icon">📡</div>
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <p><small>Some cached content may be available.</small></p>
          </div>
        </body>
        </html>`,
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // For non-navigation requests, return error response
    return new Response('Network error', {
      status: 408,
      statusText: 'Request Timeout'
    });
  }
}

// Message handler for manual cache updates (future use)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('promptroot-')) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  }
});
