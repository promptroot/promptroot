const handlers = new Map();

export function registerHandler(namespace, key, fn) {
  if (!namespace || !key || typeof fn !== 'function') {
    console.warn('Invalid arguments for registerHandler');
    return;
  }
  const registryKey = `${namespace}:${key}`;
  handlers.set(registryKey, fn);
}

export function getHandler(namespace, key) {
  const registryKey = `${namespace}:${key}`;
  return handlers.get(registryKey);
}

export function clearHandlers(namespace) {
  for (const registryKey of handlers.keys()) {
    if (registryKey.startsWith(`${namespace}:`)) {
      handlers.delete(registryKey);
    }
  }
}
