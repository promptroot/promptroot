import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { sanitizeHtml } from '../modules/prompt-renderer.js';

describe('Data URI Security', () => {
  let capturedConfig = null;

  beforeAll(() => {
    // Mock DOMPurify
    global.window = global.window || {};
    global.window.DOMPurify = {
      sanitize: vi.fn((html, config) => {
        capturedConfig = config;
        return html; // Return html as is, we only care about config
      }),
      addHook: vi.fn()
    };
  });

  afterEach(() => {
    capturedConfig = null;
    vi.clearAllMocks();
  });

  it('should configure ALLOWED_URI_REGEXP to allow safe image data URIs', () => {
    sanitizeHtml('<p>test</p>');

    expect(capturedConfig).toBeDefined();
    const regex = capturedConfig.ALLOWED_URI_REGEXP;
    expect(regex).toBeDefined();

    // Safe images
    expect(regex.test('data:image/png;base64,abc')).toBe(true);
    expect(regex.test('data:image/jpeg;base64,abc')).toBe(true);
    expect(regex.test('data:image/gif;base64,abc')).toBe(true);
    expect(regex.test('data:image/svg+xml;base64,abc')).toBe(true);
    expect(regex.test('data:image/webp;base64,abc')).toBe(true);
  });

  it('should configure ALLOWED_URI_REGEXP to block malicious data URIs', () => {
    sanitizeHtml('<p>test</p>');
    const regex = capturedConfig.ALLOWED_URI_REGEXP;

    // Malicious types
    expect(regex.test('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(regex.test('data:text/javascript,alert(1)')).toBe(false);
    expect(regex.test('data:application/javascript,alert(1)')).toBe(false);

    // Malformed/Tricky cases
    expect(regex.test('data:text/html;base64,abc')).toBe(false);
    // "data:" alone should fail the check for "image/"
    expect(regex.test('data:')).toBe(false);

    // Regex is `data:image\/` so it expects the slash
    expect(regex.test('data:image')).toBe(false);
    expect(regex.test('data:image/')).toBe(true);
  });

  it('should allow standard schemes', () => {
    sanitizeHtml('<p>test</p>');
    const regex = capturedConfig.ALLOWED_URI_REGEXP;

    expect(regex.test('https://example.com')).toBe(true);
    expect(regex.test('http://example.com')).toBe(true);
    expect(regex.test('mailto:user@example.com')).toBe(true);
    expect(regex.test('tel:+1234567890')).toBe(true);
  });

  it('should block javascript scheme', () => {
    sanitizeHtml('<p>test</p>');
    const regex = capturedConfig.ALLOWED_URI_REGEXP;

    expect(regex.test('javascript:alert(1)')).toBe(false);
    expect(regex.test('vbscript:alert(1)')).toBe(false);
  });
});
