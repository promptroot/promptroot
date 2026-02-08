import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initMutualExclusivity } from '../../utils/checkbox-helpers.js';

describe('checkbox-helpers', () => {
  let container;

  beforeEach(() => {
    // Create a container for our test checkboxes
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  describe('initMutualExclusivity', () => {
    it('should allow only one checkbox to be checked in a group', () => {
      container.innerHTML = `
        <input type="checkbox" id="cb1" data-exclusive-group="group1" />
        <input type="checkbox" id="cb2" data-exclusive-group="group1" />
        <input type="checkbox" id="cb3" data-exclusive-group="group1" />
      `;

      initMutualExclusivity();

      const cb1 = document.getElementById('cb1');
      const cb2 = document.getElementById('cb2');
      const cb3 = document.getElementById('cb3');

      // Check first checkbox
      cb1.checked = true;
      cb1.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(true);
      expect(cb2.checked).toBe(false);
      expect(cb3.checked).toBe(false);

      // Check second checkbox
      cb2.checked = true;
      cb2.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(false);
      expect(cb2.checked).toBe(true);
      expect(cb3.checked).toBe(false);

      // Check third checkbox
      cb3.checked = true;
      cb3.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(false);
      expect(cb2.checked).toBe(false);
      expect(cb3.checked).toBe(true);
    });

    it('should handle multiple independent groups', () => {
      container.innerHTML = `
        <input type="checkbox" id="g1-cb1" data-exclusive-group="group1" />
        <input type="checkbox" id="g1-cb2" data-exclusive-group="group1" />
        <input type="checkbox" id="g2-cb1" data-exclusive-group="group2" />
        <input type="checkbox" id="g2-cb2" data-exclusive-group="group2" />
      `;

      initMutualExclusivity();

      const g1cb1 = document.getElementById('g1-cb1');
      const g1cb2 = document.getElementById('g1-cb2');
      const g2cb1 = document.getElementById('g2-cb1');
      const g2cb2 = document.getElementById('g2-cb2');

      // Check one checkbox in each group
      g1cb1.checked = true;
      g1cb1.dispatchEvent(new Event('change'));
      g2cb1.checked = true;
      g2cb1.dispatchEvent(new Event('change'));

      expect(g1cb1.checked).toBe(true);
      expect(g1cb2.checked).toBe(false);
      expect(g2cb1.checked).toBe(true);
      expect(g2cb2.checked).toBe(false);

      // Check second checkbox in group 1, shouldn't affect group 2
      g1cb2.checked = true;
      g1cb2.dispatchEvent(new Event('change'));

      expect(g1cb1.checked).toBe(false);
      expect(g1cb2.checked).toBe(true);
      expect(g2cb1.checked).toBe(true);
      expect(g2cb2.checked).toBe(false);
    });

    it('should allow unchecking without checking another', () => {
      container.innerHTML = `
        <input type="checkbox" id="cb1" data-exclusive-group="group1" />
        <input type="checkbox" id="cb2" data-exclusive-group="group1" />
      `;

      initMutualExclusivity();

      const cb1 = document.getElementById('cb1');
      const cb2 = document.getElementById('cb2');

      // Check first checkbox
      cb1.checked = true;
      cb1.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(true);

      // Manually uncheck (without checking another)
      cb1.checked = false;
      cb1.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(false);
      expect(cb2.checked).toBe(false);
    });

    it('should not affect checkboxes without data-exclusive-group', () => {
      container.innerHTML = `
        <input type="checkbox" id="cb1" data-exclusive-group="group1" />
        <input type="checkbox" id="cb2" data-exclusive-group="group1" />
        <input type="checkbox" id="regular" />
      `;

      initMutualExclusivity();

      const cb1 = document.getElementById('cb1');
      const cb2 = document.getElementById('cb2');
      const regular = document.getElementById('regular');

      // Check exclusive group checkbox
      cb1.checked = true;
      cb1.dispatchEvent(new Event('change'));

      // Check regular checkbox
      regular.checked = true;
      regular.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(true);
      expect(cb2.checked).toBe(false);
      expect(regular.checked).toBe(true);

      // Check another exclusive checkbox shouldn't affect regular
      cb2.checked = true;
      cb2.dispatchEvent(new Event('change'));

      expect(cb1.checked).toBe(false);
      expect(cb2.checked).toBe(true);
      expect(regular.checked).toBe(true);
    });

    it('should handle single checkbox in a group', () => {
      container.innerHTML = `
        <input type="checkbox" id="solo" data-exclusive-group="solo-group" />
      `;

      initMutualExclusivity();

      const solo = document.getElementById('solo');

      // Should work normally even with just one checkbox
      solo.checked = true;
      solo.dispatchEvent(new Event('change'));

      expect(solo.checked).toBe(true);

      solo.checked = false;
      solo.dispatchEvent(new Event('change'));

      expect(solo.checked).toBe(false);
    });

    it('should handle no checkboxes with exclusive groups', () => {
      container.innerHTML = `
        <input type="checkbox" id="regular1" />
        <input type="checkbox" id="regular2" />
      `;

      // Should not throw an error
      expect(() => {
        initMutualExclusivity();
      }).not.toThrow();
    });

    it('should handle dynamically checking multiple at once', () => {
      container.innerHTML = `
        <input type="checkbox" id="cb1" data-exclusive-group="group1" />
        <input type="checkbox" id="cb2" data-exclusive-group="group1" />
        <input type="checkbox" id="cb3" data-exclusive-group="group1" />
      `;

      initMutualExclusivity();

      const cb1 = document.getElementById('cb1');
      const cb2 = document.getElementById('cb2');
      const cb3 = document.getElementById('cb3');

      // Manually check all (before change event)
      cb1.checked = true;
      cb2.checked = true;
      cb3.checked = true;

      // Now trigger change on cb2
      cb2.dispatchEvent(new Event('change'));

      // cb2 should be checked, others should be unchecked
      expect(cb1.checked).toBe(false);
      expect(cb2.checked).toBe(true);
      expect(cb3.checked).toBe(false);
    });
  });
});
