import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCopenOptions,
  clearCopenOptionsCache,
  COPEN_OPTIONS_STATIC,
  COPEN_OPTIONS,
  COPEN_STORAGE_KEY,
  COPEN_DEFAULT_LABEL,
  COPEN_DEFAULT_ICON
} from '../../utils/copen-config.js';

// Mock dependencies
vi.mock('../../modules/copen-manager.js', () => ({
  getUserCopens: vi.fn()
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn()
}));

describe('copen-config', () => {
  let mockGetUserCopens;
  let mockGetAuth;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    clearCopenOptionsCache(); // Clear cache before each test
    const copenManager = await import('../../modules/copen-manager.js');
    const firebaseService = await import('../../modules/firebase-service.js');
    mockGetUserCopens = copenManager.getUserCopens;
    mockGetAuth = firebaseService.getAuth;
  });

  describe('constants', () => {
    it('should export COPEN_OPTIONS_STATIC', () => {
      expect(COPEN_OPTIONS_STATIC).toBeDefined();
      expect(Array.isArray(COPEN_OPTIONS_STATIC)).toBe(true);
      expect(COPEN_OPTIONS_STATIC.length).toBeGreaterThan(0);
    });

    it('should have required fields in COPEN_OPTIONS_STATIC', () => {
      COPEN_OPTIONS_STATIC.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('icon');
      });
    });

    it('should export COPEN_OPTIONS for backward compatibility', () => {
      expect(COPEN_OPTIONS).toBe(COPEN_OPTIONS_STATIC);
    });

    it('should export COPEN_STORAGE_KEY', () => {
      expect(typeof COPEN_STORAGE_KEY).toBe('string');
      expect(COPEN_STORAGE_KEY.length).toBeGreaterThan(0);
    });

    it('should export COPEN_DEFAULT_LABEL', () => {
      expect(typeof COPEN_DEFAULT_LABEL).toBe('string');
      expect(COPEN_DEFAULT_LABEL.length).toBeGreaterThan(0);
    });

    it('should export COPEN_DEFAULT_ICON', () => {
      expect(typeof COPEN_DEFAULT_ICON).toBe('string');
      expect(COPEN_DEFAULT_ICON.length).toBeGreaterThan(0);
    });
  });

  describe('getCopenOptions', () => {
    it('should return options when no user is signed in', async () => {
      mockGetAuth.mockReturnValue({ currentUser: null });
      mockGetUserCopens.mockResolvedValue([
        { id: 'blank', label: 'Blank', icon: 'public', isDefault: true },
        { id: 'claude', label: 'Claude', icon: 'smart_toy', isDefault: true }
      ]);

      const options = await getCopenOptions();

      expect(mockGetUserCopens).toHaveBeenCalledWith(undefined);
      expect(options).toEqual([
        { value: 'blank', label: 'Blank', icon: 'public' },
        { value: 'claude', label: 'Claude', icon: 'smart_toy' }
      ]);
    });

    it('should return options for signed in user', async () => {
      mockGetAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
      mockGetUserCopens.mockResolvedValue([
        { id: 'blank', label: 'Blank', icon: 'public', isDefault: true },
        { id: 'claude', label: 'Claude', icon: 'smart_toy', isDefault: true },
        { id: 'custom_1', label: 'My AI', icon: 'extension', isDefault: false }
      ]);

      const options = await getCopenOptions();

      expect(mockGetUserCopens).toHaveBeenCalledWith('user123');
      expect(options).toEqual([
        { value: 'blank', label: 'Blank', icon: 'public' },
        { value: 'claude', label: 'Claude', icon: 'smart_toy' },
        { value: 'custom_1', label: 'My AI', icon: 'extension' }
      ]);
    });

    it('should filter out disabled copens', async () => {
      mockGetAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
      mockGetUserCopens.mockResolvedValue([
        { id: 'blank', label: 'Blank', icon: 'public', isDefault: true },
        { id: 'claude', label: 'Claude', icon: 'smart_toy', isDefault: true, disabled: true },
        { id: 'custom_1', label: 'My AI', icon: 'extension', isDefault: false }
      ]);

      const options = await getCopenOptions();

      expect(options).toEqual([
        { value: 'blank', label: 'Blank', icon: 'public' },
        { value: 'custom_1', label: 'My AI', icon: 'extension' }
      ]);
      expect(options.find(o => o.value === 'claude')).toBeUndefined();
    });

    it('should handle auth being undefined', async () => {
      mockGetAuth.mockReturnValue(undefined);
      mockGetUserCopens.mockResolvedValue([
        { id: 'blank', label: 'Blank', icon: 'public', isDefault: true }
      ]);

      const options = await getCopenOptions();

      expect(mockGetUserCopens).toHaveBeenCalledWith(undefined);
      expect(options).toEqual([
        { value: 'blank', label: 'Blank', icon: 'public' }
      ]);
    });

    it('should handle auth being null', async () => {
      mockGetAuth.mockReturnValue(null);
      mockGetUserCopens.mockResolvedValue([
        { id: 'blank', label: 'Blank', icon: 'public', isDefault: true }
      ]);

      const options = await getCopenOptions();

      expect(mockGetUserCopens).toHaveBeenCalledWith(undefined);
      expect(options).toEqual([
        { value: 'blank', label: 'Blank', icon: 'public' }
      ]);
    });

    it('should transform copen IDs to option values', async () => {
      mockGetAuth.mockReturnValue({ currentUser: null });
      mockGetUserCopens.mockResolvedValue([
        { id: 'some_id', label: 'Some Label', icon: 'some_icon', isDefault: true }
      ]);

      const options = await getCopenOptions();

      expect(options[0]).toEqual({
        value: 'some_id',
        label: 'Some Label',
        icon: 'some_icon'
      });
    });

    it('should return empty array if getUserCopens returns empty', async () => {
      mockGetAuth.mockReturnValue({ currentUser: null });
      mockGetUserCopens.mockResolvedValue([]);

      const options = await getCopenOptions();

      expect(options).toEqual([]);
    });

    it('should include all non-disabled copens regardless of isDefault flag', async () => {
      mockGetAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
      mockGetUserCopens.mockResolvedValue([
        { id: 'default1', label: 'Default 1', icon: 'icon1', isDefault: true },
        { id: 'custom1', label: 'Custom 1', icon: 'icon2', isDefault: false },
        { id: 'default2', label: 'Default 2', icon: 'icon3', isDefault: true, disabled: true }
      ]);

      const options = await getCopenOptions();

      expect(options.length).toBe(2);
      expect(options.find(o => o.value === 'default1')).toBeDefined();
      expect(options.find(o => o.value === 'custom1')).toBeDefined();
      expect(options.find(o => o.value === 'default2')).toBeUndefined();
    });
  });

  describe('clearCopenOptionsCache', () => {
    it('should clear the cache and force a refetch on next call', async () => {
      mockGetAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
      mockGetUserCopens.mockResolvedValue([
        { id: 'blank', label: 'Blank', icon: 'public', isDefault: true }
      ]);

      // Call once to populate cache
      await getCopenOptions();
      expect(mockGetUserCopens).toHaveBeenCalledTimes(1);

      // Call again to verify cache is used (should not call getUserCopens again)
      await getCopenOptions();
      expect(mockGetUserCopens).toHaveBeenCalledTimes(1);

      // Clear the cache
      clearCopenOptionsCache();

      // Call again to verify cache is cleared (should call getUserCopens again)
      await getCopenOptions();
      expect(mockGetUserCopens).toHaveBeenCalledTimes(2);
    });
  });
});
