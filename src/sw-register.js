// Service Worker registration
// Provides offline support and performance improvements for repeat visits

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
              // New version available - could show toast notification here
            }
          });
        });
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
    });
  }
}
