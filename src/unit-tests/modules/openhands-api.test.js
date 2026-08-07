import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockAuth = {
  currentUser: { uid: 'test-uid' }
};

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn(() => mockAuth)
}));

vi.mock('../../modules/openhands-keys.js', () => {
  const mockConfig = {
    baseUrl: 'http://localhost:3000',
    apiKey: 'test-api-key'
  };
  return {
    getDecryptedOpenHandsConfig: vi.fn().mockResolvedValue(mockConfig),
    checkOpenHandsConfig: vi.fn().mockResolvedValue(true)
  };
});

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  createAppConversation,
  listAppConversations,
  listSandboxes,
  pauseSandbox,
  resumeSandbox,
  listSandboxSpecs,
  loadOpenHandsProfileInfo,
  callRunOpenHandsFunction
} from '../../modules/openhands-api.js';

describe('openhands-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = { uid: 'test-uid' };
  });

  describe('listAppConversations', () => {
    it('should query /api/v1/app-conversations and return conversations list', async () => {
      const mockResult = { conversations: [{ id: '1', title: 'task' }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const result = await listAppConversations();
      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/app-conversations/search?limit=100',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });
  });

  describe('createAppConversation', () => {
    it('should send POST request to /api/v1/app-conversations', async () => {
      const mockResult = { id: 'conv-123' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const result = await createAppConversation('test prompt', 'owner/repo', 'main');
      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/app-conversations',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            initial_message: {
              content: [{ type: 'text', text: 'test prompt' }]
            },
            selected_repository: 'owner/repo',
            selected_branch: 'main'
          })
        })
      );
    });
  });

  describe('listSandboxes', () => {
    it('should query /api/v1/sandboxes/search', async () => {
      const mockResult = { sandboxes: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const result = await listSandboxes();
      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/sandboxes/search',
        expect.any(Object)
      );
    });
  });

  describe('pauseSandbox', () => {
    it('should send POST request to /api/v1/sandboxes/:id/pause', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'paused' })
      });

      const result = await pauseSandbox('sb-123');
      expect(result).toEqual({ status: 'paused' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/sandboxes/sb-123/pause',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('resumeSandbox', () => {
    it('should send POST request to /api/v1/sandboxes/:id/resume', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'running' })
      });

      const result = await resumeSandbox('sb-123');
      expect(result).toEqual({ status: 'running' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/sandboxes/sb-123/resume',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('loadOpenHandsProfileInfo', () => {
    it('should query conversations, sandboxes, and specs in parallel', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [{ id: 'c1' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sandboxes: [{ id: 's1' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sandbox_specs: [{ id: 'spec1' }] })
        });

      const result = await loadOpenHandsProfileInfo();
      expect(result).toEqual({
        conversations: [{ id: 'c1' }],
        sandboxes: [{ id: 's1' }],
        sandboxSpecs: [{ id: 'spec1' }],
        error: null
      });
    });

    it('should capture the first error if a call fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sandboxes: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sandbox_specs: [] })
        });

      const result = await loadOpenHandsProfileInfo();
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('Network connection failed');
      expect(result.conversations).toEqual([]);
    });

    it('should parse items property fallback correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 'c2' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 's2' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ items: [{ id: 'spec2' }] })
        });

      const result = await loadOpenHandsProfileInfo();
      expect(result).toEqual({
        conversations: [{ id: 'c2' }],
        sandboxes: [{ id: 's2' }],
        sandboxSpecs: [{ id: 'spec2' }],
        error: null
      });
    });
  });

  describe('callRunOpenHandsFunction', () => {
    it('should create conversation and return Web UI URL', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-conv-456' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [{ id: 'new-conv-456' }] })
        });

      const url = await callRunOpenHandsFunction('help me fix this', 'sources/github/owner/repo');
      expect(url).toBe('http://localhost:3000/conversation/new-conv-456');
    });

    it('should return direct URL if provided in API response', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'conv-789', url: 'https://app.all-hands.dev/conversation/direct-link-123' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [{ id: 'conv-789' }] })
        });

      const url = await callRunOpenHandsFunction('help me fix this', 'sources/github/owner/repo');
      expect(url).toBe('https://app.all-hands.dev/conversation/direct-link-123');
    });

    it('should construct workspace-scoped URL if workspace_id is provided', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'conv-999', workspace_id: 'ws-abc' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ conversations: [{ id: 'conv-999' }] })
        });

      const url = await callRunOpenHandsFunction('help me fix this', 'sources/github/owner/repo');
      expect(url).toBe('http://localhost:3000/workspaces/ws-abc/conversation/conv-999');
    });
  });
});
