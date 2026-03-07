/**
 * IDE Extension Page Initialization
 * Handles marketplace link functionality
 */

import { TIMEOUTS, VSCODE_EXTENSION_URL } from '../utils/constants.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

function initApp() {
  const installBtn = document.getElementById('installExtensionBtn');
  if (installBtn && !installBtn.dataset.bound) {
    installBtn.dataset.bound = 'true';
    installBtn.addEventListener('click', () => {
      installBtn.disabled = true;
      const originalLabel = installBtn.innerHTML;
      installBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">hourglass_top</span> Opening Marketplace...';

      window.open(VSCODE_EXTENSION_URL, '_blank', 'noopener');

      installBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Marketplace opened';
      setTimeout(() => {
        installBtn.innerHTML = originalLabel;
        installBtn.disabled = false;
      }, TIMEOUTS.actionFeedback);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
