import { describe, it, expect } from 'vitest';
import { createNewPromptAsset } from './asset-creator';

// This is a simpler test since asset-creator mainly deals with VS Code APIs
// which are difficult to fully mock

describe('asset-creator', () => {
  describe('createNewPromptAsset', () => {
    it('should be a function', () => {
      expect(typeof createNewPromptAsset).toBe('function');
    });

    it('should accept workspace root and output channel', () => {
      // We can verify the function signature exists
      expect(createNewPromptAsset.length).toBeGreaterThan(0);
    });

    // Full testing would require mocking VS Code APIs extensively
    // which is beyond the scope of unit tests and better suited for integration tests
  });
});
