import { describe, it, expect } from 'vitest';
import { slugify, unslugify } from '../../utils/slug.js';

describe('slug.js', () => {
  describe('slugify', () => {
    it('should remove .md extension and lowercase', () => {
      expect(slugify('MyFile.md')).toBe('myfile');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('My File Name.md')).toBe('my-file-name');
    });

    it('should encode special characters', () => {
      expect(slugify('Hello World?.md')).toBe('hello-world%3F');
    });

    it('should handle files without extension correctly if passed (though implementation expects .md)', () => {
        // Based on regex /\.md$/i, if no .md, it just lowercases and slugifies
        expect(slugify('My File')).toBe('my-file');
    });

    it('should return empty string for null or undefined', () => {
        expect(slugify(null)).toBe('');
        expect(slugify(undefined)).toBe('');
    });

    it('should return empty string for non-string inputs', () => {
        expect(slugify(123)).toBe('');
        expect(slugify({})).toBe('');
    });
  });

  describe('unslugify', () => {
    it('should decode slug', () => {
        expect(unslugify('hello-world%3F')).toBe('hello-world?');
    });

    it('should return empty string for null or undefined', () => {
        expect(unslugify(null)).toBe('');
        expect(unslugify(undefined)).toBe('');
    });

    it('should return empty string for non-string inputs', () => {
        expect(unslugify(123)).toBe('');
        expect(unslugify({})).toBe('');
    });
  });
});
