// Firebase initialization wrapper for browser environment
// This file initializes Firebase using the modular SDK

import { TIMEOUTS, LIMITS } from './utils/constants.js';
import { initServices } from './modules/firebase-service.js';
import { firebaseConfig } from './app-config.js';

// Initialize Firebase when modular SDK is available
function initFirebaseWhenReady() {
  try {
    // Using the global firebase namespace that should be available after SDK loads
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
      // Initialize app
      const app = firebase.initializeApp(firebaseConfig);
      
      // Get services - compat API doesn't require app parameter
      const auth = firebase.auth();
      const db = firebase.firestore();

      // Initialize services module
      initServices(auth, db, null);

      // Backward compatibility (silent fallback for external scripts/extensions)
      Object.defineProperty(window, 'auth', {
        get: () => auth,
        configurable: true
      });

      Object.defineProperty(window, 'db', {
        get: () => db,
        configurable: true
      });

      // Functions removed - not used in this app (uses direct REST API calls)
      
      // Port 5000 = dev server with emulators, port 3000 = production
      const isDevServer = window.location.port === '5000';
      
      if (isDevServer && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        try {
          // Use the same hostname as the page to avoid CORS issues
          const emulatorHost = window.location.hostname;
          db.useEmulator(emulatorHost, 8090);
          console.log('🔧 Connected to Firebase Emulators (Firestore)');
          console.log('⚠️ Dev server - using test data only');
        } catch (emulatorError) {
          console.error('Failed to connect to Firebase emulators:', emulatorError);
          console.error('Make sure emulators are running: firebase emulators:start or docker-compose up');
          console.log('🌐 Falling back to production Firebase backend');
        }
      } else {
        console.log('🌐 Using production Firebase backend');
      }
      
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return false;
  }
}

// Create a promise that resolves when Firebase is ready
const firebaseReadyPromise = new Promise((resolve, reject) => {
  // Try to initialize immediately
  if (initFirebaseWhenReady()) {
    resolve();
    return;
  }

  // If not ready, retry every 100ms for up to 30 seconds
  let attempts = 0;
  const maxAttempts = LIMITS.firebaseMaxAttempts;
  const retryInterval = setInterval(() => {
    attempts++;
    if (initFirebaseWhenReady()) {
      clearInterval(retryInterval);
      resolve();
    } else if (attempts >= maxAttempts) {
      clearInterval(retryInterval);
      const errorMsg = 'Timeout waiting for Firebase SDK';
      console.error('Failed to initialize Firebase after 30 seconds');
      reject(new Error(errorMsg));
    }
  }, TIMEOUTS.firebaseRetry);
});

// Export the promise-based check
export function getFirebaseReady() {
  return firebaseReadyPromise;
}

