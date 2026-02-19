import { waitForDOMReady, waitForHeader } from '../src/utils/dom-helpers.js';

// Mocks
const listeners = {};
global.document = {
  readyState: 'loading',
  addEventListener: (event, callback) => {
    listeners[event] = callback;
  },
  querySelector: () => null,
};

global.setTimeout = (callback, delay) => {
  callback();
};

const originalConsoleError = console.error;
let consoleErrors = [];
console.error = (...args) => {
  consoleErrors.push(args);
};

// Test waitForDOMReady
console.log('Testing waitForDOMReady...');

// Case 1: loading
let readyCalled = false;
waitForDOMReady(() => { readyCalled = true; });
if (readyCalled) throw new Error('waitForDOMReady called callback immediately when loading');
if (!listeners['DOMContentLoaded']) throw new Error('waitForDOMReady did not add listener');
listeners['DOMContentLoaded']();
if (!readyCalled) throw new Error('waitForDOMReady did not call callback on DOMContentLoaded');

// Case 2: complete
document.readyState = 'complete';
readyCalled = false;
waitForDOMReady(() => { readyCalled = true; });
if (!readyCalled) throw new Error('waitForDOMReady did not call callback immediately when complete');

console.log('waitForDOMReady passed.');

// Test waitForHeader
console.log('Testing waitForHeader...');

// Case 1: header exists immediately
document.querySelector = (selector) => selector === 'header' ? {} : null;
let headerCalled = false;
waitForHeader(() => { headerCalled = true; });
if (!headerCalled) throw new Error('waitForHeader did not call callback immediately when header exists');

// Case 2: header exists after retry
document.querySelector = () => null;
let attempts = 0;
// Mock setTimeout to just run immediately but count
global.setTimeout = (callback, delay) => {
  attempts++;
  if (attempts === 5) {
     document.querySelector = (selector) => selector === 'header' ? {} : null;
  }
  callback();
};

headerCalled = false;
waitForHeader(() => { headerCalled = true; });
if (!headerCalled) throw new Error('waitForHeader did not call callback after retries');

// Case 3: header never exists
document.querySelector = () => null;
attempts = 0;
consoleErrors = [];
headerCalled = false;
global.setTimeout = (callback, delay) => {
    attempts++;
    if (attempts > 200) return;
    callback();
};

waitForHeader(() => { headerCalled = true; });

if (headerCalled) throw new Error('waitForHeader called callback when header never found');
if (consoleErrors.length === 0) throw new Error('waitForHeader did not log error when header never found');

console.log('waitForHeader passed.');
console.log('All tests passed!');

console.error = originalConsoleError;
