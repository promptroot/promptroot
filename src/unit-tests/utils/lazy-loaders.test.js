import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('lazy-loaders', () => {
  let originalCreateElement;
  let loadMarked, loadFuse;

  beforeEach(async () => {
    // Clear window globals
    delete window.marked;
    delete window.Fuse;

    // Clear module cache to reset loadedLibraries and loadingPromises
    vi.resetModules();
    
    // Re-import fresh module
    const module = await import('../../utils/lazy-loaders.js');
    loadMarked = module.loadMarked;
    loadFuse = module.loadFuse;

    // Mock document.createElement for script tags
    originalCreateElement = document.createElement;
    
    // Mock head.appendChild
    document.head.appendChild = vi.fn();
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    vi.restoreAllMocks();
  });

  describe('loadMarked', () => {
    it('should load marked.js and return window.marked', async () => {
      const markedMock = { parse: vi.fn() };
      let capturedScript;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      const loadPromise = loadMarked();
      
      // Simulate successful script load
      window.marked = markedMock;
      capturedScript.onload();
      
      const result = await loadPromise;
      
      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(capturedScript.src).toBe('https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js');
      expect(capturedScript.integrity).toBe('sha384-948ahk4ZmxYVYOc+rxN1H2gM1EJ2Duhp7uHtZ4WSLkV4Vtx5MUqnV+l7u9B+jFv+');
      expect(capturedScript.crossOrigin).toBe('anonymous');
      expect(document.head.appendChild).toHaveBeenCalled();
      expect(result).toBe(markedMock);
    });

    it('should return cached marked.js on subsequent calls', async () => {
      const markedMock = { parse: vi.fn() };
      let capturedScript;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      // First load
      const loadPromise1 = loadMarked();
      window.marked = markedMock;
      capturedScript.onload();
      await loadPromise1;
      
      // Second load should use cache
      const result2 = await loadMarked();
      
      expect(document.createElement).toHaveBeenCalledTimes(1);
      expect(result2).toBe(markedMock);
    });

    it('should reject with error if script fails to load', async () => {
      let capturedScript;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      const loadPromise = loadMarked();
      
      // Simulate script error
      capturedScript.onerror();
      
      await expect(loadPromise).rejects.toThrow('Failed to load marked.js');
    });

    it('should allow retry after failed load', async () => {
      const markedMock = { parse: vi.fn() };
      let capturedScript;
      let callCount = 0;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          callCount++;
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      // First load fails
      const loadPromise1 = loadMarked();
      capturedScript.onerror();
      
      await expect(loadPromise1).rejects.toThrow('Failed to load marked.js');
      
      // Second load succeeds
      const loadPromise2 = loadMarked();
      window.marked = markedMock;
      capturedScript.onload();
      
      const result = await loadPromise2;
      expect(result).toBe(markedMock);
      expect(callCount).toBe(2);
    });
  });

  describe('loadFuse', () => {
    it('should load Fuse.js and return window.Fuse', async () => {
      const fuseMock = vi.fn();
      let capturedScript;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      const loadPromise = loadFuse();
      
      // Simulate successful script load
      window.Fuse = fuseMock;
      capturedScript.onload();
      
      const result = await loadPromise;
      
      expect(document.createElement).toHaveBeenCalledWith('script');
      expect(capturedScript.src).toBe('https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.js');
      expect(capturedScript.integrity).toBe('sha384-P/y/5cwqUn6MDvJ9lCHJSaAi2EoH3JSeEdyaORsQMPgbpvA+NvvUqik7XH2YGBjb');
      expect(capturedScript.crossOrigin).toBe('anonymous');
      expect(document.head.appendChild).toHaveBeenCalled();
      expect(result).toBe(fuseMock);
    });

    it('should return cached Fuse.js on subsequent calls', async () => {
      const fuseMock = vi.fn();
      let capturedScript;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      // First load
      const loadPromise1 = loadFuse();
      window.Fuse = fuseMock;
      capturedScript.onload();
      await loadPromise1;
      
      // Second load should use cache
      const result2 = await loadFuse();
      
      expect(document.createElement).toHaveBeenCalledTimes(1);
      expect(result2).toBe(fuseMock);
    });

    it('should reject with error if script fails to load', async () => {
      let capturedScript;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      const loadPromise = loadFuse();
      
      // Simulate script error
      capturedScript.onerror();
      
      await expect(loadPromise).rejects.toThrow('Failed to load Fuse.js');
    });

    it('should allow retry after failed load', async () => {
      const fuseMock = vi.fn();
      let capturedScript;
      let callCount = 0;
      
      document.createElement = vi.fn((tag) => {
        if (tag === 'script') {
          callCount++;
          capturedScript = {
            src: '',
            onload: null,
            onerror: null
          };
          return capturedScript;
        }
        return originalCreateElement.call(document, tag);
      });
      
      // First load fails
      const loadPromise1 = loadFuse();
      capturedScript.onerror();
      
      await expect(loadPromise1).rejects.toThrow('Failed to load Fuse.js');
      
      // Second load succeeds
      const loadPromise2 = loadFuse();
      window.Fuse = fuseMock;
      capturedScript.onload();
      
      const result = await loadPromise2;
      expect(result).toBe(fuseMock);
      expect(callCount).toBe(2);
    });
  });
});
