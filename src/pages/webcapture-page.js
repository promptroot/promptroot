/**
 * Web Capture Page Initialization
 * Handles extension download functionality and detection
 */

import { TIMEOUTS, WEB_CAPTURE_EXTENSION_URL } from '../utils/constants.js';
import { detectExtension, isChromium } from '../utils/extension-detector.js';

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function initApp() {
  if (isChromium()) {
    await checkExtensionStatus();
  }

  // Chrome Web Store button
  const downloadBtn = document.getElementById('downloadExtensionBtn');
  if (downloadBtn && !downloadBtn.dataset.bound) {
    downloadBtn.dataset.bound = 'true';
    downloadBtn.addEventListener('click', async () => {
      try {
        downloadBtn.disabled = true;
        const originalDownloadLabel = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">hourglass_top</span> Opening Chrome Web Store...';

        window.open(WEB_CAPTURE_EXTENSION_URL, '_blank', 'noopener');

        downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">check_circle</span> Store opened';
        setTimeout(() => {
          downloadBtn.innerHTML = originalDownloadLabel;
          downloadBtn.disabled = false;
        }, TIMEOUTS.actionFeedback);
      } catch (error) {
        console.error('Store link failed:', error);
        downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">error</span> Unable to open store';
        setTimeout(() => {
          downloadBtn.innerHTML = originalDownloadLabel;
          downloadBtn.disabled = false;
        }, TIMEOUTS.actionFeedback);
      }
    });
  }
}

async function checkExtensionStatus() {
  const downloadBtn = document.getElementById('downloadExtensionBtn');
  if (!downloadBtn) return;

  const isInstalled = await detectExtension();

  if (isInstalled) {
    downloadBtn.innerHTML = '<span class="icon icon-inline" aria-hidden="true">store</span> View in Chrome Web Store';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
