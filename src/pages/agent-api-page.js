/**
 * Agent API Page Initialization
 */

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { initAgentKeys } from '../modules/agent-keys.js';
import { TIMEOUTS } from '../utils/constants.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function initApp() {
  try {
    await waitForFirebase();
    const auth = getAuth();
    auth.onAuthStateChanged((user) => {
      initAgentKeys(user);
    });
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
