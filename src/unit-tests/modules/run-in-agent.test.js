import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAgentOptions, getLastAgent, saveLastAgent, dispatchToAgent } from '../../modules/run-in-agent.js';

// Mock dependencies
vi.mock('../../modules/jules-api.js', () => ({
  callRunJulesFunction: vi.fn()
}));

vi.mock('../../modules/toast.js', () => ({
  showToast: vi.fn()
}));

vi.mock('../../utils/constants.js', () => ({
  OPENCLAW: {
    BRACE_UI_URL: 'https://brace-ui.fly.dev'
  },
  AGENT_UI_TEXT: {
    SENT_TO_BRACE: 'Sent to Brace!',
  }
}));

describe('run-in-agent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Mock window.open
    vi.stubGlobal('open', vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getAgentOptions', () => {
    it('should return Jules and Brace options', () => {
      const options = getAgentOptions();
      expect(options).toHaveLength(2);
      expect(options[0].value).toBe('jules');
      expect(options[1].value).toBe('brace');
    });

    it('should always have Brace enabled (not disabled)', () => {
      const options = getAgentOptions();
      expect(options[1].disabled).toBeFalsy();
      expect(options[1].label).toBe('Brace');
    });

    it('should include smart_toy icon for Jules', () => {
      const options = getAgentOptions();
      expect(options[0].icon).toBe('smart_toy');
    });

    it('should include hub icon for Brace', () => {
      const options = getAgentOptions();
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

  describe('dispatchToAgent', () => {
    it('should dispatch to Jules via callRunJulesFunction', async () => {
      const { callRunJulesFunction } = await import('../../modules/jules-api.js');
      callRunJulesFunction.mockResolvedValue('https://jules.example.com/session/123');

      const payload = { promptText: 'test', sourceId: 'src', branch: 'main', title: 'Test' };
      const result = await dispatchToAgent('jules', payload);

      expect(callRunJulesFunction).toHaveBeenCalledWith('test', 'src', 'main', 'Test');
      expect(result).toBe('https://jules.example.com/session/123');
    });

    it('should open Brace URL in new tab', async () => {
      const payload = { promptText: 'hello world', title: 'Test' };
      await dispatchToAgent('brace', payload);

      expect(window.open).toHaveBeenCalledWith(
        'https://brace-ui.fly.dev/?q=' + encodeURIComponent('hello world'),
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('should show toast after opening Brace', async () => {
      const { showToast } = await import('../../modules/toast.js');
      const payload = { promptText: 'test prompt' };
      await dispatchToAgent('brace', payload);

      expect(showToast).toHaveBeenCalledWith('Sent to Brace!', 'success');
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
