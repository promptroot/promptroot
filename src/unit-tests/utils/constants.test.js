import { describe, it, expect } from 'vitest';
import * as constants from '../../utils/constants.js';

describe('constants', () => {
  describe('basic exports', () => {
    it('should export core project configuration constants', () => {
      expect(constants.OWNER).toBe('promptroot');
      expect(constants.REPO).toBe('promptroot');
      expect(constants.BRANCH).toBe('main');
    });

    it('should export Jules API configuration', () => {
      expect(constants.JULES_API_BASE).toBe('https://jules.googleapis.com/v1alpha');
      expect(constants.DEFAULT_FAVORITE_REPOS).toEqual([]);
      expect(constants.STORAGE_KEY_FAVORITE_REPOS).toBe('jules_favorite_repos');
    });
  });

  describe('regex patterns', () => {
    describe('GIST_POINTER_REGEX', () => {
      it('should match valid gist pointer URLs', () => {
        const validUrls = [
          'https://gist.githubusercontent.com/user/123/raw/456/file.md',
          'https://gist.githubusercontent.com/username/abcdef/raw/ghijkl/script.js'
        ];

        validUrls.forEach(url => {
          expect(constants.GIST_POINTER_REGEX.test(url)).toBe(true);
        });
      });

      it('should not match invalid gist pointer URLs', () => {
        const invalidUrls = [
          'https://github.com/user/repo',
          'https://gist.github.com/user/123',
          'http://gist.githubusercontent.com/user/123/raw/456/file.md', // http instead of https
          'https://gist.githubusercontent.com/user/123/file.md' // missing raw
        ];

        invalidUrls.forEach(url => {
          expect(constants.GIST_POINTER_REGEX.test(url)).toBe(false);
        });
      });

      it('should be case insensitive', () => {
        const url = 'HTTPS://GIST.GITHUBUSERCONTENT.COM/USER/123/RAW/456/FILE.MD';
        expect(constants.GIST_POINTER_REGEX.test(url)).toBe(true);
      });
    });

    describe('GIST_URL_REGEX', () => {
      it('should match valid gist URLs', () => {
        const validUrls = [
          'https://gist.github.com/username/1234567890abcdef',
          'https://gist.github.com/user-name/abcdef123456/',
          'https://gist.github.com/user/123abc#file-script.js',
          'https://gist.github.com/user/123abc?file=test.md'
        ];

        validUrls.forEach(url => {
          expect(constants.GIST_URL_REGEX.test(url)).toBe(true);
        });
      });

      it('should not match invalid gist URLs', () => {
        const invalidUrls = [
          'https://github.com/user/repo',
          'https://gist.github.com/', // no username/id
          'https://gist.github.com/user', // no gist id
          'http://gist.github.com/user/123' // http instead of https
        ];

        invalidUrls.forEach(url => {
          expect(constants.GIST_URL_REGEX.test(url)).toBe(false);
        });
      });

      it('should be case insensitive', () => {
        const url = 'HTTPS://GIST.GITHUB.COM/USER/ABCDEF123456';
        expect(constants.GIST_URL_REGEX.test(url)).toBe(true);
      });
    });

    describe('CODEX_URL_REGEX', () => {
      it('should match valid ChatGPT codex URLs', () => {
        const validUrls = [
          'https://chatgpt.com/s/abc123def456',
          'https://chatgpt.com/s/123456789_abcdef'
        ];

        validUrls.forEach(url => {
          expect(constants.CODEX_URL_REGEX.test(url)).toBe(true);
        });
      });

      it('should not match invalid codex URLs', () => {
        const invalidUrls = [
          'https://chatgpt.com/',
          'https://chatgpt.com/s/', // no id
          'https://chatgpt.com/chat/abc123',
          'http://chatgpt.com/s/abc123' // http instead of https
        ];

        invalidUrls.forEach(url => {
          expect(constants.CODEX_URL_REGEX.test(url)).toBe(false);
        });
      });

      it('should be case insensitive', () => {
        const url = 'HTTPS://CHATGPT.COM/S/ABC123DEF456';
        expect(constants.CODEX_URL_REGEX.test(url)).toBe(true);
      });
    });
  });

  describe('tag definitions', () => {
    it('should have proper structure for all tag types', () => {
      const expectedTags = ['review', 'bug', 'design', 'refactor'];
      
      expectedTags.forEach(tag => {
        expect(constants.TAG_DEFINITIONS[tag]).toBeDefined();
        expect(constants.TAG_DEFINITIONS[tag]).toHaveProperty('label');
        expect(constants.TAG_DEFINITIONS[tag]).toHaveProperty('className');
        expect(constants.TAG_DEFINITIONS[tag]).toHaveProperty('keywords');
        expect(Array.isArray(constants.TAG_DEFINITIONS[tag].keywords)).toBe(true);
      });
    });

    it('should have correct tag properties', () => {
      expect(constants.TAG_DEFINITIONS.review.label).toBe('Review');
      expect(constants.TAG_DEFINITIONS.review.className).toBe('tag-review');
      expect(constants.TAG_DEFINITIONS.review.keywords).toContain('review');

      expect(constants.TAG_DEFINITIONS.bug.label).toBe('Bug');
      expect(constants.TAG_DEFINITIONS.bug.className).toBe('tag-bug');
      expect(constants.TAG_DEFINITIONS.bug.keywords).toContain('bug');

      expect(constants.TAG_DEFINITIONS.design.label).toBe('Design');
      expect(constants.TAG_DEFINITIONS.design.className).toBe('tag-design');
      expect(constants.TAG_DEFINITIONS.design.keywords).toContain('design');

      expect(constants.TAG_DEFINITIONS.refactor.label).toBe('Refactor');
      expect(constants.TAG_DEFINITIONS.refactor.className).toBe('tag-refactor');
      expect(constants.TAG_DEFINITIONS.refactor.keywords).toContain('refactor');
    });

    it('should include regex patterns in keywords where appropriate', () => {
      expect(constants.TAG_DEFINITIONS.review.keywords).toContain('\\bpr\\b');
    });
  });

  describe('branch classification', () => {
    it('should define feature patterns', () => {
      expect(constants.FEATURE_PATTERNS).toEqual([
        'codex/', 'feature/', 'fix/', 'bugfix/', 'hotfix/'
      ]);
    });
  });

  describe('storage keys', () => {
    it('should generate correct expandedState keys', () => {
      const key = constants.STORAGE_KEYS.expandedState('user', 'repo', 'main');
      expect(key).toBe('sidebar:expanded:user/repo@main');
    });

    it('should generate correct promptsCache keys', () => {
      const key = constants.STORAGE_KEYS.promptsCache('owner', 'project', 'dev');
      expect(key).toBe('prompts:owner/project@dev');
    });

    it('should have static storage keys', () => {
      expect(constants.STORAGE_KEYS.showFeatureBranches).toBe('showFeatureBranches');
      expect(constants.STORAGE_KEYS.showUserBranches).toBe('showUserBranches');
    });
  });

  describe('error messages', () => {
    it('should define all required error messages', () => {
      const requiredErrors = [
        'FIREBASE_NOT_READY',
        'GIST_FETCH_FAILED', 
        'AUTH_REQUIRED',
        'JULES_KEY_REQUIRED',
        'CLIPBOARD_BLOCKED'
      ];

      requiredErrors.forEach(error => {
        expect(constants.ERRORS[error]).toBeDefined();
        expect(typeof constants.ERRORS[error]).toBe('string');
        expect(constants.ERRORS[error].length).toBeGreaterThan(0);
      });
    });

    it('should have descriptive error messages', () => {
      expect(constants.ERRORS.FIREBASE_NOT_READY).toContain('Firebase');
      expect(constants.ERRORS.GIST_FETCH_FAILED).toContain('gist');
      expect(constants.ERRORS.AUTH_REQUIRED).toContain('Authentication');
      expect(constants.ERRORS.JULES_KEY_REQUIRED).toContain('Jules API key');
      expect(constants.ERRORS.CLIPBOARD_BLOCKED).toContain('Clipboard');
    });
  });

  describe('Jules messages', () => {
    describe('static messages', () => {
      it('should define success messages', () => {
        expect(constants.JULES_MESSAGES.QUEUED).toContain('queued successfully');
        expect(constants.JULES_MESSAGES.QUEUE_UPDATED).toContain('updated successfully');
        expect(constants.JULES_MESSAGES.COMPLETED_RUNNING).toContain('Completed running');
      });

      it('should define warning messages', () => {
        expect(constants.JULES_MESSAGES.SIGN_IN_REQUIRED).toContain('sign in');
        expect(constants.JULES_MESSAGES.NOT_LOGGED_IN).toContain('logged in');
        expect(constants.JULES_MESSAGES.NO_ITEMS_SELECTED).toBe('No items selected');
      });

      it('should define error messages', () => {
        expect(constants.JULES_MESSAGES.GENERAL_ERROR).toContain('error occurred');
      });
    });

    describe('dynamic message functions', () => {
      it('should generate cancelled messages with counts', () => {
        const message = constants.JULES_MESSAGES.cancelled(1, 3);
        expect(message).toBe('Cancelled. Processed 1 of 3 task before cancellation.');
        
        const pluralMessage = constants.JULES_MESSAGES.cancelled(2, 5);
        expect(pluralMessage).toBe('Cancelled. Processed 2 of 5 tasks before cancellation.');
      });

      it('should generate deleted messages with proper pluralization', () => {
        const single = constants.JULES_MESSAGES.deleted(1);
        expect(single).toBe('Deleted 1 item');
        
        const multiple = constants.JULES_MESSAGES.deleted(3);
        expect(multiple).toBe('Deleted 3 items');
      });

      it('should generate completion messages with skipped count', () => {
        const message = constants.JULES_MESSAGES.completedWithSkipped(2, 1);
        expect(message).toBe('Completed 2 tasks, skipped 1');
        
        const singleMessage = constants.JULES_MESSAGES.completedWithSkipped(1, 1);
        expect(singleMessage).toBe('Completed 1 task, skipped 1');
      });

      it('should generate subtask messages with proper pluralization', () => {
        const single = constants.JULES_MESSAGES.subtasksQueued(1);
        expect(single).toBe('1 subtask queued successfully!');
        
        const multiple = constants.JULES_MESSAGES.subtasksQueued(5);
        expect(multiple).toBe('5 subtasks queued successfully!');
      });

      it('should generate error messages with custom text', () => {
        const queueError = constants.JULES_MESSAGES.QUEUE_FAILED('Network timeout');
        expect(queueError).toBe('Failed to queue prompt: Network timeout');
        
        const generalError = constants.JULES_MESSAGES.ERROR_WITH_MESSAGE('Invalid API key');
        expect(generalError).toBe('An error occurred: Invalid API key');
      });
    });
  });

  describe('UI text constants', () => {
    it('should define basic UI text', () => {
      expect(constants.UI_TEXT.LOADING).toBe('Loading...');
      expect(constants.UI_TEXT.SIGN_IN).toBe('Sign in with GitHub');
      expect(constants.UI_TEXT.SIGN_OUT).toBe('Sign Out');
      expect(constants.UI_TEXT.COPIED).toBe('Copied');
      expect(constants.UI_TEXT.LINK_COPIED).toBe('Link copied');
      expect(constants.UI_TEXT.RUNNING).toBe('Running...');
      expect(constants.UI_TEXT.SAVE_KEY).toBe('Save & Continue');
    });

    it('should define icon-based UI text', () => {
      // These use createIconWithText from icon-helpers, so they should be strings
      expect(typeof constants.UI_TEXT.COPY_PROMPT).toBe('string');
      expect(typeof constants.UI_TEXT.COPY_LINK).toBe('string');
      expect(typeof constants.UI_TEXT.TRY_JULES).toBe('string');
    });
  });

  describe('retry configuration', () => {
    it('should define retry configuration with proper types', () => {
      expect(constants.RETRY_CONFIG).toBeDefined();
      expect(typeof constants.RETRY_CONFIG.maxRetries).toBe('number');
      expect(typeof constants.RETRY_CONFIG.baseDelay).toBe('number');
      
      expect(constants.RETRY_CONFIG.maxRetries).toBeGreaterThan(0);
      expect(constants.RETRY_CONFIG.baseDelay).toBeGreaterThan(0);
    });

    it('should have reasonable retry values', () => {
      expect(constants.RETRY_CONFIG.maxRetries).toBe(3);
      expect(constants.RETRY_CONFIG.baseDelay).toBe(1000);
    });
  });

  describe('timeouts configuration', () => {
    it('should define all timeout values with proper types', () => {
      const timeoutKeys = [
        'statusBar', 'fetch', 'componentCheck', 'windowClose', 'uiDelay',
        'longDelay', 'toast', 'copyFeedback', 'queueDelay', 'firebaseRetry',
        'modalFocus', 'actionFeedback'
      ];

      timeoutKeys.forEach(key => {
        expect(constants.TIMEOUTS[key]).toBeDefined();
        expect(typeof constants.TIMEOUTS[key]).toBe('number');
        expect(constants.TIMEOUTS[key]).toBeGreaterThan(0);
      });
    });

    it('should have reasonable timeout values', () => {
      expect(constants.TIMEOUTS.statusBar).toBe(3000);
      expect(constants.TIMEOUTS.fetch).toBe(5000);
      expect(constants.TIMEOUTS.componentCheck).toBe(50);
      expect(constants.TIMEOUTS.windowClose).toBe(2000);
      expect(constants.TIMEOUTS.uiDelay).toBe(500);
      expect(constants.TIMEOUTS.longDelay).toBe(5000);
      expect(constants.TIMEOUTS.toast).toBe(3000);
      expect(constants.TIMEOUTS.copyFeedback).toBe(1000);
      expect(constants.TIMEOUTS.queueDelay).toBe(800);
      expect(constants.TIMEOUTS.firebaseRetry).toBe(100);
      expect(constants.TIMEOUTS.modalFocus).toBe(100);
      expect(constants.TIMEOUTS.actionFeedback).toBe(2000);
    });
  });

  describe('limits configuration', () => {
    it('should define limits with proper types', () => {
      expect(constants.LIMITS).toBeDefined();
      expect(typeof constants.LIMITS.firebaseMaxAttempts).toBe('number');
      expect(typeof constants.LIMITS.componentMaxAttempts).toBe('number');
      
      expect(constants.LIMITS.firebaseMaxAttempts).toBeGreaterThan(0);
      expect(constants.LIMITS.componentMaxAttempts).toBeGreaterThan(0);
    });

    it('should have reasonable limit values', () => {
      expect(constants.LIMITS.firebaseMaxAttempts).toBe(300);
      expect(constants.LIMITS.componentMaxAttempts).toBe(100);
    });
  });

  describe('page sizes configuration', () => {
    it('should define page sizes with proper types', () => {
      expect(constants.PAGE_SIZES).toBeDefined();
      expect(typeof constants.PAGE_SIZES.julesSessions).toBe('number');
      expect(typeof constants.PAGE_SIZES.branches).toBe('number');
      
      expect(constants.PAGE_SIZES.julesSessions).toBeGreaterThan(0);
      expect(constants.PAGE_SIZES.branches).toBeGreaterThan(0);
    });

    it('should have reasonable page size values', () => {
      expect(constants.PAGE_SIZES.julesSessions).toBe(10);
      expect(constants.PAGE_SIZES.branches).toBe(100);
    });
  });

  describe('cache durations configuration', () => {
    it('should define cache durations with proper types', () => {
      expect(constants.CACHE_DURATIONS).toBeDefined();
      expect(typeof constants.CACHE_DURATIONS.short).toBe('number');
      expect(typeof constants.CACHE_DURATIONS.session).toBe('number');
      
      expect(constants.CACHE_DURATIONS.short).toBeGreaterThan(0);
      expect(constants.CACHE_DURATIONS.session).toBe(0); // Session flag
    });

    it('should have reasonable cache duration values', () => {
      expect(constants.CACHE_DURATIONS.short).toBe(300000); // 5 minutes in ms
      expect(constants.CACHE_DURATIONS.session).toBe(0); // Session duration flag
    });
  });

  describe('integration and consistency', () => {
    it('should have consistent naming patterns', () => {
      // All constants should be UPPER_CASE
      const constantNames = Object.keys(constants).filter(key => 
        typeof constants[key] === 'string' || 
        typeof constants[key] === 'number' ||
        typeof constants[key] === 'boolean'
      );

      constantNames.forEach(name => {
        if (!name.startsWith('TAG_') && !name.startsWith('GIST_') && !name.startsWith('CODEX_')) {
          expect(name).toMatch(/^[A-Z][A-Z_]*[A-Z]$|^[A-Z]$/);
        }
      });
    });

    it('should have consistent timeout relationships', () => {
      // Short timeouts should be less than long timeouts
      expect(constants.TIMEOUTS.componentCheck).toBeLessThan(constants.TIMEOUTS.uiDelay);
      expect(constants.TIMEOUTS.uiDelay).toBeLessThan(constants.TIMEOUTS.statusBar);
      expect(constants.TIMEOUTS.statusBar).toBeLessThan(constants.TIMEOUTS.longDelay);
    });

    it('should have all required configuration objects', () => {
      const requiredConfigs = [
        'TAG_DEFINITIONS', 'STORAGE_KEYS', 'ERRORS', 'JULES_MESSAGES',
        'UI_TEXT', 'RETRY_CONFIG', 'TIMEOUTS', 'LIMITS', 'PAGE_SIZES', 'CACHE_DURATIONS'
      ];

      requiredConfigs.forEach(config => {
        expect(constants[config]).toBeDefined();
        expect(typeof constants[config]).toBe('object');
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle regex with special characters', () => {
      // Test that regex patterns compile without errors
      expect(() => new RegExp(constants.GIST_POINTER_REGEX.source)).not.toThrow();
      expect(() => new RegExp(constants.GIST_URL_REGEX.source)).not.toThrow();
      expect(() => new RegExp(constants.CODEX_URL_REGEX.source)).not.toThrow();
    });

    it('should handle storage key generation with special characters', () => {
      const specialKey = constants.STORAGE_KEYS.expandedState('user@domain', 'repo-name', 'feature/test');
      expect(specialKey).toBe('sidebar:expanded:user@domain/repo-name@feature/test');
    });

    it('should handle message functions with edge case inputs', () => {
      expect(constants.JULES_MESSAGES.deleted(0)).toBe('Deleted 0 items');
      expect(constants.JULES_MESSAGES.cancelled(0, 0)).toBe('Cancelled. Processed 0 of 0 tasks before cancellation.');
    });

    it('should have fallback values for critical configurations', () => {
      // Critical timeouts should have reasonable defaults
      expect(constants.TIMEOUTS.fetch).toBeGreaterThanOrEqual(1000);
      expect(constants.TIMEOUTS.statusBar).toBeGreaterThanOrEqual(1000);
    });
  });
});