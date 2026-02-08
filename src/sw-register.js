// Service Worker registration
// Provides offline support and performance improvements for repeat visits
//
// Update Flow:
// 1. New SW installs (waits in 'installed' state).
// 2. Client detects update (via updatefound or SW_UPDATED message), shows notification with "Refresh" button.
// 3. User clicks "Refresh", client sends { type: 'SKIP_WAITING' } to waiting worker.
// 4. SW calls skipWaiting(), activates.
// 5. Clients reload (via controllerchange) or manually.

import { showToast } from './modules/toast.js';

function showUpdateToast() {
  const toast = showToast('App updated. Refresh for the latest version.', 'info', 0);

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Refresh Now';
  refreshBtn.style.marginLeft = '10px';
  refreshBtn.style.padding = '4px 8px';
  refreshBtn.style.borderRadius = '4px';
  refreshBtn.style.border = 'none';
  refreshBtn.style.background = 'rgba(255,255,255,0.2)';
  refreshBtn.style.color = 'inherit';
  refreshBtn.style.cursor = 'pointer';
  refreshBtn.style.fontSize = '0.9em';

  refreshBtn.onclick = () => {
    // Notify waiting worker to skip waiting
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if (navigator.serviceWorker.controller) {
        // Fallback
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      // Reload will be triggered by controllerchange event
    });
  };

  toast.appendChild(refreshBtn);
}

if ('serviceWorker' in navigator) {
  // Skip service worker on localhost to avoid caching issues during dev
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (!isLocalhost) {
    // Only register service worker on non-localhost environments
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        // Check for updates on page load
        registration.update();
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              showUpdateToast();
            }
          });
        });
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
      });

      // Listen for update messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          showUpdateToast();
        }
      });

      // Listen for controller change (when new SW takes over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    });
  }
}
