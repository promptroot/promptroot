import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectPlaceholders,
  detectConditionalFlags,
  renderConditionalBlocks,
  substitutePlaceholders
} from '../../modules/variable-substitution.js';

describe('variable-substitution', () => {
  beforeEach(() => {
    // Setup DOMPurify mock
    global.window = global.window || {};
    global.window.DOMPurify = {
      sanitize: vi.fn((value, config) => {
        // Mock: strip HTML tags but keep text
        if (config && config.ALLOWED_TAGS && config.ALLOWED_TAGS.length === 0) {
          return value.replace(/<[^>]*>/g, '');
        }
        return value;
      })
    };
  });

  describe('detectPlaceholders', () => {
    it('should return empty array for text without placeholders', () => {
      const text = 'This is a regular prompt without any variables.';
      const result = detectPlaceholders(text);
      expect(result).toEqual([]);
    });

    it('should detect single placeholder', () => {
      const text = 'Fix the bug in {FILE_PATH}.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['FILE_PATH']);
    });

    it('should detect multiple unique placeholders', () => {
      const text = 'Debug {FUNCTION} in {FILE}.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['FUNCTION', 'FILE']);
    });

    it('should deduplicate repeated placeholders', () => {
      const text = 'Compare {FILE} with {FILE} and log to {OUTPUT}.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['FILE', 'OUTPUT']);
    });

    it('should detect placeholder within nested braces', () => {
      // Note: {{NESTED}} will match {NESTED} - this is expected behavior
      // The regex extracts the valid pattern from within double braces
      const text = 'Use {{NESTED}} syntax.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['NESTED']);
    });

    it('should ignore placeholders with dots', () => {
      const text = 'Invalid {VAR.NAME} placeholder.';
      const result = detectPlaceholders(text);
      expect(result).toEqual([]);
    });

    it('should ignore placeholders with spaces', () => {
      const text = 'Invalid {var name} placeholder.';
      const result = detectPlaceholders(text);
      expect(result).toEqual([]);
    });

    it('should ignore lowercase placeholders', () => {
      const text = 'Lowercase {name} should not be detected.';
      const result = detectPlaceholders(text);
      expect(result).toEqual([]);
    });

    it('should detect placeholders with underscores', () => {
      const text = 'Fix {FILE_PATH} on line {LINE_NUMBER}.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['FILE_PATH', 'LINE_NUMBER']);
    });

    it('should detect placeholders with hyphens', () => {
      const text = 'Update {USER-ID} and {SESSION-TOKEN}.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['USER-ID', 'SESSION-TOKEN']);
    });

    it('should detect placeholders with numbers', () => {
      const text = 'Check {VAR1} and {VAR2}.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['VAR1', 'VAR2']);
    });

    it('should handle empty string', () => {
      const result = detectPlaceholders('');
      expect(result).toEqual([]);
    });

    it('should handle null input gracefully', () => {
      const result = detectPlaceholders(null);
      expect(result).toEqual([]);
    });

    it('should handle undefined input gracefully', () => {
      const result = detectPlaceholders(undefined);
      expect(result).toEqual([]);
    });

    it('should detect placeholders in markdown code blocks', () => {
      const text = 'Run `{COMMAND}` in terminal.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['COMMAND']);
    });

    it('should detect multiple placeholders on same line', () => {
      const text = '{VAR1} {VAR2} {VAR3}';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['VAR1', 'VAR2', 'VAR3']);
    });

    it('should ignore malformed unclosed brace', () => {
      const text = 'This has {UNCLOSED placeholder.';
      const result = detectPlaceholders(text);
      expect(result).toEqual([]);
    });

    it('should ignore placeholder with only opening brace', () => {
      const text = 'This has {VALID} and { INVALID.';
      const result = detectPlaceholders(text);
      expect(result).toEqual(['VALID']);
    });
  });

  describe('substitutePlaceholders', () => {
    it('should replace single occurrence', () => {
      const text = 'Hello {NAME}!';
      const values = { NAME: 'World' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Hello World!');
    });

    it('should replace all occurrences of same placeholder', () => {
      const text = '{NAME} and {NAME} went to the store.';
      const values = { NAME: 'Alice' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Alice and Alice went to the store.');
    });

    it('should replace multiple different placeholders', () => {
      const text = 'Fix {FILE} on line {LINE}.';
      const values = { FILE: 'app.js', LINE: '42' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Fix app.js on line 42.');
    });

    it('should leave unmatched placeholders unchanged', () => {
      const text = '{A} and {B} and {C}';
      const values = { A: 'first', B: 'second' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('first and second and {C}');
    });

    it('should handle empty string value', () => {
      const text = 'Value: {NAME}';
      const values = { NAME: '' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Value: ');
    });

    it('should handle values with special regex characters', () => {
      const text = 'Replace {VALUE}';
      const values = { VALUE: '$100' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Replace $100');
    });

    it('should sanitize HTML in values', () => {
      const text = 'Name: {NAME}';
      const values = { NAME: '<script>alert("XSS")</script>' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Name: alert("XSS")');
      expect(global.window.DOMPurify.sanitize).toHaveBeenCalled();
    });

    it('should sanitize dangerous HTML tags', () => {
      const text = 'Content: {CONTENT}';
      const values = { CONTENT: '<img src=x onerror="bad()">' };
      const result = substitutePlaceholders(text, values);
      expect(result).not.toContain('<img');
      expect(result).not.toContain('onerror');
    });

    it('should preserve plain text without HTML', () => {
      const text = 'Message: {MSG}';
      const values = { MSG: 'Hello World' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Message: Hello World');
    });

    it('should handle empty text', () => {
      const result = substitutePlaceholders('', { NAME: 'test' });
      expect(result).toBe('');
    });

    it('should handle null text gracefully', () => {
      const result = substitutePlaceholders(null, { NAME: 'test' });
      expect(result).toBeNull();
    });

    it('should handle undefined text gracefully', () => {
      const result = substitutePlaceholders(undefined, { NAME: 'test' });
      expect(result).toBeUndefined();
    });

    it('should handle empty values object', () => {
      const text = 'Hello {NAME}';
      const result = substitutePlaceholders(text, {});
      expect(result).toBe('Hello {NAME}');
    });

    it('should handle values with quotes', () => {
      const text = 'Say {QUOTE}';
      const values = { QUOTE: '"Hello" and \'World\'' };
      const result = substitutePlaceholders(text, values);
      expect(result).toContain('"Hello"');
      expect(result).toContain("'World'");
    });

    it('should handle values with newlines', () => {
      const text = 'Text: {CONTENT}';
      const values = { CONTENT: 'Line 1\nLine 2' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Text: Line 1\nLine 2');
    });

    it('should handle numeric values', () => {
      const text = 'Line {NUM}';
      const values = { NUM: '123' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Line 123');
    });

    it('should be case-sensitive', () => {
      const text = 'Value: {NAME}';
      const values = { name: 'lowercase' }; // lowercase key
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Value: {NAME}'); // Should not replace
    });

    it('should handle multiple replacements correctly', () => {
      const text = 'Debug {FUNC} in {FILE} on line {LINE}.';
      const values = { 
        FUNC: 'calculateTotal', 
        FILE: 'utils.js', 
        LINE: '42' 
      };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Debug calculateTotal in utils.js on line 42.');
    });

    it('should handle values with braces', () => {
      const text = 'Code: {CODE}';
      const values = { CODE: 'function() { return true; }' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('Code: function() { return true; }');
    });
  });

  describe('detectConditionalFlags', () => {
    it('should return empty array for text without conditionals', () => {
      const text = 'Regular prompt text only.';
      const result = detectConditionalFlags(text);
      expect(result).toEqual([]);
    });

    it('should detect single include flag from conditional block', () => {
      const text = '{{#if INCLUDE_UI_CHANGES}}UI section{{/if}}';
      const result = detectConditionalFlags(text);
      expect(result).toEqual(['INCLUDE_UI_CHANGES']);
    });

    it('should detect multiple unique include flags', () => {
      const text = `
        {{#if INCLUDE_UI_CHANGES}}UI{{/if}}
        {{#if INCLUDE_AGENT_API}}API{{/if}}
      `;
      const result = detectConditionalFlags(text);
      expect(result).toEqual(['INCLUDE_UI_CHANGES', 'INCLUDE_AGENT_API']);
    });

    it('should deduplicate repeated include flags', () => {
      const text = `
        {{#if INCLUDE_UNIT_TESTS}}First{{/if}}
        {{#if INCLUDE_UNIT_TESTS}}Second{{/if}}
      `;
      const result = detectConditionalFlags(text);
      expect(result).toEqual(['INCLUDE_UNIT_TESTS']);
    });
  });

  describe('renderConditionalBlocks', () => {
    it('should include block content when flag is true', () => {
      const text = '{{#if INCLUDE_UI_CHANGES}}\n## UI Changes\n{{/if}}';
      const result = renderConditionalBlocks(text, { INCLUDE_UI_CHANGES: true });
      expect(result).toContain('## UI Changes');
      expect(result).not.toContain('{{#if');
    });

    it('should remove block content when flag is false', () => {
      const text = '{{#if INCLUDE_UI_CHANGES}}\n## UI Changes\n{{/if}}';
      const result = renderConditionalBlocks(text, { INCLUDE_UI_CHANGES: false });
      expect(result).toBe('');
    });

    it('should remove block content when flag is missing', () => {
      const text = '{{#if INCLUDE_E2E_TESTS}}\n## E2E\n{{/if}}';
      const result = renderConditionalBlocks(text, {});
      expect(result).toBe('');
    });

    it('should handle mixed true and false flags', () => {
      const text = `
        {{#if INCLUDE_UI_CHANGES}}UI{{/if}}
        {{#if INCLUDE_AGENT_API}}API{{/if}}
      `;
      const result = renderConditionalBlocks(text, {
        INCLUDE_UI_CHANGES: true,
        INCLUDE_AGENT_API: false
      });
      expect(result).toContain('UI');
      expect(result).not.toContain('API');
      expect(result).not.toContain('{{#if');
    });

    it('should preserve non-conditional text', () => {
      const text = 'Header\n{{#if INCLUDE_UNIT_TESTS}}Unit Tests\n{{/if}}Footer';
      const result = renderConditionalBlocks(text, { INCLUDE_UNIT_TESTS: true });
      expect(result).toContain('Header');
      expect(result).toContain('Unit Tests');
      expect(result).toContain('Footer');
    });
  });

  describe('sanitization integration', () => {
    it('should call DOMPurify.sanitize with correct config', () => {
      const text = 'Value: {VAL}';
      const values = { VAL: '<b>bold</b>' };
      
      substitutePlaceholders(text, values);
      
      expect(global.window.DOMPurify.sanitize).toHaveBeenCalledWith(
        '<b>bold</b>',
        expect.objectContaining({
          ALLOWED_TAGS: [],
          KEEP_CONTENT: true
        })
      );
    });

    it('should handle DOMPurify not available', () => {
      const originalDOMPurify = global.window.DOMPurify;
      delete global.window.DOMPurify;
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const text = 'Value: {VAL}';
      const values = { VAL: 'test<script>bad</script>' };
      const result = substitutePlaceholders(text, values);
      
      // Should fall back to textContent extraction
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('DOMPurify not loaded')
      );
      expect(result).toBe('Value: test<script>bad</script>'); // Fallback keeps the value
      
      consoleError.mockRestore();
      global.window.DOMPurify = originalDOMPurify;
    });
  });

  describe('complex scenarios', () => {
    it('should handle markdown with placeholders', () => {
      const text = '# Debug {COMPONENT}\n\nCheck the `{METHOD}` method.';
      const values = { COMPONENT: 'Header', METHOD: 'render' };
      const result = substitutePlaceholders(text, values);
      expect(result).toBe('# Debug Header\n\nCheck the `render` method.');
    });

    it('should handle long text with multiple placeholders', () => {
      const text = `
        Task: Fix the bug in {FILE}
        Function: {FUNCTION}
        Line: {LINE}
        Priority: {PRIORITY}
      `;
      const values = {
        FILE: 'app.js',
        FUNCTION: 'handleClick',
        LINE: '123',
        PRIORITY: 'HIGH'
      };
      const result = substitutePlaceholders(text, values);
      expect(result).toContain('app.js');
      expect(result).toContain('handleClick');
      expect(result).toContain('123');
      expect(result).toContain('HIGH');
    });

    it('should support mixed placeholders and conditionals for modular templates', () => {
      const template = `
# SDD {PLAN_VERSION}
{FEATURE_REQUEST_TEXT}

{{#if INCLUDE_UI_CHANGES}}
## UI
{{/if}}

{{#if INCLUDE_E2E_TESTS}}
## E2E
{{/if}}
`;

      const substituted = substitutePlaceholders(template, {
        PLAN_VERSION: 'v1.2.0',
        FEATURE_REQUEST_TEXT: 'Implement modular template generation.'
      });

      const rendered = renderConditionalBlocks(substituted, {
        INCLUDE_UI_CHANGES: true,
        INCLUDE_E2E_TESTS: false
      });

      expect(rendered).toContain('v1.2.0');
      expect(rendered).toContain('Implement modular template generation.');
      expect(rendered).toContain('## UI');
      expect(rendered).not.toContain('## E2E');
      expect(rendered).not.toContain('{{#if');
    });
  });
});
