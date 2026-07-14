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

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(function() { return global.window?.auth !== undefined ? global.window.auth : mockAuth; }),
  getDb: vi.fn(function() { return global.window?.db !== undefined ? global.window.db : mockDb; })
}));

vi.mock('../../utils/firestore-helpers.js', () => ({
  getDoc: vi.fn((col, docId, cacheKey) => {
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
  encryptAndStoreOpencodeKey,
  checkOpencodeKey,
  deleteStoredOpencodeKey,
  getOpencodeConfig,
  decryptOpencodeKey
} from '../../modules/opencode-keys.js';

global.window = {
  crypto: mockCrypto,
  auth: mockAuth,
  db: mockDb
};

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

global.atob = vi.fn((str) => str);
global.btoa = vi.fn((str) => str);

describe('opencode-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkOpencodeKey', () => {
    it('returns false if db is not available', async () => {
      global.window.db = null;
      const result = await checkOpencodeKey('uid123');
      expect(result).toBe(false);
      global.window.db = mockDb;
    });

    it('returns true if doc has gatewayUrl or key', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ gatewayUrl: 'http://localhost:4096' })
      });
      const result = await checkOpencodeKey('uid123');
      expect(result).toBe(true);
    });

    it('returns false if doc does not exist', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: false
      });
      const result = await checkOpencodeKey('uid123');
      expect(result).toBe(false);
    });
  });

  describe('getOpencodeConfig', () => {
    it('returns config data', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ gatewayUrl: 'http://localhost:4096', key: 'encrypted-key' })
      });
      const result = await getOpencodeConfig('uid123');
      expect(result).toEqual({
        gatewayUrl: 'http://localhost:4096',
        hasToken: true
      });
    });
  });

  describe('encryptAndStoreOpencodeKey', () => {
    it('saves raw details when no token is provided', async () => {
      mockDocSet.mockResolvedValueOnce(true);
      const result = await encryptAndStoreOpencodeKey(null, 'uid123', { gatewayUrl: 'http://localhost:4096' });
      expect(result).toBe(true);
      expect(mockDocSet).toHaveBeenCalledWith({
        gatewayUrl: 'http://localhost:4096',
        key: null,
        iv: null,
        salt: null,
        storedAt: 'SERVER_TIMESTAMP'
      }, { merge: true });
    });
  });

  describe('deleteStoredOpencodeKey', () => {
    it('deletes document', async () => {
      mockDocDelete.mockResolvedValueOnce(true);
      const result = await deleteStoredOpencodeKey('uid123');
      expect(result).toBe(true);
    });
  });
});
