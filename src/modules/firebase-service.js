let authInstance = null;
let dbInstance = null;
let functionsInstance = null;
let readyCallbacks = [];
let isReady = false;

/**
 * Initialize the Firebase services
 * @param {Object} auth - The Firebase Auth instance
 * @param {Object} db - The Firebase Firestore instance
 * @param {Object} functions - The Firebase Functions instance
 */
export function initServices(auth, db, functions) {
  authInstance = auth;
  dbInstance = db;
  functionsInstance = functions;
  isReady = true;

  // Execute all queued callbacks
  readyCallbacks.forEach(callback => {
    try {
      callback();
    } catch (e) {
      console.error('Error in firebase ready callback:', e);
    }
  });
  readyCallbacks = [];
}

/**
 * Get the Firebase Auth instance
 * @returns {Object|null} The Firebase Auth instance
 */
export function getAuth() {
  if (!authInstance) {
    console.warn('Firebase Auth accessed before initialization');
  }
  return authInstance;
}

/**
 * Get the Firebase Firestore instance
 * @returns {Object|null} The Firebase Firestore instance
 */
export function getDb() {
  if (!dbInstance) {
    console.warn('Firebase DB accessed before initialization');
  }
  return dbInstance;
}

/**
 * Get the Firebase Functions instance
 * @returns {Object|null} The Firebase Functions instance
 */
export function getFunctions() {
  return functionsInstance;
}

/**
 * Register a callback to run when Firebase is ready
 * @param {Function} callback - The callback function
 */
export function onFirebaseReady(callback) {
  if (isReady) {
    try {
      callback();
    } catch (e) {
      console.error('Error in firebase ready callback:', e);
    }
  } else {
    readyCallbacks.push(callback);
  }
}

/**
 * Reset the Firebase services (mainly for testing)
 */
export function resetServices() {
  authInstance = null;
  dbInstance = null;
  functionsInstance = null;
  readyCallbacks = [];
  isReady = false;
}
