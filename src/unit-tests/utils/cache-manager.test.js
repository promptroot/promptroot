import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordCacheAccess, enforceCacheLimit, getCacheStats } from '../../utils/cache-manager.js';
import { LIMITS, STORAGE_KEYS } from '../../utils/constants.js';

function makePromptKey(i) {
  return `prompts:owner/repo@branch-${i}`;
}

function makeExpandedKeyFromPrompt(promptKey) {
  return promptKey.replace('prompts:', 'sidebar:expanded:');
}

describe('cache-manager', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('recordCacheAccess updates access log with latest timestamp', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    recordCacheAccess('prompts:test');

    const raw = sessionStorage.getItem(STORAGE_KEYS.cacheAccessLog);
    expect(raw).toBeTruthy();
    const obj = JSON.parse(raw);
    expect(obj['prompts:test']).toBe(1000);
    nowSpy.mockRestore();
  });

  it('enforceCacheLimit evicts least-recently-used entries when over limit', () => {
    const limit = LIMITS.promptCacheMaxEntries;
    const total = limit + 5; // exceed limit

    // Seed cache entries with timestamps
    for (let i = 0; i < total; i++) {
      const key = makePromptKey(i);
      const data = { files: [{ path: `file-${i}.md`, type: 'file' }], etag: `etag-${i}`, timestamp: 1000 + i };
      sessionStorage.setItem(key, JSON.stringify(data));
      // Add corresponding expanded state entries to verify cleanup
      const expandedKey = makeExpandedKeyFromPrompt(key);
      sessionStorage.setItem(expandedKey, JSON.stringify({ expanded: true }));
    }

    // Mark some entries as recently accessed to protect them from eviction
    recordCacheAccess(makePromptKey(total - 1));
    recordCacheAccess(makePromptKey(total - 2));

    enforceCacheLimit();

    // After eviction, only `limit` prompt entries should remain
    const stats = getCacheStats();
    expect(stats.total).toBe(limit);
    expect(stats.limit).toBe(limit);

    // Oldest entries should be gone; latest ones still present
    for (let i = 0; i < total - limit; i++) {
      const key = makePromptKey(i);
      expect(sessionStorage.getItem(key)).toBeNull();
      const expandedKey = makeExpandedKeyFromPrompt(key);
      expect(sessionStorage.getItem(expandedKey)).toBeNull();
    }

    // Recent entries should remain
    for (let i = total - limit; i < total; i++) {
      const key = makePromptKey(i);
      expect(sessionStorage.getItem(key)).toBeTruthy();
      const expandedKey = makeExpandedKeyFromPrompt(key);
      expect(sessionStorage.getItem(expandedKey)).toBeTruthy();
    }
  });

  it('getCacheStats reports utilization percent correctly', () => {
    const limit = LIMITS.promptCacheMaxEntries;
    const half = Math.floor(limit / 2);

    for (let i = 0; i < half; i++) {
      const key = makePromptKey(i);
      const data = { files: [], etag: null, timestamp: 2000 + i };
      sessionStorage.setItem(key, JSON.stringify(data));
    }

    const stats = getCacheStats();
    expect(stats.total).toBe(half);
    expect(stats.limit).toBe(limit);
    expect(stats.utilizationPercent).toBe(Math.round((half / limit) * 100));
  });
});
