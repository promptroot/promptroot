// Global test setup - runs before all tests

import { vi } from 'vitest';

// Mock Firebase globally (all tests need this)
global.window = global.window || {};
global.window.firebase = {
  auth: {
    GithubAuthProvider: class {
      addScope() {}
    }
  },
  firestore: {
    FieldValue: {
      serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
      delete: vi.fn(() => 'DELETE_FIELD'),
      increment: vi.fn((value) => `INCREMENT_${value}`),
      arrayUnion: vi.fn((...values) => `ARRAY_UNION_${values.join(',')}`),
      arrayRemove: vi.fn((...values) => `ARRAY_REMOVE_${values.join(',')}`)
    }
  }
};

global.window.auth = {
  currentUser: null,
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
};

global.window.db = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      collection: vi.fn(),
    })),
  })),
};

// Mock console.warn for tests that check for it
global.console.warn = vi.fn();

// Mock localStorage and sessionStorage more realistically
const createStorageMock = () => {
  let store = {};
  const mock = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((index) => Object.keys(store)[index] || null),
  };

  Object.defineProperty(mock, 'length', {
    get: () => Object.keys(store).length,
    configurable: true
  });

  return mock;
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

// Define on both global and window to ensure consistency
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true
});

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  configurable: true,
  writable: true
});

if (global.window) {
  Object.defineProperty(global.window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true
  });

  Object.defineProperty(global.window, 'sessionStorage', {
    value: sessionStorageMock,
    configurable: true,
    writable: true
  });
}
