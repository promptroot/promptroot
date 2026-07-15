import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUserCopens,
  addCustomCopen,
  updateCustomCopen,
  deleteCustomCopen,
  toggleDefaultCopen,
  getCustomCopenIcon,
  DEFAULT_COPENS
} from '../../modules/copen-manager.js';

// Mock global firebase
global.firebase = {
  firestore: {
    FieldValue: {
      arrayUnion: vi.fn((val) => `ARRAY_UNION_${JSON.stringify(val)}`),
      arrayRemove: vi.fn((val) => `ARRAY_REMOVE_${val}`)
    }
  }
};

// Mock Firestore
const mockDoc = {
  exists: false,
  data: vi.fn()
};

const mockDocRef = {
  get: vi.fn(() => Promise.resolve(mockDoc)),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve())
};

const mockCollection = {
  doc: vi.fn(() => mockDocRef)
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
  FieldValue: {
    arrayUnion: vi.fn((val) => ({ _arrayUnion: val })),
    arrayRemove: vi.fn((val) => ({ _arrayRemove: val }))
  }
};

vi.mock('../../modules/firebase-service.js', () => ({
  getDb: vi.fn(() => mockDb),
  getFirestore: vi.fn(() => mockDb)
}));

// Setup console mocks
global.console = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};

describe('copen-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.exists = false;
    mockDoc.data.mockReturnValue(null);
  });

  describe('DEFAULT_COPENS', () => {
    it('should export default copens', () => {
      expect(DEFAULT_COPENS).toBeDefined();
      expect(Array.isArray(DEFAULT_COPENS)).toBe(true);
      expect(DEFAULT_COPENS.length).toBeGreaterThan(0);
    });

    it('should have required fields for each default copen', () => {
      DEFAULT_COPENS.forEach(copen => {
        expect(copen).toHaveProperty('id');
        expect(copen).toHaveProperty('label');
        expect(copen).toHaveProperty('icon');
        expect(copen).toHaveProperty('url');
        expect(copen.isDefault).toBe(true);
      });
    });

    it('should include common copens', () => {
      const ids = DEFAULT_COPENS.map(c => c.id);
      expect(ids).toContain('blank');
      expect(ids).toContain('allhands');
      expect(ids).toContain('claude');
      expect(ids).toContain('codex');
      expect(ids).toContain('copilot');
      expect(ids).toContain('qwen');
      expect(ids).toContain('gemini');
      expect(ids).toContain('chatgpt');
    });
  });

  describe('getCustomCopenIcon', () => {
    it('should return the custom copen icon name', () => {
      const icon = getCustomCopenIcon();
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  describe('getUserCopens', () => {
    it('should return default copens when no userId provided', async () => {
      const copens = await getUserCopens(null);
      expect(copens).toEqual(DEFAULT_COPENS);
      expect(mockDb.collection).not.toHaveBeenCalled();
    });

    it('should return default copens when document does not exist', async () => {
      mockDoc.exists = false;
      const copens = await getUserCopens('user123');
      
      expect(mockDb.collection).toHaveBeenCalledWith('userCopens');
      expect(mockCollection.doc).toHaveBeenCalledWith('user123');
      expect(copens).toEqual(DEFAULT_COPENS);
    });

    it('should return merged copens when document exists with custom copens', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [
          { id: 'custom_1', label: 'My AI', url: 'https://myai.com', icon: 'extension', isDefault: false }
        ],
        disabledDefaults: []
      });

      const copens = await getUserCopens('user123');
      
      expect(copens.length).toBe(DEFAULT_COPENS.length + 1);
      expect(copens[copens.length - 1]).toMatchObject({
        id: 'custom_1',
        label: 'My AI',
        url: 'https://myai.com'
      });
    });

    it('should mark disabled default copens', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [],
        disabledDefaults: ['claude', 'gemini']
      });

      const copens = await getUserCopens('user123');
      
      const claude = copens.find(c => c.id === 'claude');
      const gemini = copens.find(c => c.id === 'gemini');
      const codex = copens.find(c => c.id === 'codex');
      
      expect(claude.disabled).toBe(true);
      expect(gemini.disabled).toBe(true);
      expect(codex.disabled).toBe(false);
    });

    it('should return defaults on error', async () => {
      mockDocRef.get.mockRejectedValue(new Error('Firestore error'));
      
      const copens = await getUserCopens('user123');
      
      expect(copens).toEqual(DEFAULT_COPENS);
      expect(console.error).toHaveBeenCalledWith('Error fetching user copens:', expect.any(Error));
    });
  });

  describe('addCustomCopen', () => {
    it('should throw error when userId is missing', async () => {
      await expect(addCustomCopen(null, { label: 'Test', url: 'https://test.com' }))
        .rejects.toThrow('User ID required');
    });

    it('should throw error when label is missing', async () => {
      await expect(addCustomCopen('user123', { url: 'https://test.com' }))
        .rejects.toThrow('Label and URL required');
    });

    it('should throw error when url is missing', async () => {
      await expect(addCustomCopen('user123', { label: 'Test' }))
        .rejects.toThrow('Label and URL required');
    });

    it('should add custom copen with default icon', async () => {
      const copenId = await addCustomCopen('user123', {
        label: 'My AI',
        url: 'https://myai.com'
      });

      expect(copenId).toMatch(/^custom_\d+_[a-f0-9\-]+$/);
      expect(mockDb.collection).toHaveBeenCalledWith('userCopens');
      expect(mockCollection.doc).toHaveBeenCalledWith('user123');
      expect(mockDocRef.set).toHaveBeenCalled();
      expect(global.firebase.firestore.FieldValue.arrayUnion).toHaveBeenCalled();
      expect(mockDocRef.set.mock.calls[0][1]).toEqual({ merge: true });
    });

    it('should add custom copen with custom icon', async () => {
      await addCustomCopen('user123', {
        label: 'My AI',
        url: 'https://myai.com',
        icon: 'star'
      });

      expect(mockDocRef.set).toHaveBeenCalled();
      expect(global.firebase.firestore.FieldValue.arrayUnion).toHaveBeenCalled();
      const callArgs = global.firebase.firestore.FieldValue.arrayUnion.mock.calls[0][0];
      expect(callArgs.icon).toBe('star');
    });

    it('should generate unique IDs for custom copens', async () => {
      const id1 = await addCustomCopen('user123', { label: 'AI 1', url: 'https://ai1.com' });
      vi.clearAllMocks();
      // Wait 1ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      const id2 = await addCustomCopen('user123', { label: 'AI 2', url: 'https://ai2.com' });
      
      expect(id1).not.toBe(id2);
    });

    it('should handle Firestore errors', async () => {
      mockDocRef.set.mockRejectedValue(new Error('Firestore write error'));
      
      await expect(addCustomCopen('user123', { label: 'Test', url: 'https://test.com' }))
        .rejects.toThrow('Firestore write error');
      
      expect(console.error).toHaveBeenCalledWith('Error adding custom copen:', expect.any(Error));
    });
  });

  describe('updateCustomCopen', () => {
    it('should throw error when userId is missing', async () => {
      await expect(updateCustomCopen(null, 'custom_1', { label: 'Updated' }))
        .rejects.toThrow('User ID required');
    });

    it('should do nothing when document does not exist', async () => {
      mockDoc.exists = false;
      mockDocRef.get.mockResolvedValue(mockDoc);
      
      await updateCustomCopen('user123', 'custom_1', { label: 'Updated' });
      
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it('should throw error when copen not found', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: []
      });
      mockDocRef.get.mockResolvedValue(mockDoc);
      
      await expect(updateCustomCopen('user123', 'custom_1', { label: 'Updated' }))
        .rejects.toThrow('Copen not found');
    });

    it('should update custom copen fields', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [
          { id: 'custom_1', label: 'Old Label', url: 'https://old.com', icon: 'extension' }
        ]
      });
      mockDocRef.get.mockResolvedValue(mockDoc);
      mockDocRef.update.mockResolvedValue();
      
      await updateCustomCopen('user123', 'custom_1', { label: 'New Label', url: 'https://new.com' });
      
      expect(mockDocRef.update).toHaveBeenCalledWith({
        customCopens: [
          expect.objectContaining({
            id: 'custom_1',
            label: 'New Label',
            url: 'https://new.com',
            icon: 'extension',
            updatedAt: expect.any(String)
          })
        ]
      });
    });

    it('should handle Firestore errors', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [{ id: 'custom_1', label: 'Test', url: 'https://test.com' }]
      });
      mockDocRef.get.mockResolvedValue(mockDoc);
      mockDocRef.update.mockRejectedValue(new Error('Firestore update error'));
      
      await expect(updateCustomCopen('user123', 'custom_1', { label: 'New' }))
        .rejects.toThrow('Firestore update error');
      
      expect(console.error).toHaveBeenCalledWith('Error updating Copen link:', expect.any(Error));
    });
  });

  describe('deleteCustomCopen', () => {
    it('should throw error when userId is missing', async () => {
      await expect(deleteCustomCopen(null, 'custom_1'))
        .rejects.toThrow('User ID required');
    });

    it('should do nothing when document does not exist', async () => {
      mockDoc.exists = false;
      mockDocRef.get.mockResolvedValue(mockDoc);
      
      await deleteCustomCopen('user123', 'custom_1');
      
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it('should remove custom copen from array', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [
          { id: 'custom_1', label: 'AI 1', url: 'https://ai1.com' },
          { id: 'custom_2', label: 'AI 2', url: 'https://ai2.com' }
        ]
      });
      mockDocRef.get.mockResolvedValue(mockDoc);
      mockDocRef.update.mockResolvedValue();
      
      await deleteCustomCopen('user123', 'custom_1');
      
      expect(mockDocRef.update).toHaveBeenCalledWith({
        customCopens: [
          { id: 'custom_2', label: 'AI 2', url: 'https://ai2.com' }
        ]
      });
    });

    it('should handle deletion of non-existent copen gracefully', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [
          { id: 'custom_1', label: 'AI 1', url: 'https://ai1.com' }
        ]
      });
      mockDocRef.get.mockResolvedValue(mockDoc);
      mockDocRef.update.mockResolvedValue();
      
      await deleteCustomCopen('user123', 'nonexistent');
      
      expect(mockDocRef.update).toHaveBeenCalledWith({
        customCopens: [
          { id: 'custom_1', label: 'AI 1', url: 'https://ai1.com' }
        ]
      });
    });

    it('should handle Firestore errors', async () => {
      mockDoc.exists = true;
      mockDoc.data.mockReturnValue({
        customCopens: [{ id: 'custom_1', label: 'Test', url: 'https://test.com' }]
      });
      mockDocRef.get.mockResolvedValue(mockDoc);
      mockDocRef.update.mockRejectedValue(new Error('Firestore delete error'));
      
      await expect(deleteCustomCopen('user123', 'custom_1'))
        .rejects.toThrow('Firestore delete error');
      
      expect(console.error).toHaveBeenCalledWith('Error deleting copen link:', expect.any(Error));
    });
  });

  describe('toggleDefaultCopen', () => {
    it('should throw error when userId is missing', async () => {
      await expect(toggleDefaultCopen(null, 'claude', false))
        .rejects.toThrow('User ID required');
    });

    it('should remove copen from disabledDefaults when enabling', async () => {
      mockDocRef.set.mockResolvedValue();
      
      await toggleDefaultCopen('user123', 'claude', true);

      expect(mockDocRef.set).toHaveBeenCalled();
      expect(global.firebase.firestore.FieldValue.arrayRemove).toHaveBeenCalledWith('claude');
      expect(mockDocRef.set.mock.calls[0][1]).toEqual({ merge: true });
    });

    it('should add copen to disabledDefaults when disabling', async () => {
      mockDocRef.set.mockResolvedValue();
      
      await toggleDefaultCopen('user123', 'claude', false);

      expect(mockDocRef.set).toHaveBeenCalled();
      expect(global.firebase.firestore.FieldValue.arrayUnion).toHaveBeenCalledWith('claude');
      expect(mockDocRef.set.mock.calls[0][1]).toEqual({ merge: true });
    });

    it('should handle Firestore errors', async () => {
      mockDocRef.set.mockRejectedValue(new Error('Firestore toggle error'));
      
      await expect(toggleDefaultCopen('user123', 'claude', false))
        .rejects.toThrow('Firestore toggle error');
      
      expect(console.error).toHaveBeenCalledWith('Error toggling default copen:', expect.any(Error));
    });
  });
});
