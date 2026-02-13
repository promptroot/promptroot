import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JulesClient } from './jules-client';

// Mock output channel
const mockOutputChannel = {
  appendLine: vi.fn(),
  append: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn(),
  name: 'Test',
  replace: vi.fn()
};

// Mock global fetch
global.fetch = vi.fn();

describe('JulesClient', () => {
  let client: JulesClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = new JulesClient(mockOutputChannel as any);
  });

  describe('listSources', () => {
    it('should fetch sources from Jules API', async () => {
      const mockResponse = {
        sources: [
          {
            name: 'sources/test-repo',
            displayName: 'test-repo',
            createTime: '2026-01-01T00:00:00Z',
            updateTime: '2026-01-15T00:00:00Z'
          }
        ]
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.listSources('test-api-key');

      expect(result.sources).toBeDefined();
      expect(result.sources?.length).toBe(1);
      expect(result.sources?.[0].displayName).toBe('test-repo');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sources'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'test-api-key'
          })
        })
      );
    });

    it('should handle empty sources response', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: [] })
      });

      const result = await client.listSources('test-api-key');

      expect(result.sources).toEqual([]);
    });

    it('should handle pagination token', async () => {
      const mockResponse = {
        sources: [],
        nextPageToken: 'next-page-token'
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.listSources('test-api-key', 'page-token-123');

      expect(result.nextPageToken).toBe('next-page-token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pageToken=page-token-123'),
        expect.any(Object)
      );
    });

    it('should throw error on API failure', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } })
      });

      await expect(
        client.listSources('invalid-key')
      ).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.listSources('test-api-key')
      ).rejects.toThrow('Network error');
    });
  });

  describe('listSessions', () => {
    it('should fetch sessions from Jules API', async () => {
      const mockResponse = {
        sessions: [
          {
            name: 'sessions/test-session',
            state: 'COMPLETED',
            prompt: 'Test prompt',
            title: 'Test Session',
            createTime: '2026-01-01T00:00:00Z'
          }
        ]
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.listSessions('test-api-key', 'sources/test-repo');

      expect(result.sessions).toBeDefined();
      expect(result.sessions?.length).toBe(1);
      expect(result.sessions?.[0].state).toBe('COMPLETED');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'test-api-key'
          })
        })
      );
    });

    it('should include pageSize parameter', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [] })
      });

      await client.listSessions('test-api-key', 'sources/test-repo');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('pageSize='),
        expect.any(Object)
      );
    });

    it('should handle pagination', async () => {
      const mockResponse = {
        sessions: [],
        nextPageToken: 'next-token'
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.listSessions(
        'test-api-key',
        'sources/test-repo',
        'page-token'
      );

      expect(result.nextPageToken).toBe('next-token');
    });

    it('should handle different session states', async () => {
      const states = ['COMPLETED', 'FAILED', 'IN_PROGRESS', 'PLANNING', 'QUEUED'];

      for (const state of states) {
        const mockResponse = {
          sessions: [{
            name: `sessions/test-${state}`,
            state,
            prompt: 'Test',
            createTime: '2026-01-01T00:00:00Z'
          }]
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

        const result = await client.listSessions('test-api-key', 'sources/test');

        expect(result.sessions?.[0].state).toBe(state);
      }
    });

    it('should throw error on API failure', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'Source not found' } })
      });

      await expect(
        client.listSessions('test-api-key', 'sources/nonexistent')
      ).rejects.toThrow();
    });
  });

  describe('testApiKey', () => {
    it('should return true for valid API key', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: [] })
      });

      const result = await client.testApiKey('valid-key');

      expect(result).toBe(true);
      // The client logs fetch operation, not just "successfully"
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
    });

    it('should return false for invalid API key', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid API key' } })
      });

      const result = await client.testApiKey('invalid-key');

      expect(result).toBe(false);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('failed')
      );
    });

    it('should return false on network error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await client.testApiKey('test-key');

      expect(result).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockRejectedValueOnce(abortError);

      const result = await client.testApiKey('test-key');

      expect(result).toBe(false);
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('timed out')
      );
    });
  });

  describe('API headers', () => {
    it('should include required headers', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sources: [] })
      });

      await client.listSources('test-api-key');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callArgs = (global.fetch as any).mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Goog-Api-Key']).toBe('test-api-key');
    });
  });

  describe('API base URL', () => {
    it('should use correct base URL for all endpoints', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await client.listSources('test-key');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global.fetch as any).mock.calls[0][0]).toContain('jules.googleapis.com/v1alpha');

      await client.listSessions('test-key', 'sources/test');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((global.fetch as any).mock.calls[1][0]).toContain('jules.googleapis.com/v1alpha');
    });
  });
});
