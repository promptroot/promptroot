import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearPromptViewerHandlers, registerPromptViewerHandler } from '../../../src/modules/jules-queue-store.js';
import * as handlerRegistry from '../../../src/utils/handler-registry.js';

vi.mock('../../../src/utils/handler-registry.js', () => ({
  clearHandlers: vi.fn(),
  registerHandler: vi.fn()
}));

describe('jules-queue-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clearPromptViewerHandlers', () => {
    it('should call clearHandlers with "queueViewer"', () => {
      clearPromptViewerHandlers();
      expect(handlerRegistry.clearHandlers).toHaveBeenCalledWith('queueViewer');
      expect(handlerRegistry.clearHandlers).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerPromptViewerHandler', () => {
    it('should call registerHandler with "queueViewer", key, and handler', () => {
      const mockKey = 'testKey';
      const mockHandler = vi.fn();

      registerPromptViewerHandler(mockKey, mockHandler);

      expect(handlerRegistry.registerHandler).toHaveBeenCalledWith('queueViewer', mockKey, mockHandler);
      expect(handlerRegistry.registerHandler).toHaveBeenCalledTimes(1);
    });
  });
});
