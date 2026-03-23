import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAgentOptions, getLastAgent, saveLastAgent, dispatchToAgent } from '../../modules/run-in-agent.js';

// Mock dependencies
vi.mock('../../modules/openclaw-keys.js', () => ({
  getOpenclawConfig: vi.fn()
}));

vi.mock('../../modules/jules-api.js', () => ({
  callRunJulesFunction: vi.fn()
}));

vi.mock('../../modules/openclaw-api.js', () => ({
  sendToBrace: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  AGENT_UI_TEXT: {
    RUN_IN_AGENT: 'Run in Agent',
    BRACE_NOT_CONFIGURED: 'Brace (not configured)',
    SENT_TO_BRACE: 'Sent to Brace!',
    BRACE_SEND_FAILED: 'Failed to send to Brace: ',
    AGENTIC_QUEUE_EMPTY: 'No items in the Agentic Queue.',
  }
}));

describe('run-in-agent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAgentOptions', () => {
    it('should return Jules enabled and Brace enabled when braceEnabled=true', () => {
      const options = getAgentOptions(true);
      expect(options).toHaveLength(2);
      expect(options[0].value).toBe('jules');
      expect(options[0].disabled).toBeFalsy();
      expect(options[1].value).toBe('brace');
      expect(options[1].disabled).toBeFalsy();
      expect(options[1].label).toBe('Brace');
    });

    it('should return Brace disabled when braceEnabled=false', () => {
      const options = getAgentOptions(false);
      expect(options).toHaveLength(2);
      expect(options[1].value).toBe('brace');
      expect(options[1].disabled).toBe(true);
      expect(options[1].label).toBe('Brace (not configured)');
    });

    it('should always include smart_toy icon for Jules', () => {
      const options = getAgentOptions(true);
      expect(options[0].icon).toBe('smart_toy');
    });

    it('should always include hub icon for Brace', () => {
      const options = getAgentOptions(false);
      expect(options[1].icon).toBe('hub');
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

  describe('isBraceConfigured', () => {
    it('should return true when config exists', async () => {
      const { getOpenclawConfig } = await import('../../modules/openclaw-keys.js');
      getOpenclawConfig.mockResolvedValue({ apiKey: 'test-key' });

      const { isBraceConfigured } = await import('../../modules/run-in-agent.js');
      const result = await isBraceConfigured('user123');
      expect(result).toBe(true);
    });

    it('should return false when config is null', async () => {
      const { getOpenclawConfig } = await import('../../modules/openclaw-keys.js');
      getOpenclawConfig.mockResolvedValue(null);

      const { isBraceConfigured } = await import('../../modules/run-in-agent.js');
      const result = await isBraceConfigured('user123');
      expect(result).toBe(false);
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

    it('should dispatch to Brace via sendToBrace', async () => {
      const { sendToBrace } = await import('../../modules/openclaw-api.js');
      sendToBrace.mockResolvedValue('ok');

      const payload = { promptText: 'test prompt', title: 'Test Title' };
      const result = await dispatchToAgent('brace', payload);

      expect(sendToBrace).toHaveBeenCalledWith('test prompt', 'Test Title');
      expect(result).toBe('ok');
    });

    it('should throw for unknown agent', async () => {
      const payload = { promptText: 'test' };
      await expect(dispatchToAgent('unknown', payload)).rejects.toThrow('Unknown agent: unknown');
    });

    it('should propagate errors from jules dispatch', async () => {
      const { callRunJulesFunction } = await import('../../modules/jules-api.js');
      callRunJulesFunction.mockRejectedValue(new Error('Jules API error'));

      const payload = { promptText: 'test', sourceId: 'src', branch: 'main', title: 'T' };
      await expect(dispatchToAgent('jules', payload)).rejects.toThrow('Jules API error');
    });

    it('should propagate errors from brace dispatch', async () => {
      const { sendToBrace } = await import('../../modules/openclaw-api.js');
      sendToBrace.mockRejectedValue(new Error('Brace API error'));

      const payload = { promptText: 'test', title: 'T' };
      await expect(dispatchToAgent('brace', payload)).rejects.toThrow('Brace API error');
    });
  });
});
