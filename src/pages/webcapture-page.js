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

function setButtonState(button, iconName, text) {
  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon icon-inline';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = iconName;
  const textNode = document.createTextNode(text.startsWith(' ') ? text : ' ' + text);
  button.replaceChildren(iconSpan, textNode);
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
      // Cache original content to restore it later
      const originalNodes = Array.from(downloadBtn.childNodes).map(node => node.cloneNode(true));

      try {
        downloadBtn.disabled = true;
        setButtonState(downloadBtn, 'hourglass_top', 'Opening Chrome Web Store...');

        window.open(WEB_CAPTURE_EXTENSION_URL, '_blank', 'noopener');

        setButtonState(downloadBtn, 'check_circle', 'Store opened');
        setTimeout(() => {
          downloadBtn.replaceChildren(...originalNodes.map(n => n.cloneNode(true)));
          downloadBtn.disabled = false;
        }, TIMEOUTS.actionFeedback);
      } catch (error) {
        console.error('Store link failed:', error);
        setButtonState(downloadBtn, 'error', 'Unable to open store');
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
    setButtonState(downloadBtn, 'store', 'View in Chrome Web Store');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
