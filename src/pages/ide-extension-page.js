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

      const originalContent = Array.from(installBtn.childNodes);

      const loadingIcon = document.createElement('span');
      loadingIcon.className = 'icon icon-inline';
      loadingIcon.setAttribute('aria-hidden', 'true');
      loadingIcon.textContent = 'hourglass_top';

      installBtn.replaceChildren(loadingIcon, document.createTextNode(' Opening Marketplace...'));

      window.open(VSCODE_EXTENSION_URL, '_blank', 'noopener');

      const successIcon = document.createElement('span');
      successIcon.className = 'icon icon-inline';
      successIcon.setAttribute('aria-hidden', 'true');
      successIcon.textContent = 'check_circle';

      installBtn.replaceChildren(successIcon, document.createTextNode(' Marketplace opened'));

      setTimeout(() => {
        installBtn.replaceChildren(...originalContent);
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
