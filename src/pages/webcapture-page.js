/**
 * Web Capture Page Initialization
 * Handles extension download functionality and detection
 */

import { TIMEOUTS, WEB_CAPTURE_EXTENSION_URL } from '../utils/constants.js';
import { detectExtension, isChromium } from '../utils/extension-detector.js';

function updateButtonContent(btn, iconName, text) {
  const icon = document.createElement('span');
  icon.className = 'icon icon-inline';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = iconName;

  const textNode = document.createTextNode(` ${text}`);
  btn.replaceChildren(icon, textNode);
}

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
        const originalNodes = Array.from(downloadBtn.childNodes).map(n => n.cloneNode(true));
        updateButtonContent(downloadBtn, 'hourglass_top', 'Opening Chrome Web Store...');

        window.open(WEB_CAPTURE_EXTENSION_URL, '_blank', 'noopener');

        updateButtonContent(downloadBtn, 'check_circle', 'Store opened');
        setTimeout(() => {
          downloadBtn.replaceChildren(...originalNodes.map(n => n.cloneNode(true)));
          downloadBtn.disabled = false;
        }, TIMEOUTS.actionFeedback);
      } catch (error) {
        console.error('Store link failed:', error);
        updateButtonContent(downloadBtn, 'error', 'Unable to open store');
        setTimeout(() => {
          downloadBtn.replaceChildren(...originalNodes.map(n => n.cloneNode(true)));
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
    updateButtonContent(downloadBtn, 'store', 'View in Chrome Web Store');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
