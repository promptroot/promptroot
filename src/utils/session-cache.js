// Session storage cache utilities
import { CACHE_DURATIONS, CACHE_KEYS, CACHE_POLICIES, CACHE_STRATEGIES } from './constants.js';
import { getAuth } from '../modules/firebase-service.js';

export { CACHE_KEYS };

function hashToken(token) {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash) + token.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getStoredToken() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('github_access_token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    return parsed?.token || null;
  } catch (error) {
    console.warn('Failed to parse stored GitHub token for cache keying:', error);
    return null;
  }
}

function getUserCacheIdentity(userId) {
  if (userId) {
    return `uid:${userId}`;
  }

  const authUserId = getAuth()?.currentUser?.uid;
  if (authUserId) {
    return `uid:${authUserId}`;
  }

  const token = getStoredToken();
  if (token) {
    return `token:${hashToken(token)}`;
  }

  return 'guest';
}

function getCacheKey(key, userId, scopeKey = null) {
  const identity = getUserCacheIdentity(userId);
  const scopeSuffix = scopeKey ? `:${scopeKey}` : '';
  return `${key}${scopeSuffix}::${identity}`;
}

export function setCache(key, data, userId = null, scopeKey = null) {
  try {
    const cacheKey = getCacheKey(key, userId, scopeKey);
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting cache:', error);
  }
}

/**
 * Get detailed state of a cache item
 * @param {string} key - Cache key
 * @param {string} [userId] - Optional user ID
 * @returns {object} Cache state metadata
 */
export function getCacheState(key, userId = null, scopeKey = null) {
  try {
    const cacheKey = getCacheKey(key, userId, scopeKey);
    const cached = sessionStorage.getItem(cacheKey);
    const policy = CACHE_POLICIES[key] || CACHE_POLICIES.DEFAULT;

    if (!cached) {
      return {
        exists: false,
        data: null,
        timestamp: null,
        age: 0,
        isStale: true,
        policy
      };
    }

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    // Check staleness based on policy TTL
    // Session-duration caches (ttl === 0) never expire within the session
    // Time-based caches are stale when age exceeds their TTL
    // If age is NaN (missing timestamp), treat as stale
    const isSessionCache = policy.ttl === CACHE_DURATIONS.session;
    const isStale = isNaN(age) || (!isSessionCache && age >= policy.ttl);

    return {
      exists: true,
      data,
      timestamp,
      age,
      isStale,
      policy
    };
  } catch (error) {
    console.error('Error getting cache state:', error);
    return {
      exists: false,
      data: null,
      timestamp: null,
      age: 0,
      isStale: true,
      policy: CACHE_POLICIES[key] || CACHE_POLICIES.DEFAULT,
      error
    };
  }
}

export function getCache(key, userId = null, scopeKey = null) {
  try {
    const state = getCacheState(key, userId, scopeKey);
    
    if (!state.exists) return null;

    // Handle staleness based on strategy
    if (state.isStale) {
      switch (state.policy.strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
          // Expired cache is invalid - clear and return null
          clearCache(key, userId, scopeKey);
          return null;
        
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
          // SWR would return stale data and trigger background refresh
          // Not implemented yet - treat as CACHE_FIRST for now
          clearCache(key, userId, scopeKey);
          return null;
        
        case CACHE_STRATEGIES.NETWORK_ONLY:
          // Network-only doesn't use cache - this shouldn't happen
          // but clear and return null to be safe
          clearCache(key, userId, scopeKey);
          return null;
        
        default:
          // Unknown strategy - fail safe by clearing stale cache
          clearCache(key, userId, scopeKey);
          return null;
      }
    }

    return state.data;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
}

export function clearCache(key, userId = null, scopeKey = null) {
  try {
    const cacheKey = getCacheKey(key, userId, scopeKey);
    sessionStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

export function clearUserCache(userId = null) {
  try {
    const identity = getUserCacheIdentity(userId);
    const identitySuffix = `::${identity}`;
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.endsWith(identitySuffix)) {
        sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error clearing user cache:', error);
  }
}

export function clearAllCache() {
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}
