// Service Worker registration
// Provides offline support and performance improvements for repeat visits

if ('serviceWorker' in navigator) {
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
