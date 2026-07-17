import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Web Crypto API
const mockCrypto = {
  getRandomValues: vi.fn((array) => {
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

const mockAuth = {
  currentUser: null
};

const mockDocGet = vi.fn();
const mockDocSet = vi.fn();

let mockDb = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: mockDocGet,
      set: mockDocSet
    }))
  }))
};

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(() => mockAuth),
  getDb: vi.fn(() => mockDb)
}));

vi.mock('../../utils/firestore-helpers.js', () => ({
  getDoc: vi.fn((col, docId, cacheKey) => {
    return mockDb.collection(col).doc(docId).get().then(snap => snap.exists ? snap.data() : null);
  }),
  setDoc: vi.fn((col, docId, data, options, cacheKey) => {
    return mockDb.collection(col).doc(docId).set(data, options);
  }),
  getServerTimestamp: vi.fn(() => 'SERVER_TIMESTAMP')
}));

import {
  encryptAndStoreOpenHandsConfig,
  checkOpenHandsConfig,
  deleteStoredOpenHandsConfig,
  getDecryptedOpenHandsConfig,
  clearOpenHandsKeyCache
} from '../../modules/openhands-keys.js';

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

global.atob = vi.fn(str => str);
global.btoa = vi.fn(str => str);

describe('openhands-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    clearOpenHandsKeyCache();
  });

  describe('encryptAndStoreOpenHandsConfig', () => {
    it('should encrypt and store config under users collection', async () => {
      const uid = 'test-uid';
      const baseUrl = 'http://localhost:3000';
      const apiKey = 'my-secret-key';

      await encryptAndStoreOpenHandsConfig(baseUrl, apiKey, uid);

      expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(2); // Salt and IV
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          openhandsConfig: expect.objectContaining({
            baseUrl: 'http://localhost:3000',
            key: expect.any(String),
            iv: expect.any(String),
            salt: expect.any(String),
            storedAt: 'SERVER_TIMESTAMP'
          })
        }),
        { merge: true }
      );
    });

    it('should store only baseUrl if apiKey is empty', async () => {
      const uid = 'test-uid';
      const baseUrl = 'http://localhost:3000';

      await encryptAndStoreOpenHandsConfig(baseUrl, '', uid);

      expect(mockCrypto.getRandomValues).not.toHaveBeenCalled();
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          openhandsConfig: {
            baseUrl: 'http://localhost:3000',
            key: null,
            iv: null,
            salt: null,
            storedAt: 'SERVER_TIMESTAMP'
          }
        }),
        { merge: true }
      );
    });
  });

  describe('checkOpenHandsConfig', () => {
    it('should return true if openhandsConfig and baseUrl exist', async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          openhandsConfig: { baseUrl: 'http://localhost:3000' }
        })
      });

      const result = await checkOpenHandsConfig('uid');
      expect(result).toBe(true);
    });

    it('should return false if doc or openhandsConfig is missing', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const result = await checkOpenHandsConfig('uid');
      expect(result).toBe(false);
    });
  });

  describe('getDecryptedOpenHandsConfig', () => {
    it('should decrypt API key if present', async () => {
      const uid = 'test-uid';
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          openhandsConfig: {
            baseUrl: 'http://localhost:3000',
            key: 'encrypted-key',
            iv: 'mock-iv',
            salt: 'mock-salt'
          }
        })
      });

      const config = await getDecryptedOpenHandsConfig(uid);
      expect(config).toEqual({
        baseUrl: 'http://localhost:3000',
        apiKey: 'decrypted-api-key'
      });
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should return null apiKey if not encrypted', async () => {
      const uid = 'test-uid';
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          openhandsConfig: {
            baseUrl: 'http://localhost:3000',
            key: null
          }
        })
      });

      const config = await getDecryptedOpenHandsConfig(uid);
      expect(config).toEqual({
        baseUrl: 'http://localhost:3000',
        apiKey: null
      });
    });
  });
});
