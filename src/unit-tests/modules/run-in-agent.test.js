import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAgentOptions, getLastAgent, saveLastAgent, dispatchToAgent } from '../../modules/run-in-agent.js';

// Mock dependencies
vi.mock('../../modules/jules-api.js', () => ({
  callRunJulesFunction: vi.fn()
}));

vi.mock('../../modules/openhands-api.js', () => ({
  callRunOpenHandsFunction: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../modules/firebase-service.js', () => ({
  getAuth: vi.fn()
}));

vi.mock('../../modules/openclaw-keys.js', () => ({
  getOpenclawConfig: vi.fn(),
  decryptOpenclawKey: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  OPENCLAW: {
    BRACE_UI_URL: 'https://brace-ui.fly.dev',
    RELAY_URL: 'https://promptroot-relay.fly.dev'
  },
  AGENT_UI_TEXT: {
    SENT_TO_BRACE: 'Sent to Brace!',
    BRACE_SEND_FAILED: 'Failed to send to Brace: ',
  }
}));

describe('run-in-agent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('open', vi.fn());
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getAgentOptions', () => {
    it('should return Jules, OpenHands, and Brace options', () => {
      const options = getAgentOptions();
      expect(options).toHaveLength(3);
      expect(options[0].value).toBe('jules');
      expect(options[1].value).toBe('openhands');
      expect(options[2].value).toBe('brace');
    });

    it('should always have Brace enabled (not disabled)', () => {
      const options = getAgentOptions();
      expect(options[2].disabled).toBeFalsy();
      expect(options[2].label).toBe('Brace');
    });

    it('should include smart_toy icon for Jules', () => {
      const options = getAgentOptions();
      expect(options[0].icon).toBe('smart_toy');
    });

    it('should include front_hand icon for OpenHands', () => {
      const options = getAgentOptions();
      const oh = options.find(o => o.value === 'openhands');
      expect(oh.icon).toBe('front_hand');
    });

    it('should include hub icon for Brace', () => {
      const options = getAgentOptions();
      expect(options[2].icon).toBe('hub');
    });
  });

  describe('getLastAgent / saveLastAgent', () => {
    it('should return "jules" by default when no storage', () => {
      expect(getLastAgent()).toBe('jules');
    });

    it('should return saved agent value', () => {
      saveLastAgent('brace');
      expect(getLastAgent()).toBe('brace');
    });

    it('should save and retrieve "jules"', () => {
      saveLastAgent('jules');
      expect(getLastAgent()).toBe('jules');
    });
  });

  describe('dispatchToAgent', () => {
    it('should dispatch to Jules via callRunJulesFunction', async () => {
      const { callRunJulesFunction } = await import('../../modules/jules-api.js');
      callRunJulesFunction.mockResolvedValue('https://jules.example.com/session/123');

      const payload = { promptText: 'test', sourceId: 'src', branch: 'main', title: 'Test' };
      const result = await dispatchToAgent('jules', payload);

      expect(callRunJulesFunction).toHaveBeenCalledWith('test', 'src', 'main', 'Test');
      expect(result).toBe('https://jules.example.com/session/123');
    });

    it('should dispatch to OpenHands via callRunOpenHandsFunction', async () => {
      const { callRunOpenHandsFunction } = await import('../../modules/openhands-api.js');
      callRunOpenHandsFunction.mockResolvedValue('http://localhost:3000/conversations/123');

      const payload = { promptText: 'test', sourceId: 'src', branch: 'main', title: 'Test' };
      const result = await dispatchToAgent('openhands', payload);

      expect(callRunOpenHandsFunction).toHaveBeenCalledWith('test', 'src', 'main', 'Test');
      expect(result).toBe('http://localhost:3000/conversations/123');
    });

    describe('brace dispatch — configured with relay', () => {
      beforeEach(async () => {
        const { getAuth } = await import('../../modules/firebase-service.js');
        getAuth.mockReturnValue({ currentUser: { uid: 'user123' } });
        const { getOpenclawConfig, decryptOpenclawKey } = await import('../../modules/openclaw-keys.js');
        getOpenclawConfig.mockResolvedValue({ hasToken: true, useRelay: true, gatewayUrl: null });
        decryptOpenclawKey.mockResolvedValue('pra_testtoken');
      });

      it('should POST to relay /v1/chat/completions with the decrypted token', async () => {
        const controller = { abort: vi.fn(), signal: {} };
        vi.stubGlobal('AbortController', vi.fn(() => controller));
        fetch.mockImplementation(() => new Promise(() => {})); // never resolves (in-flight)

        const payload = { promptText: 'hello world' };
        dispatchToAgent('brace', payload); // don't await — hangs until abort

        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('https://promptroot-relay.fly.dev/v1/chat/completions');
        expect(options.method).toBe('POST');
        expect(options.headers['Authorization']).toBe('Bearer pra_testtoken');
        const body = JSON.parse(options.body);
        expect(body.messages[0].content).toBe('hello world');
        expect(body.model).toBe('brace');
      });

      it('should show SENT_TO_BRACE toast when relay hangs (AbortError = in-flight)', async () => {
        const { showToast } = await import('../../modules/toast.js');
        // Simulate timeout: fetch rejects with AbortError
        const abortErr = new DOMException('aborted', 'AbortError');
        fetch.mockRejectedValue(abortErr);

        await dispatchToAgent('brace', { promptText: 'test' });
        expect(showToast).toHaveBeenCalledWith('Sent to Brace!', 'success');
      });

      it('should reject when relay returns 503 (no brace connected)', async () => {
        fetch.mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({ error: 'No Brace instance connected' }),
        });

        await expect(dispatchToAgent('brace', { promptText: 'test' })).rejects.toThrow(
          'Failed to send to Brace: No Brace instance connected'
        );
      });

      it('should reject when the relay fetch fails outright', async () => {
        fetch.mockRejectedValue(new Error('network down'));

        await expect(dispatchToAgent('brace', { promptText: 'test' })).rejects.toThrow(
          'Failed to send to Brace: network down'
        );
      });

      it('should show SENT_TO_BRACE toast on ok response', async () => {
        const { showToast } = await import('../../modules/toast.js');
        fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

        await dispatchToAgent('brace', { promptText: 'test' });
        expect(showToast).toHaveBeenCalledWith('Sent to Brace!', 'success');
      });

      it('should not open a new browser tab when relay is configured', async () => {
        fetch.mockRejectedValue(new DOMException('aborted', 'AbortError'));
        await dispatchToAgent('brace', { promptText: 'test' });
        expect(window.open).not.toHaveBeenCalled();
      });
    });

    describe('brace dispatch — not configured (fallback)', () => {
      it('should open brace-ui in new tab when not signed in', async () => {
        const { getAuth } = await import('../../modules/firebase-service.js');
        getAuth.mockReturnValue({ currentUser: null });

        await expect(dispatchToAgent('brace', { promptText: 'test' })).rejects.toThrow();
        expect(window.open).toHaveBeenCalledWith(
          'https://brace-ui.fly.dev',
          '_blank',
          'noopener,noreferrer'
        );
      });

      it('should reject with BRACE_NOT_CONFIGURED in fallback path', async () => {
        const { showToast } = await import('../../modules/toast.js');
        const { getAuth } = await import('../../modules/firebase-service.js');
        getAuth.mockReturnValue({ currentUser: null });

        await expect(dispatchToAgent('brace', { promptText: 'test' })).rejects.toMatchObject({
          code: 'BRACE_NOT_CONFIGURED',
        });
        expect(showToast).not.toHaveBeenCalledWith('Sent to Brace!', 'success');
      });
    });

    it('should throw for unknown agent', async () => {
      const payload = { promptText: 'test' };
      await expect(dispatchToAgent('unknown', payload)).rejects.toThrow('Unknown agent: unknown');
    });

    it('should propagate errors from Jules dispatch', async () => {
      const { callRunJulesFunction } = await import('../../modules/jules-api.js');
      callRunJulesFunction.mockRejectedValue(new Error('Jules API error'));

      const payload = { promptText: 'test', sourceId: 'src', branch: 'main', title: 'T' };
      await expect(dispatchToAgent('jules', payload)).rejects.toThrow('Jules API error');
    });
  });
});
