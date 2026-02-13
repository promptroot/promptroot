// ===== Common DOM Helpers =====

import { TIMEOUTS, LIMITS } from './constants.js';

export function createElement(tag, className = '', textContent = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

export function createIcon(iconName, classes = [], ariaHidden = true) {
  const span = document.createElement('span');
  span.className = 'icon';
  if (Array.isArray(classes)) {
    classes.forEach(c => span.classList.add(c));
  } else if (typeof classes === 'string' && classes) {
    span.classList.add(classes);
  }
  span.textContent = iconName;
  if (ariaHidden) span.setAttribute('aria-hidden', 'true');
  return span;
}

export function toggleVisibility(element, shouldShow = true) {
  if (!element) return;
  element.classList.toggle('hidden', !shouldShow);
  // Clean up any inline styles that might conflict
  element.style.display = '';
}

export function toggleClass(el, className, force) {
  if (force === undefined) {
    el.classList.toggle(className);
  } else {
    el.classList.toggle(className, force);
  }
}

export function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function waitForDOMReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

export function waitForHeader(callback) {
  let attempts = 0;
  const check = () => {
    if (document.querySelector('header')) {
      callback();
    } else if (attempts < LIMITS.componentMaxAttempts) {
      attempts++;
      setTimeout(check, TIMEOUTS.componentCheck);
    } else {
      console.error('Header not found after waiting');
    }
  };
  check();
}
