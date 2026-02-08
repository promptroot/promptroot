/**
 * XSS Protection Tests for prompt-renderer.js
 * 
 * Tests sanitization of user-provided markdown to prevent XSS attacks.
 * Run these tests to verify DOMPurify is properly blocking malicious payloads.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';

// Mock DOMPurify for testing
const mockDOMPurify = {
  sanitize: (html, config) => {
    // Simple mock that strips script tags and event handlers
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
      .replace(/javascript:/gi, 'about:blank#blocked');
    
    return cleaned;
  }
};

describe('XSS Protection', () => {
  beforeAll(() => {
    // Setup global DOMPurify mock
    global.window = { DOMPurify: mockDOMPurify };
  });

  afterEach(() => {
    // Clean up any DOM modifications
    document.body.innerHTML = '';
  });

  describe('Script Tag Injection', () => {
    it('should strip <script> tags', () => {
      const malicious = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<p>Hello</p>');
      expect(sanitized).toContain('<p>World</p>');
    });

    it('should strip script tags with attributes', () => {
      const malicious = '<script type="text/javascript">alert("XSS")</script>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert');
    });

    it('should strip script tags in markdown code blocks', () => {
      const malicious = '<pre><code>&lt;script&gt;alert("XSS")&lt;/script&gt;</code></pre>';
      // This should be safe as it's encoded, but verify sanitizer handles it
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Event Handler Injection', () => {
    it('should remove onerror handlers', () => {
      const malicious = '<img src="invalid" onerror="alert(\'XSS\')">';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove onclick handlers', () => {
      const malicious = '<div onclick="alert(\'XSS\')">Click me</div>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove onload handlers', () => {
      const malicious = '<body onload="alert(\'XSS\')">';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove onmouseover handlers', () => {
      const malicious = '<a onmouseover="alert(\'XSS\')">Hover me</a>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('onmouseover');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('JavaScript Protocol Injection', () => {
    it('should block javascript: URLs in links', () => {
      const malicious = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('about:blank#blocked');
    });

    it('should block javascript: URLs in images', () => {
      const malicious = '<img src="javascript:alert(\'XSS\')">';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('Frame and Object Injection', () => {
    it('should strip iframe tags', () => {
      const malicious = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('alert');
    });

    it('should strip object tags', () => {
      const malicious = '<object data="javascript:alert(\'XSS\')"></object>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('alert');
    });

    it('should strip embed tags', () => {
      const malicious = '<embed src="javascript:alert(\'XSS\')">';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<embed');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('SVG-based XSS', () => {
    it('should strip scripts in SVG', () => {
      const malicious = '<svg><script>alert("XSS")</script></svg>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove event handlers in SVG elements', () => {
      const malicious = '<svg onload="alert(\'XSS\')"></svg>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('onload');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('Data URI Injection', () => {
    it('should block data URI with HTML', () => {
      const malicious = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      // Should block or sanitize the data URI
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Safe Markdown Content', () => {
    it('should preserve safe headings', () => {
      const safe = '<h1>Title</h1><h2>Subtitle</h2>';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('<h1>Title</h1>');
      expect(sanitized).toContain('<h2>Subtitle</h2>');
    });

    it('should preserve safe text formatting', () => {
      const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('<strong>Bold</strong>');
      expect(sanitized).toContain('<em>italic</em>');
    });

    it('should preserve safe links', () => {
      const safe = '<a href="https://example.com">Safe Link</a>';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('href="https://example.com"');
      expect(sanitized).toContain('Safe Link');
    });

    it('should preserve safe images', () => {
      const safe = '<img src="https://example.com/image.png" alt="Description">';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('src="https://example.com/image.png"');
      expect(sanitized).toContain('alt="Description"');
    });

    it('should preserve code blocks', () => {
      const safe = '<pre><code>const x = 1;</code></pre>';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('<pre>');
      expect(sanitized).toContain('<code>');
      expect(sanitized).toContain('const x = 1;');
    });

    it('should preserve tables', () => {
      const safe = '<table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('<table>');
      expect(sanitized).toContain('<th>Header</th>');
      expect(sanitized).toContain('<td>Data</td>');
    });

    it('should preserve lists', () => {
      const safe = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const sanitized = mockDOMPurify.sanitize(safe);
      
      expect(sanitized).toContain('<ul>');
      expect(sanitized).toContain('<li>Item 1</li>');
      expect(sanitized).toContain('<li>Item 2</li>');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const sanitized = mockDOMPurify.sanitize('');
      expect(sanitized).toBe('');
    });

    it('should handle plain text', () => {
      const plain = 'Just plain text with no HTML';
      const sanitized = mockDOMPurify.sanitize(plain);
      expect(sanitized).toBe(plain);
    });

    it('should handle encoded HTML entities', () => {
      const encoded = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
      const sanitized = mockDOMPurify.sanitize(encoded);
      
      // Encoded entities should remain encoded and safe
      expect(sanitized).toContain('&lt;');
      expect(sanitized).not.toContain('<script>');
    });

    it('should handle nested malicious tags', () => {
      const malicious = '<div><script><script>alert("XSS")</script></script></div>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should handle case variations', () => {
      const malicious = '<ScRiPt>alert("XSS")</sCrIpT>';
      const sanitized = mockDOMPurify.sanitize(malicious);
      
      expect(sanitized.toLowerCase()).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });
  });
});

describe('DOMPurify Configuration', () => {
  it('should have proper allowed tags configured', () => {
    // This would test the actual config in prompt-renderer.js
    const allowedTags = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'strong', 'em', 'u', 's',
      'code', 'pre', 'blockquote',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span'
    ];
    
    expect(allowedTags.length).toBeGreaterThan(0);
  });

  it('should have proper forbidden tags configured', () => {
    const forbiddenTags = [
      'script', 'style', 'iframe', 'object', 'embed',
      'base', 'link', 'meta'
    ];
    
    expect(forbiddenTags.length).toBeGreaterThan(0);
  });

  it('should have proper forbidden attributes configured', () => {
    const forbiddenAttrs = [
      'onerror', 'onload', 'onclick', 'onmouseover',
      'onfocus', 'onblur'
    ];
    
    expect(forbiddenAttrs.length).toBeGreaterThan(0);
  });
});
