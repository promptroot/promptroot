import { describe, it, expect } from 'vitest';
import { extractTitleFromPrompt } from '../../utils/title.js';

describe('title.js', () => {
  it('should return empty string for empty input', () => {
    expect(extractTitleFromPrompt('')).toBe('');
    expect(extractTitleFromPrompt(null)).toBe('');
    expect(extractTitleFromPrompt(undefined)).toBe('');
  });

  it('should extract title from first line with #', () => {
    const prompt = '# My Title\nSome content';
    expect(extractTitleFromPrompt(prompt)).toBe('My Title');
  });

  it('should extract title from first line if no #', () => {
    const prompt = 'Just Title\nSome content';
    expect(extractTitleFromPrompt(prompt)).toBe('Just Title');
  });

  it('should extract title from any line starting with #', () => {
      const prompt = 'metadata: something\n# Real Title\nContent';
      expect(extractTitleFromPrompt(prompt)).toBe('Real Title');
  });

  it('should trim title to 100 chars', () => {
      const longTitle = 'a'.repeat(150);
      const prompt = `# ${longTitle}`;
      expect(extractTitleFromPrompt(prompt)).toBe('a'.repeat(100));
  });

  it('should handle whitespace', () => {
    const prompt = '\n  \n  #   My Title  \n';
    expect(extractTitleFromPrompt(prompt)).toBe('My Title');
  });
});
