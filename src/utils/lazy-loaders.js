// ===== Lazy Loading Utilities for External Libraries =====
// Provides functions to dynamically load external CDN libraries only when needed

const loadedLibraries = new Map();
const loadingPromises = new Map();

/**
 * Lazy load marked.js for markdown parsing
 * @returns {Promise<object>} The marked library
 */
export async function loadMarked() {
  if (loadedLibraries.has('marked')) {
    return window.marked;
  }
  
  if (loadingPromises.has('marked')) {
    return loadingPromises.get('marked');
  }
  
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js';
    script.integrity = 'sha384-948ahk4ZmxYVYOc+rxN1H2gM1EJ2Duhp7uHtZ4WSLkV4Vtx5MUqnV+l7u9B+jFv+';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      loadedLibraries.set('marked', true);
      loadingPromises.delete('marked');
      resolve(window.marked);
    };
    script.onerror = () => {
      loadingPromises.delete('marked');
      reject(new Error('Failed to load marked.js'));
    };
    document.head.appendChild(script);
  });
  
  loadingPromises.set('marked', promise);
  return promise;
}

/**
 * Lazy load Fuse.js for fuzzy search
 * @returns {Promise<object>} The Fuse constructor
 */
export async function loadFuse() {
  if (loadedLibraries.has('fuse')) {
    return window.Fuse;
  }
  
  if (loadingPromises.has('fuse')) {
    return loadingPromises.get('fuse');
  }
  
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.js';
    script.integrity = 'sha384-P/y/5cwqUn6MDvJ9lCHJSaAi2EoH3JSeEdyaORsQMPgbpvA+NvvUqik7XH2YGBjb';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      loadedLibraries.set('fuse', true);
      loadingPromises.delete('fuse');
      resolve(window.Fuse);
    };
    script.onerror = () => {
      loadingPromises.delete('fuse');
      reject(new Error('Failed to load Fuse.js'));
    };
    document.head.appendChild(script);
  });
  
  loadingPromises.set('fuse', promise);
  return promise;
}
