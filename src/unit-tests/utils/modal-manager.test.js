import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createModal } from '../../utils/modal-manager.js';

describe('Modal Manager', () => {

  beforeEach(() => {
    // Clean up document body
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a modal with default options', () => {
    const modal = createModal({
      id: 'testModal',
      className: 'test-modal',
      html: '<p>Content</p>'
    });

    expect(modal.element).toBeDefined();
    expect(modal.element.id).toBe('testModal');
    expect(modal.element.className).toBe('test-modal');
    expect(modal.element.innerHTML).toBe('<p>Content</p>');
    expect(document.body.contains(modal.element)).toBe(true);
  });

  it('wraps an existing element', () => {
    const el = document.createElement('div');
    el.id = 'existing';
    document.body.appendChild(el);

    const modal = createModal({ element: el });

    expect(modal.element).toBe(el);
    expect(document.body.contains(el)).toBe(true);
  });

  it('shows and hides the modal', () => {
    const modal = createModal();

    modal.show();
    expect(modal.element.classList.contains('show')).toBe(true);

    modal.hide();
    expect(modal.element.classList.contains('show')).toBe(false);
  });

  it('destroys the modal and removes it from DOM', () => {
    const modal = createModal();
    const element = modal.element;

    expect(document.body.contains(element)).toBe(true);

    modal.destroy();

    expect(document.body.contains(element)).toBe(false);
    expect(modal.isDestroyed).toBe(true);
  });

  it('calls onDestroy callback', () => {
    const onDestroy = vi.fn();
    const modal = createModal({ onDestroy });

    modal.destroy();
    expect(onDestroy).toHaveBeenCalled();
  });

  it('tracks and removes event listeners on destroy', () => {
    const modal = createModal({ html: '<button id="btn">Click</button>' });
    const btn = modal.element.querySelector('#btn');
    const handler = vi.fn();

    modal.addListener(btn, 'click', handler);

    // Trigger event
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);

    // Destroy modal
    modal.destroy();

    // Trigger event again (should not be handled if removed, but DOM element is removed too)
    // To verify listener removal specifically, we can check if the listener is still attached
    // or try to dispatch event if we kept a reference (though click won't bubble if detached).
    // Better: Spy on removeEventListener.

    // Re-test with spy
    const btn2 = document.createElement('button');
    document.body.appendChild(btn2); // append to body to keep it alive
    const modal2 = createModal(); // dummy modal

    const removeSpy = vi.spyOn(btn2, 'removeEventListener');
    const handler2 = vi.fn();

    modal2.addListener(btn2, 'click', handler2);
    modal2.destroy();

    expect(removeSpy).toHaveBeenCalledWith('click', handler2, false);

    // Cleanup
    if (btn2.parentNode) btn2.parentNode.removeChild(btn2);
  });

  it('supports removing specific listeners', () => {
    const modal = createModal();
    const div = document.createElement('div');
    const handler = vi.fn();

    const removeSpy = vi.spyOn(div, 'removeEventListener');

    modal.addListener(div, 'click', handler);
    modal.removeListener(div, 'click', handler);

    expect(removeSpy).toHaveBeenCalledWith('click', handler, false);
  });

  it('closes on backdrop click if enabled', () => {
    const onClose = vi.fn();
    const modal = createModal({ closeOnBackdropClick: true, onClose });

    modal.show();

    // Simulate click on modal background (element itself)
    modal.element.click();

    expect(modal.element.classList.contains('show')).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
