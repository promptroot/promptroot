import { describe, it, expect } from 'vitest';
import { validateOwner, validateRepo, validateBranch, validatePath } from '../../utils/validation.js';

describe('validation.js', () => {
  describe('validateOwner', () => {
    it('should validate correct owner', () => {
      expect(validateOwner('promptroot')).toBe(true);
      expect(validateOwner('my-org')).toBe(true);
      expect(validateOwner('User123')).toBe(true);
    });

    it('should invalidate incorrect owner', () => {
      expect(validateOwner('')).toBe(false);
      expect(validateOwner('-start')).toBe(false);
      expect(validateOwner('end-')).toBe(false);
      expect(validateOwner('double--hyphen')).toBe(false);
      expect(validateOwner('invalid char')).toBe(false);
      expect(validateOwner('a'.repeat(40))).toBe(false);
    });
  });

  describe('validateRepo', () => {
    it('should validate correct repo', () => {
      expect(validateRepo('my-repo')).toBe(true);
      expect(validateRepo('repo.name')).toBe(true);
      expect(validateRepo('repo_name')).toBe(true);
    });

    it('should invalidate incorrect repo', () => {
      expect(validateRepo('')).toBe(false);
      expect(validateRepo('.')).toBe(false);
      expect(validateRepo('..')).toBe(false);
      expect(validateRepo('invalid/char')).toBe(false);
      expect(validateRepo('a'.repeat(101))).toBe(false);
    });
  });

  describe('validateBranch', () => {
      it('should validate correct branch', () => {
          expect(validateBranch('main')).toBe(true);
          expect(validateBranch('feature/branch')).toBe(true);
          expect(validateBranch('user-name/branch_name')).toBe(true);
          expect(validateBranch('feature/v1.0')).toBe(true);
          expect(validateBranch('release/2.1.3')).toBe(true);
          expect(validateBranch('user.name/branch')).toBe(true);
      });

      it('should invalidate incorrect branch characters', () => {
          expect(validateBranch('branch$name')).toBe(false);
          expect(validateBranch('branch~name')).toBe(false);
          expect(validateBranch('branch with spaces')).toBe(false);
      });

      it('should invalidate path traversal sequences', () => {
          expect(validateBranch('../parent')).toBe(false);
          expect(validateBranch('..')).toBe(false);
      });
  });

  describe('validatePath', () => {
    it('should validate correct path', () => {
      expect(validatePath('src/main.js')).toBe(true);
      expect(validatePath('README.md')).toBe(true);
      expect(validatePath('folder/subfolder/file.txt')).toBe(true);
    });

    it('should invalidate absolute paths', () => {
      expect(validatePath('/etc/passwd')).toBe(false);
      expect(validatePath('/src/main.js')).toBe(false);
    });

    it('should invalidate path traversal', () => {
      expect(validatePath('../secret.txt')).toBe(false);
      expect(validatePath('src/../secret.txt')).toBe(false);
      expect(validatePath('.../file')).toBe(false);
      expect(validatePath('..')).toBe(false);
    });

    it('should invalidate empty path', () => {
        expect(validatePath('')).toBe(false);
    });
  });
});
