/**
 * Jules Page Initialization
 * Handles Jules account page functionality
 */

import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { loadJulesAccountInfo } from '../modules/jules-account.js';
import { showJulesKeyModal } from '../modules/jules-modal.js';
import { deleteStoredJulesKey, checkJulesKey } from '../modules/jules-keys.js';
import { showToast } from '../modules/toast.js';
import { showConfirm } from '../modules/confirm-modal.js';
import { TIMEOUTS } from '../utils/constants.js';
import { renderStatus, STATUS_TYPES } from '../modules/status-renderer.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadJulesInfo() {
  const auth = getAuth();
  const user = auth?.currentUser;
  
  const loadingDiv = document.getElementById('julesLoading');
  const notSignedInDiv = document.getElementById('julesNotSignedIn');
  const profileSection = document.getElementById('julesProfileInfoSection');
  const noJulesKeySection = document.getElementById('noJulesKeySection');
  const julesContentSection = document.getElementById('julesContentSection');
  const julesKeyStatus = document.getElementById('julesKeyStatus');
  
  if (!user) {
    loadingDiv.classList.add('hidden');
    profileSection.classList.add('hidden');
    notSignedInDiv.classList.remove('hidden');
    return;
  }

  try {
    loadingDiv.classList.remove('hidden');
    notSignedInDiv.classList.add('hidden');
    profileSection.classList.add('hidden');
    
    // Check if user has Jules key
    const hasKey = await checkJulesKey(user.uid);
    
    if (julesKeyStatus) {
      renderStatus(
        julesKeyStatus,
        hasKey ? STATUS_TYPES.SAVED : STATUS_TYPES.NOT_SAVED,
        hasKey ? 'Saved' : 'Not saved'
      );
    }
    
    loadingDiv.classList.add('hidden');
    profileSection.classList.remove('hidden');
    
    const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
    
    if (hasKey) {
      if (noJulesKeySection) noJulesKeySection.classList.add('hidden');
      if (julesContentSection) julesContentSection.classList.remove('hidden');
      if (loadJulesInfoBtn) loadJulesInfoBtn.classList.remove('hidden');
      
      // Load Jules account information
      await loadJulesAccountInfo(user);
    } else {
      if (noJulesKeySection) noJulesKeySection.classList.remove('hidden');
      if (julesContentSection) julesContentSection.classList.add('hidden');
      if (loadJulesInfoBtn) loadJulesInfoBtn.classList.add('hidden');
    }
  } catch (err) {
    console.error('Jules info loading error:', err);
    loadingDiv.classList.add('hidden');
  }
}

async function initApp() {
  // Set up Jules key event handlers
  const addJulesKeyBtnProminent = document.getElementById('addJulesKeyBtnProminent');
  
  const addKeyHandler = () => {
    showJulesKeyModal(() => {
      // Reload Jules info after saving key
      const auth = getAuth();
      const user = auth?.currentUser;
      if (user) {
        loadJulesInfo();
      }
    });
  };
  
  if (addJulesKeyBtnProminent) {
    addJulesKeyBtnProminent.onclick = addKeyHandler;
  }
  
  // Set up load Jules info button
  const loadJulesInfoBtn = document.getElementById('loadJulesInfoBtn');
  if (loadJulesInfoBtn) {
    loadJulesInfoBtn.onclick = () => {
      const auth = getAuth();
      const user = auth?.currentUser;
      if (user) {
        loadJulesInfo();
      }
    };
  }

  try {
    await waitForFirebase();
    const auth = getAuth();
    auth.onAuthStateChanged((user) => {
      if (user) {
        loadJulesInfo();
      } else {
        document.getElementById('julesProfileInfoSection').classList.add('hidden');
        document.getElementById('julesNotSignedIn').classList.remove('hidden');
      }
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
