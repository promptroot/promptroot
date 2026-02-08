/**
 * Handler Registry Module
 * centralized registry for global handlers to replace window property assignments
 */

const handlers = new Map();

/**
 * Register a handler function
 * @param {string} namespace - The namespace for the handler (e.g., 'promptViewer')
 * @param {string} key - The specific key for the handler
 * @param {Function} fn - The handler function
 */
export function registerHandler(namespace, key, fn) {
  if (!namespace || !key || typeof fn !== 'function') {
    console.warn('Invalid arguments for registerHandler');
    return;
  }
  const registryKey = `${namespace}:${key}`;
  handlers.set(registryKey, fn);
}

/**
 * Get a handler function
 * @param {string} namespace - The namespace for the handler
 * @param {string} key - The specific key for the handler
 * @returns {Function|undefined} The handler function or undefined
 */
export function getHandler(namespace, key) {
  const registryKey = `${namespace}:${key}`;
  return handlers.get(registryKey);
}

/**
 * Clear all handlers for a namespace
 * @param {string} namespace - The namespace to clear
 */
export function clearHandlers(namespace) {
  for (const registryKey of handlers.keys()) {
    if (registryKey.startsWith(`${namespace}:`)) {
      handlers.delete(registryKey);
    }
  }
}
