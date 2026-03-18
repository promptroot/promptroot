import { getCache, setCache, clearCache } from './session-cache.js';
import { getAuth, getDb } from '../modules/firebase-service.js';

/**
 * Retry an asynchronous operation with exponential backoff
 * @param {Function} operation - The async function to execute
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<any>} - The result of the operation
 */
export async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      // Don't retry if it's a permission error or not found (unless we want to retry not found?)
      // Usually network errors are retried.
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Get a Firestore collection reference
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @returns {Object} - Firestore collection reference
 */
function getCollectionRef(collectionOrRef) {
  if (typeof collectionOrRef === 'string') {
    const db = getDb();
    if (!db) throw new Error('Firestore not initialized');
    return db.collection(collectionOrRef);
  }
  return collectionOrRef;
}

/**
 * Get the current user ID if available
 * @returns {string|null}
 */
function getCurrentUserId() {
  const auth = getAuth();
  return auth?.currentUser?.uid || null;
}

/**
 * Resolve cache key and user ID from input
 * @param {string|Object} cacheKey - Cache key string or object { key, userId }
 * @returns {Object|null} - { key, userId } or null
 */
function resolveCacheKey(cacheKey) {
    if (!cacheKey) return null;
    if (typeof cacheKey === 'string') {
        return { key: cacheKey, userId: getCurrentUserId() };
    }
    return {
        key: cacheKey.key,
        userId: cacheKey.userId !== undefined ? cacheKey.userId : getCurrentUserId()
    };
}

/**
 * Get a document from Firestore with caching
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @param {string} docId - Document ID
 * @param {string|Object} [cacheKey] - Cache key for session storage
 * @returns {Promise<Object|null>} - Document data or null if not found
 */
export async function getDoc(collectionOrRef, docId, cacheKey = null) {
  const resolvedCache = resolveCacheKey(cacheKey);

  if (resolvedCache) {
    const cached = getCache(resolvedCache.key, resolvedCache.userId);
    if (cached) return cached;
  }

  return retryOperation(async () => {
    const colRef = getCollectionRef(collectionOrRef);
    const docSnap = await colRef.doc(docId).get();

    if (!docSnap.exists) return null;

    const data = { id: docSnap.id, ...docSnap.data() };

    if (resolvedCache) {
      setCache(resolvedCache.key, data, resolvedCache.userId);
    }

    return data;
  });
}

/**
 * Query a Firestore collection with caching
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @param {Object} [options] - Query options: filters, orderBy, limit
 * @param {string|Object} [cacheKey] - Cache key for session storage
 * @returns {Promise<Array>} - Array of document data
 */
export async function queryCollection(collectionOrRef, options = {}, cacheKey = null) {
  const resolvedCache = resolveCacheKey(cacheKey);

  if (resolvedCache) {
    const cached = getCache(resolvedCache.key, resolvedCache.userId);
    if (cached) return cached;
  }

  return retryOperation(async () => {
    let query = getCollectionRef(collectionOrRef);

    if (options.filters) {
      options.filters.forEach(filter => {
        // filter can be [field, op, value] or {field, op, value}
        if (Array.isArray(filter)) {
          query = query.where(filter[0], filter[1], filter[2]);
        } else {
          query = query.where(filter.field, filter.op, filter.value);
        }
      });
    }

    if (options.orderBy) {
      const orderBys = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      orderBys.forEach(order => {
        if (typeof order === 'string') {
          query = query.orderBy(order);
        } else {
          query = query.orderBy(order.field, order.direction || 'asc');
        }
      });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (resolvedCache) {
      setCache(resolvedCache.key, results, resolvedCache.userId);
    }

    return results;
  });
}

/**
 * Set a document in Firestore
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @param {string} docId - Document ID
 * @param {Object} data - Document data
 * @param {Object} [options] - Set options (e.g. { merge: true })
 * @param {string|Object} [cacheKey] - Cache key to update/invalidate
 * @returns {Promise<void>}
 */
export async function setDoc(collectionOrRef, docId, data, options = { merge: true }, cacheKey = null) {
  const resolvedCache = resolveCacheKey(cacheKey);

  // Optimistic update — track previous value so we can roll back on failure
  let previousCacheValue = null;
  let hadPreviousCache = false;

  if (resolvedCache) {
    const cached = getCache(resolvedCache.key, resolvedCache.userId);
    if (cached) {
        hadPreviousCache = true;
        previousCacheValue = cached;
        if (Array.isArray(cached)) {
            // It's a list. We could try to find and update the item, or add it.
            // But query constraints might make it invalid (e.g. filter by status).
            // Safer to clear cache for lists.
            clearCache(resolvedCache.key, resolvedCache.userId);
        } else {
            // It's a single object.
            const newData = options.merge ? { ...cached, ...data, id: docId } : { ...data, id: docId };
            setCache(resolvedCache.key, newData, resolvedCache.userId);
        }
    }
  }

  try {
    return await retryOperation(async () => {
      const colRef = getCollectionRef(collectionOrRef);
      await colRef.doc(docId).set(data, options);
    });
  } catch (error) {
    // Rollback optimistic cache update so cache stays consistent with Firestore
    if (resolvedCache) {
      if (hadPreviousCache) {
        setCache(resolvedCache.key, previousCacheValue, resolvedCache.userId);
      } else {
        clearCache(resolvedCache.key, resolvedCache.userId);
      }
    }
    throw error;
  }
}

/**
 * Update a document in Firestore
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @param {string} docId - Document ID
 * @param {Object} data - data to update
 * @param {string|Object} [cacheKey] - Cache key to update/invalidate
 * @returns {Promise<void>}
 */
export async function updateDoc(collectionOrRef, docId, data, cacheKey = null) {
  const resolvedCache = resolveCacheKey(cacheKey);

  if (resolvedCache) {
    const cached = getCache(resolvedCache.key, resolvedCache.userId);
    if (cached) {
        if (Array.isArray(cached)) {
            // List: clear it
            clearCache(resolvedCache.key, resolvedCache.userId);
        } else {
            // Single doc: update it
            const newData = { ...cached, ...data };
            setCache(resolvedCache.key, newData, resolvedCache.userId);
        }
    }
  }

  return retryOperation(async () => {
    const colRef = getCollectionRef(collectionOrRef);
    await colRef.doc(docId).update(data);
  });
}

/**
 * Add a new document to a collection
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @param {Object} data - Document data
 * @param {string|Object} [cacheKey] - Cache key to invalidate (usually a list key)
 * @returns {Promise<string>} - The new document ID
 */
export async function addDoc(collectionOrRef, data, cacheKey = null) {
  const resolvedCache = resolveCacheKey(cacheKey);

  if (resolvedCache) {
    // Adding to a collection usually means invalidating the list cache
    clearCache(resolvedCache.key, resolvedCache.userId);
  }

  return retryOperation(async () => {
    const colRef = getCollectionRef(collectionOrRef);
    const docRef = await colRef.add(data);
    return docRef.id;
  });
}

/**
 * Delete a document from Firestore
 * @param {string|Object} collectionOrRef - Collection name or reference
 * @param {string} docId - Document ID
 * @param {string|Object} [cacheKey] - Cache key to invalidate
 * @returns {Promise<void>}
 */
export async function deleteDoc(collectionOrRef, docId, cacheKey = null) {
    const resolvedCache = resolveCacheKey(cacheKey);

    if (resolvedCache) {
        clearCache(resolvedCache.key, resolvedCache.userId);
    }

    return retryOperation(async () => {
      const colRef = getCollectionRef(collectionOrRef);
      await colRef.doc(docId).delete();
    });
}

/**
 * Get the server timestamp
 * @returns {Object} - Firestore server timestamp
 */
export function getServerTimestamp() {
  const fb = window.firebase || (typeof firebase !== 'undefined' ? firebase : null);
  if (!fb || !fb.firestore) {
      throw new Error('Firebase not initialized');
  }
  return fb.firestore.FieldValue.serverTimestamp();
}

/**
 * Get the delete field value
 * @returns {Object} - Firestore delete field value
 */
export function getFieldDelete() {
  const fb = window.firebase || (typeof firebase !== 'undefined' ? firebase : null);
  if (!fb || !fb.firestore) {
      throw new Error('Firebase not initialized');
  }
  return fb.firestore.FieldValue.delete();
}
