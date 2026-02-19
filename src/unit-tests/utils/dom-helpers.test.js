import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createElement, 
  createIcon, 
  toggleVisibility,
  toggleClass, 
  clearElement
} from '../../utils/dom-helpers.js';

describe('DOM Helpers', () => {
  describe('createElement', () => {
    it('should create element with tag', () => {
      const el = createElement('div');
      expect(el.tagName).toBe('DIV');
    });

    it('should apply single class', () => {
      const el = createElement('div', 'test-class');
      expect(el.classList.contains('test-class')).toBe(true);
    });

    it('should apply multiple classes', () => {
      const el = createElement('button', 'btn primary large');
      expect(el.classList.contains('btn')).toBe(true);
      expect(el.classList.contains('primary')).toBe(true);
      expect(el.classList.contains('large')).toBe(true);
    });

    it('should set text content', () => {
      const el = createElement('span', '', 'Hello World');
      expect(el.textContent).toBe('Hello World');
    });

    it('should create with class and text', () => {
      const el = createElement('h1', 'title', 'My Title');
      expect(el.tagName).toBe('H1');
      expect(el.classList.contains('title')).toBe(true);
      expect(el.textContent).toBe('My Title');
    });

    it('should handle empty class string', () => {
      const el = createElement('div', '', 'Text only');
      expect(el.className).toBe('');
      expect(el.textContent).toBe('Text only');
    });

    it('should handle empty text content', () => {
      const el = createElement('div', 'test-class', '');
      expect(el.textContent).toBe('');
    });

    it('should handle only tag parameter', () => {
      const el = createElement('section');
      expect(el.tagName).toBe('SECTION');
      expect(el.className).toBe('');
      expect(el.textContent).toBe('');
    });

    it('should handle numeric text content', () => {
      const el = createElement('span', '', '0');
      expect(el.textContent).toBe('0');
    });
  });

  describe('createIcon', () => {
    it('should create icon element with default values', () => {
      const icon = createIcon('check');
      
      expect(icon.tagName).toBe('SPAN');
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.textContent).toBe('check');
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('should add single class from array', () => {
      const icon = createIcon('star', ['favorite']);
      
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.classList.contains('favorite')).toBe(true);
    });

    it('should add multiple classes from array', () => {
      const icon = createIcon('alert', ['warning', 'urgent', 'large']);
      
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.classList.contains('warning')).toBe(true);
      expect(icon.classList.contains('urgent')).toBe(true);
      expect(icon.classList.contains('large')).toBe(true);
    });

    it('should add single class from string', () => {
      const icon = createIcon('info', 'tooltip');
      
      expect(icon.classList.contains('icon')).toBe(true);
      expect(icon.classList.contains('tooltip')).toBe(true);
    });

    it('should not add class from empty string', () => {
      const icon = createIcon('home', '');
      
      expect(icon.className).toBe('icon');
    });

    it('should handle empty classes array', () => {
      const icon = createIcon('menu', []);
      
      expect(icon.className).toBe('icon');
    });

    it('should set aria-hidden to false when specified', () => {
      const icon = createIcon('accessible', [], false);
      
      expect(icon.hasAttribute('aria-hidden')).toBe(false);
    });

    it('should set aria-hidden to true by default', () => {
      const icon = createIcon('default');
      
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('toggleVisibility', () => {
    it('should show element by default', () => {
      const el = document.createElement('div');
      el.classList.add('hidden');
      toggleVisibility(el);
      expect(el.classList.contains('hidden')).toBe(false);
    });

    it('should show element when shouldShow=true', () => {
      const el = document.createElement('div');
      el.classList.add('hidden');
      toggleVisibility(el, true);
      expect(el.classList.contains('hidden')).toBe(false);
    });

    it('should hide element when shouldShow=false', () => {
      const el = document.createElement('div');
      toggleVisibility(el, false);
      expect(el.classList.contains('hidden')).toBe(true);
    });

    it('should handle null element', () => {
      expect(() => toggleVisibility(null)).not.toThrow();
    });
  });

  describe('toggleClass', () => {
    it('should toggle class without force', () => {
      const el = document.createElement('div');
      
      toggleClass(el, 'active');
      expect(el.classList.contains('active')).toBe(true);
      
      toggleClass(el, 'active');
      expect(el.classList.contains('active')).toBe(false);
    });

    it('should add class when force=true', () => {
      const el = document.createElement('div');
      
      toggleClass(el, 'active', true);
      expect(el.classList.contains('active')).toBe(true);
      
      toggleClass(el, 'active', true);
      expect(el.classList.contains('active')).toBe(true);
    });

    it('should remove class when force=false', () => {
      const el = document.createElement('div');
      el.classList.add('active');
      
      toggleClass(el, 'active', false);
      expect(el.classList.contains('active')).toBe(false);
      
      toggleClass(el, 'active', false);
      expect(el.classList.contains('active')).toBe(false);
    });
  });

  describe('clearElement', () => {
    beforeEach(() => {
      document.body.innerHTML = '<div id="parent"><span>Child 1</span><span>Child 2</span></div>';
    });

    it('should remove all children', () => {
      const parent = document.getElementById('parent');
      expect(parent.children.length).toBe(2);

      clearElement(parent);

      expect(parent.children.length).toBe(0);
      expect(parent.innerHTML).toBe('');
    });

    it('should handle empty parent', () => {
      const parent = document.createElement('div');

      clearElement(parent);

      expect(parent.children.length).toBe(0);
    });

    it('should remove deeply nested children', () => {
      const parent = document.createElement('div');
      const child1 = document.createElement('div');
      const grandchild = document.createElement('span');
      const child2 = document.createElement('p');
      
      child1.appendChild(grandchild);
      parent.appendChild(child1);
      parent.appendChild(child2);
      
      expect(parent.children.length).toBe(2);
      
      clearElement(parent);
      
      expect(parent.children.length).toBe(0);
    });

    it('should remove text nodes', () => {
      const parent = document.createElement('div');
      parent.appendChild(document.createTextNode('Text 1'));
      parent.appendChild(document.createElement('span'));
      parent.appendChild(document.createTextNode('Text 2'));
      
      clearElement(parent);
      
      expect(parent.childNodes.length).toBe(0);
    });
  });

});
