import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: vi.fn((array) => {
    // Fill with predictable values for testing, or just random
    for (let i = 0; i < array.length; i++) {
      array[i] = i % 256;
    }
    return array;
  }),
  subtle: {
    importKey: vi.fn().mockResolvedValue('mock-imported-key'),
    deriveKey: vi.fn().mockResolvedValue('mock-derived-key'),
    encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
    decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('decrypted-api-key').buffer)
  }
};

// Mock window object with required dependencies
const mockAuth = {
  currentUser: null
};

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocDelete = vi.fn();

let mockDb = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: mockDocGet,
      set: mockDocSet,
      delete: mockDocDelete
    }))
  }))
};

// Mock firebase-service
vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; })
}));

// Mock firestore-helpers
vi.mock('../../utils/firestore-helpers.js', () => ({
  getDoc: vi.fn((col, docId, cacheKey) => {
    // Simulate getDoc using the mocked db get
    return mockDb.collection(col).doc(docId).get().then(snap => snap.exists ? snap.data() : null);
  }),
  setDoc: vi.fn((col, docId, data, options, cacheKey) => {
    return mockDb.collection(col).doc(docId).set(data, options);
  }),
  deleteDoc: vi.fn((col, docId, cacheKey) => {
    return mockDb.collection(col).doc(docId).delete();
  }),
  getServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP')
}));

import {
  encryptAndStoreKey,
  checkJulesKey,
  deleteStoredJulesKey,
  getDecryptedJulesKey, // Will be moved here
  clearJulesKeyCache // Will be moved here
} from '../../modules/jules-keys.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

global.window = {
  crypto: mockCrypto,
  auth: mockAuth,
  db: mockDb
};

// Mock TextEncoder/TextDecoder
class MockTextEncoder {
  encode(str) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
  }
}

class MockTextDecoder {
  decode(buffer) {
    return 'decrypted-api-key';
  }
}

global.TextEncoder = MockTextEncoder;
global.TextDecoder = MockTextDecoder;

// Mock atob/btoa
global.atob = vi.fn((str) => {
    // simple base64 decode mock for testing
    // In real implementation this decodes base64 string to binary string
    // Here we just return the input or a mock
    return str;
});
global.btoa = vi.fn((str) => {
    return str;
});

describe('jules-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    if (typeof clearJulesKeyCache === 'function') {
        clearJulesKeyCache();
    }

    // Mock Date.now
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('encryptAndStoreKey', () => {
    it('should encrypt and store key with random IV and salt', async () => {
      const uid = 'test-uid';
      const plaintext = 'my-secret-key';

      await encryptAndStoreKey(plaintext, uid);

      // Verify random values generation
      expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(2); // Salt and IV

      // Verify key derivation
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array), // The password (uid)
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
            name: 'PBKDF2',
            salt: expect.any(Uint8Array),
            iterations: 100000,
            hash: 'SHA-256'
        }),
        'mock-imported-key',
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // Verify encryption
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'AES-GCM', iv: expect.any(Uint8Array) }),
        'mock-derived-key',
        expect.any(Uint8Array) // plaintext
      );

      // Verify storage
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.any(String),
          iv: expect.any(String),
          salt: expect.any(String),
          storedAt: 'SERVER_TIMESTAMP'
        }),
        expect.anything()
      );
    });
  });

  describe('getDecryptedJulesKey', () => {
    const uid = 'test-uid';

    it('should decrypt using new scheme when IV and salt are present', async () => {
      const mockData = {
        key: 'encrypted-key',
        iv: 'mock-iv',
        salt: 'mock-salt'
      };

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => mockData
      });

      // Setup decrypt mock to return specific value
      mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode('decrypted-api-key').buffer);

      const result = await getDecryptedJulesKey(uid);

      expect(result).toBe('decrypted-api-key');

      // Verify derivation used salt
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();

      // Verify decrypt used IV
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'AES-GCM', iv: expect.any(Uint8Array) }),
        'mock-derived-key',
        expect.any(Uint8Array)
      );

      // Verify no migration (re-encryption) happened
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it('should decrypt using legacy scheme and migrate when IV/salt are missing', async () => {
      const mockData = {
        key: 'encrypted-legacy-key'
        // No iv or salt
      };

      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => mockData
      });

      // We need to differentiate legacy decrypt vs new decrypt if possible,
      // or just ensure the flow works.
      // In legacy, we don't use deriveKey (PBKDF2), we use importKey with AES-GCM directly.
      // But we mock importKey to always return 'mock-imported-key'.

      // We can check the arguments to importKey.
      // Legacy: { name: 'AES-GCM' }
      // New: { name: 'PBKDF2' } then deriveKey

      const result = await getDecryptedJulesKey(uid);

      expect(result).toBe('decrypted-api-key');

      // Verify migration happened (encryptAndStoreKey called)
      // This means setDoc was called
      expect(mockDocSet).toHaveBeenCalled();

      // Verify migration uses new scheme
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();
    });

    it('should return null if document does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await getDecryptedJulesKey(uid);
      expect(result).toBeNull();
    });
  });

  describe('checkJulesKey', () => {
    it('should return true if key exists', async () => {
      mockDocGet.mockResolvedValue({ exists: true, data: () => ({ key: 'some-encrypted-key' }) });
      const result = await checkJulesKey('uid');
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockDocGet.mockResolvedValue({ exists: false }); // or null depending on firestore-helpers mock
      // Wait, firestore-helpers getDoc returns data or null.
      // My mock implementation of firestore-helpers returns data or null.

      // Let's adjust mockDocGet to return what firestore native returns
      // And let firestore-helpers mock handle it.

      // firestore-helpers mock:
      // return mockDb.collection(col).doc(docId).get().then(snap => snap.exists ? snap.data() : null);

      // So if snap.exists is false, it returns null.

      mockDocGet.mockResolvedValue({ exists: false });
      const result = await checkJulesKey('uid');
      expect(result).toBe(false);
    });
  });

  describe('deleteStoredJulesKey', () => {
    it('should delete key', async () => {
      mockDocDelete.mockResolvedValue();
      const result = await deleteStoredJulesKey('uid');
      expect(result).toBe(true);
      expect(mockDocDelete).toHaveBeenCalled();
    });
  });
});
