// Service worker disabled — cleans up caches and unregisters.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  self.registration.unregister();
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => client.navigate(client.url));
  });
});
