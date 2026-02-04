import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseParams, getHashParam, setHashParam } from '../../utils/url-params.js';

describe('url-params', () => {
  let originalLocation;

  beforeEach(() => {
    // Save original location
    originalLocation = window.location;
    
    // Mock window.location
    delete window.location;
    window.location = {
      search: '',
      hash: '',
      href: 'http://localhost/'
    };
  });

  afterEach(() => {
    // Restore original location
    window.location = originalLocation;
  });

  describe('parseParams', () => {
    it('should parse query parameters from search string', () => {
      window.location.search = '?owner=test&repo=myrepo&branch=main';
      
      const params = parseParams();
      
      expect(params).toEqual({
        owner: 'test',
        repo: 'myrepo',
        branch: 'main'
      });
    });

    it('should parse query parameters from hash string', () => {
      window.location.hash = '#?owner=test&repo=myrepo';
      
      const params = parseParams();
      
      expect(params).toEqual({
        owner: 'test',
        repo: 'myrepo'
      });
    });

    it('should parse query parameters from hash string without ? prefix', () => {
      window.location.hash = '#p=some-slug';

      const params = parseParams();

      expect(params.p).toBe('some-slug');
    });

    it('should parse parameters from both search and hash (hash takes precedence)', () => {
      window.location.search = '?owner=search-owner&branch=main';
      window.location.hash = '#?owner=hash-owner&repo=myrepo';
      
      const params = parseParams();
      
      // Hash params should override search params for same key
      expect(params.owner).toBe('hash-owner');
      expect(params.repo).toBe('myrepo');
      expect(params.branch).toBe('main');
    });

    it('should convert parameter keys to lowercase', () => {
      window.location.search = '?OWNER=test&Repo=myrepo';
      
      const params = parseParams();
      
      expect(params).toEqual({
        owner: 'test',
        repo: 'myrepo'
      });
    });

    it('should validate owner parameter and reject invalid values', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.location.search = '?owner=invalid@owner&repo=myrepo';
      
      const params = parseParams();
      
      expect(params.owner).toBeUndefined();
      expect(params.repo).toBe('myrepo');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid value for parameter 'owner'"),
        'invalid@owner'
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should validate repo parameter and reject invalid values', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.location.search = '?owner=test&repo=invalid repo name';
      
      const params = parseParams();
      
      expect(params.owner).toBe('test');
      expect(params.repo).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should validate branch parameter and reject invalid values', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.location.search = '?branch=invalid..branch';
      
      const params = parseParams();
      
      expect(params.branch).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should validate path parameter and reject path traversal', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.location.search = '?path=../secret.txt';

      const params = parseParams();

      expect(params.path).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should validate path parameter and reject absolute path', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.location.search = '?path=/etc/passwd';

      const params = parseParams();

      expect(params.path).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should validate p parameter and reject invalid paths', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.location.hash = '#?p=../secret.txt';

      const params = parseParams();

      expect(params.p).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should accept valid path parameter', () => {
      window.location.search = '?path=src/modules/auth.js';

      const params = parseParams();

      expect(params.path).toBe('src/modules/auth.js');
    });

    it('should accept non-validated parameters without validation', () => {
      window.location.search = '?custom=value&another=param&owner=test';
      
      const params = parseParams();
      
      expect(params.custom).toBe('value');
      expect(params.another).toBe('param');
      expect(params.owner).toBe('test');
    });

    it('should handle URL-encoded values', () => {
      window.location.search = '?owner=test&custom=hello%20world';
      
      const params = parseParams();
      
      expect(params.custom).toBe('hello world');
    });

    it('should return empty object when no parameters present', () => {
      window.location.search = '';
      window.location.hash = '';
      
      const params = parseParams();
      
      expect(params).toEqual({});
    });

    it('should handle hash without query string', () => {
      window.location.hash = '#section';
      
      const params = parseParams();
      
      expect(params).toEqual({});
    });
  });

  describe('getHashParam', () => {
    it('should get parameter from hash with ? prefix', () => {
      window.location.hash = '#?owner=test&repo=myrepo';
      
      const value = getHashParam('owner');
      
      expect(value).toBe('test');
    });

    it('should get parameter from hash with & separator', () => {
      window.location.hash = '#?owner=test&repo=myrepo';
      
      const value = getHashParam('repo');
      
      expect(value).toBe('myrepo');
    });

    it('should decode URL-encoded values', () => {
      window.location.hash = '#?name=hello%20world';
      
      const value = getHashParam('name');
      
      expect(value).toBe('hello world');
    });

    it('should return null if parameter not found', () => {
      window.location.hash = '#?owner=test';
      
      const value = getHashParam('repo');
      
      expect(value).toBeNull();
    });

    it('should return null if hash is empty', () => {
      window.location.hash = '';
      
      const value = getHashParam('owner');
      
      expect(value).toBeNull();
    });

    it('should handle special characters in parameter values', () => {
      window.location.hash = '#?path=src%2Fmodules%2Fauth.js';
      
      const value = getHashParam('path');
      
      expect(value).toBe('src/modules/auth.js');
    });
  });

  describe('setHashParam', () => {
    it('should set a hash parameter', () => {
      window.location.hash = '';
      
      setHashParam('owner', 'test');
      
      expect(window.location.hash).toBe('owner=test');
    });

    it('should add parameter to existing hash', () => {
      window.location.hash = '#owner=test';
      
      setHashParam('repo', 'myrepo');
      
      expect(window.location.hash).toContain('owner=test');
      expect(window.location.hash).toContain('repo=myrepo');
    });

    it('should update existing parameter', () => {
      window.location.hash = 'owner=test&repo=oldrepo';
      
      setHashParam('repo', 'newrepo');
      
      const params = new URLSearchParams(window.location.hash);
      expect(params.get('repo')).toBe('newrepo');
    });

    it('should URL-encode parameter values', () => {
      window.location.hash = '';
      
      setHashParam('name', 'hello world');
      
      expect(window.location.hash).toContain('hello+world');
    });

    it('should handle special characters', () => {
      window.location.hash = '';
      
      setHashParam('path', 'src/modules/auth.js');
      
      expect(window.location.hash).toContain('path=src');
    });
  });
});
