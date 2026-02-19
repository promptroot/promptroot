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
    script.src = 'https://cdn.jsdelivr.net/npm/marked@14.1.2/marked.min.js';
    script.integrity = 'sha384-dAw12gnWShdrRMCwiNUvPHQ5IWS3uZwljXl3x7qNqvn+5gD/O/DXFCnR29GdXgOk';
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
    script.src = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
    script.integrity = 'sha384-PCSoOZTpbkikBEtd/+uV3WNdc676i9KUf01KOA8CnJotvlx8rRrETbDuwdjqTYvt';
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
