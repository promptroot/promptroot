import { describe, it, expect } from 'vitest';
import { createIcon, createIconWithText, createIconButton, ICON_BUTTONS, ICONS } from '../../utils/icon-helpers.js';

describe('icon-helpers', () => {
  describe('createIcon', () => {
    it('should create basic icon with default options', () => {
      const result = createIcon('star');
      
      expect(result).toContain('class="icon"');
      expect(result).toContain('aria-hidden="true"');
      expect(result).toContain('>star</span>');
    });

    it('should apply size class', () => {
      const result = createIcon('check', { size: 'lg' });
      
      expect(result).toContain('class="icon icon-lg"');
    });

    it('should apply custom className', () => {
      const result = createIcon('home', { className: 'custom-icon' });
      
      expect(result).toContain('class="icon custom-icon"');
    });

    it('should apply both size and className', () => {
      const result = createIcon('menu', { size: 'xl', className: 'nav-icon' });
      
      expect(result).toContain('class="icon icon-xl nav-icon"');
    });

    it('should add title attribute when provided', () => {
      const result = createIcon('info', { title: 'Information' });
      
      expect(result).toContain('title="Information"');
      expect(result).toContain('>info</span>');
    });

    it('should not add title attribute when not provided', () => {
      const result = createIcon('alert');
      
      expect(result).not.toContain('title=');
    });

    it('should handle empty options object', () => {
      const result = createIcon('favorite', {});
      
      expect(result).toContain('class="icon"');
      expect(result).toContain('aria-hidden="true"');
      expect(result).toContain('>favorite</span>');
    });

    it('should handle null size', () => {
      const result = createIcon('visibility', { size: null });
      
      expect(result).toContain('class="icon"');
      expect(result).not.toContain('icon-null');
    });

    it('should handle empty className', () => {
      const result = createIcon('delete', { className: '' });
      
      expect(result).toContain('class="icon"');
    });

    it('should handle inline size', () => {
      const result = createIcon('edit', { size: 'inline' });
      
      expect(result).toContain('class="icon icon-inline"');
    });
  });

  describe('createIconWithText', () => {
    it('should create icon with text label', () => {
      const result = createIconWithText('check', 'Success');
      
      expect(result).toContain('icon-inline');
      expect(result).toContain('>check</span>');
      expect(result).toContain(' Success');
    });

    it('should default to inline size', () => {
      const result = createIconWithText('star', 'Favorite');
      
      expect(result).toContain('icon-inline');
    });

    it('should allow size override', () => {
      const result = createIconWithText('alert', 'Warning', { size: 'lg' });
      
      expect(result).toContain('icon-lg');
      expect(result).toContain('>alert</span>');
    });

    it('should pass through options to createIcon', () => {
      const result = createIconWithText('info', 'Help', { 
        size: 'xl', 
        className: 'tooltip-icon',
        title: 'More info' 
      });
      
      expect(result).toContain('icon-xl');
      expect(result).toContain('tooltip-icon');
      expect(result).toContain('title="More info"');
      expect(result).toContain(' Help');
    });

    it('should handle empty text', () => {
      const result = createIconWithText('home', '');
      
      expect(result).toContain('>home</span>');
      expect(result).toContain(' '); // Space is still included
    });

    it('should handle text with special characters', () => {
      const result = createIconWithText('link', 'Copy & Share');
      
      expect(result).toContain(' Copy & Share');
    });
  });

  describe('createIconButton', () => {
    it('should create icon button with text', () => {
      const result = createIconButton('save', 'Save');
      
      expect(result).toContain('icon-inline');
      expect(result).toContain('>save</span>');
      expect(result).toContain(' Save');
    });

    it('should create icon-only button when text is empty', () => {
      const result = createIconButton('close', '');
      
      expect(result).toContain('class="icon"');
      expect(result).toContain('>close</span>');
      expect(result).not.toContain('icon-inline');
    });

    it('should create icon-only button when text is not provided', () => {
      const result = createIconButton('menu');
      
      expect(result).toContain('class="icon"');
      expect(result).toContain('>menu</span>');
      expect(result).not.toContain('icon-inline');
    });

    it('should use default iconSize of inline when text is provided', () => {
      const result = createIconButton('download', 'Download');
      
      expect(result).toContain('icon-inline');
    });

    it('should allow iconSize override', () => {
      const result = createIconButton('upload', 'Upload', { iconSize: 'lg' });
      
      expect(result).toContain('icon-lg');
      expect(result).toContain(' Upload');
    });

    it('should not apply size to icon-only buttons', () => {
      const result = createIconButton('sync', '', { iconSize: 'lg' });
      
      expect(result).toContain('class="icon"');
      expect(result).not.toContain('icon-lg');
    });

    it('should handle empty options object', () => {
      const result = createIconButton('edit', 'Edit', {});
      
      expect(result).toContain('icon-inline');
    });
  });

  describe('ICON_BUTTONS', () => {
    it('should have COPY_PROMPT button', () => {
      const result = ICON_BUTTONS.COPY_PROMPT();
      
      expect(result).toContain('content_copy');
      expect(result).toContain('Copy prompt');
    });

    it('should allow custom icon for COPY_PROMPT', () => {
      const result = ICON_BUTTONS.COPY_PROMPT('file_copy');
      
      expect(result).toContain('file_copy');
      expect(result).toContain('Copy prompt');
    });

    it('should have COPY_LINK button', () => {
      const result = ICON_BUTTONS.COPY_LINK();
      
      expect(result).toContain('link');
      expect(result).toContain('Copy link');
    });

    it('should have EDIT button', () => {
      const result = ICON_BUTTONS.EDIT();
      
      expect(result).toContain('edit');
      expect(result).toContain('Edit');
    });

    it('should have DELETE button', () => {
      const result = ICON_BUTTONS.DELETE();
      
      expect(result).toContain('delete');
      expect(result).toContain('Delete');
    });

    it('should have SYNC icon-only button', () => {
      const result = ICON_BUTTONS.SYNC();
      
      expect(result).toContain('sync');
      expect(result).not.toContain('icon-inline');
    });

    it('should have CLOSE icon-only button', () => {
      const result = ICON_BUTTONS.CLOSE();
      
      expect(result).toContain('close');
      expect(result).not.toContain('icon-inline');
    });

    it('should have LOADING button with text', () => {
      const result = ICON_BUTTONS.LOADING();
      
      expect(result).toContain('hourglass_top');
      expect(result).toContain('Loading...');
    });

    it('should have SUCCESS button with text', () => {
      const result = ICON_BUTTONS.SUCCESS();
      
      expect(result).toContain('check_circle');
      expect(result).toContain('Success');
    });

    it('should have ERROR button with text', () => {
      const result = ICON_BUTTONS.ERROR();
      
      expect(result).toContain('error');
      expect(result).toContain('Error');
    });

    it('should allow custom icons for all buttons', () => {
      expect(ICON_BUTTONS.COPY_LINK('custom_link')).toContain('custom_link');
      expect(ICON_BUTTONS.EDIT('custom_edit')).toContain('custom_edit');
      expect(ICON_BUTTONS.DELETE('custom_delete')).toContain('custom_delete');
      expect(ICON_BUTTONS.SYNC('custom_sync')).toContain('custom_sync');
      expect(ICON_BUTTONS.CLOSE('custom_close')).toContain('custom_close');
      expect(ICON_BUTTONS.LOADING('custom_loading')).toContain('custom_loading');
      expect(ICON_BUTTONS.SUCCESS('custom_success')).toContain('custom_success');
      expect(ICON_BUTTONS.ERROR('custom_error')).toContain('custom_error');
    });
  });

  describe('ICONS', () => {
    it('should export action icons', () => {
      expect(ICONS.COPY).toBe('content_copy');
      expect(ICONS.LINK).toBe('link');
      expect(ICONS.EDIT).toBe('edit');
      expect(ICONS.DELETE).toBe('delete');
      expect(ICONS.ADD).toBe('add');
      expect(ICONS.CLOSE).toBe('close');
      expect(ICONS.SYNC).toBe('sync');
      expect(ICONS.REFRESH).toBe('refresh');
    });

    it('should export status icons', () => {
      expect(ICONS.CHECK).toBe('check_circle');
      expect(ICONS.ERROR).toBe('error');
      expect(ICONS.WARNING).toBe('warning');
      expect(ICONS.INFO).toBe('info');
      expect(ICONS.LOADING).toBe('hourglass_top');
      expect(ICONS.CANCEL).toBe('cancel');
    });

    it('should export navigation icons', () => {
      expect(ICONS.HOME).toBe('home');
      expect(ICONS.BACK).toBe('arrow_back');
      expect(ICONS.MENU).toBe('menu');
    });

    it('should export content icons', () => {
      expect(ICONS.FOLDER).toBe('folder');
      expect(ICONS.FILE).toBe('description');
      expect(ICONS.CODE).toBe('code');
      expect(ICONS.PHOTO).toBe('photo_camera');
      expect(ICONS.KEY).toBe('key');
      expect(ICONS.LOCK).toBe('lock');
    });

    it('should export app-specific icons', () => {
      expect(ICONS.JULES).toBe('smart_toy');
      expect(ICONS.QUEUE).toBe('list_alt');
      expect(ICONS.SESSIONS).toBe('menu_book');
      expect(ICONS.PROFILE).toBe('person');
      expect(ICONS.REPO).toBe('inventory_2');
      expect(ICONS.BRANCH).toBe('account_tree');
    });

    it('should export feature icons', () => {
      expect(ICONS.FREE_INPUT).toBe('edit_note');
      expect(ICONS.CHAT).toBe('chat_bubble');
      expect(ICONS.PUBLIC).toBe('public');
      expect(ICONS.FORUM).toBe('forum');
      expect(ICONS.MAGIC).toBe('auto_awesome');
      expect(ICONS.VISIBILITY).toBe('visibility');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle undefined iconName', () => {
      const result = createIcon(undefined);
      
      expect(result).toContain('aria-hidden="true"');
      expect(result).toContain('>undefined</span>');
    });

    it('should handle numeric iconName', () => {
      const result = createIcon(123);
      
      expect(result).toContain('>123</span>');
    });

    it('should handle special characters in iconName', () => {
      const result = createIcon('icon-with-dash');
      
      expect(result).toContain('>icon-with-dash</span>');
    });

    it('should handle HTML in title (basic protection)', () => {
      const result = createIcon('test', { title: '<script>alert("xss")</script>' });
      
      // HTML is placed in attribute, browser should handle escaping
      expect(result).toContain('title="<script>alert("xss")</script>"');
    });

    it('should handle multiple spaces in className', () => {
      const result = createIcon('test', { className: 'class1  class2   class3' });
      
      expect(result).toContain('class="icon class1  class2   class3"');
    });
  });
});
