import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createJulesSession } from '../../modules/jules-api.js';

describe('Jules API Module', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('createJulesSession', () => {
        it('should create a session', async () => {
            const mockResponse = { name: 'sessions/123' };
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const config = {
                prompt: 'Test prompt',
                title: 'Test Session',
                sourceId: 'source1',
                branch: 'main'
            };

            const result = await createJulesSession('apiKey', config);

            expect(result).toEqual(mockResponse);
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/sessions'), expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-Goog-Api-Key': 'apiKey'
                }),
                body: expect.stringContaining('"prompt":"Test prompt"')
            }));
        });

        it('should throw error on failure', async () => {
             global.fetch.mockResolvedValue({
                ok: false,
                status: 400,
                statusText: 'Bad Request'
            });

             const config = {
                prompt: 'Test prompt',
                sourceId: 'source1'
            };

            await expect(createJulesSession('apiKey', config)).rejects.toThrow('Failed to create session: 400 Bad Request');
        });
    });
});
