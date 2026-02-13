import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerHandler, getHandler, clearHandlers } from '../../utils/handler-registry.js';

describe('handler-registry', () => {
  beforeEach(() => {
    clearHandlers('test');
    clearHandlers('other');
  });

  it('should register and retrieve a handler', () => {
    const fn = vi.fn();
    registerHandler('test', 'key1', fn);

    const retrieved = getHandler('test', 'key1');
    expect(retrieved).toBe(fn);
  });

  it('should return undefined for non-existent handler', () => {
    const retrieved = getHandler('test', 'nonexistent');
    expect(retrieved).toBeUndefined();
  });

  it('should overwrite existing handler with same key', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    registerHandler('test', 'key1', fn1);
    registerHandler('test', 'key1', fn2);

    const retrieved = getHandler('test', 'key1');
    expect(retrieved).toBe(fn2);
  });

  it('should clear handlers for a specific namespace', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    registerHandler('test', 'key1', fn1);
    registerHandler('test', 'key2', fn2);

    clearHandlers('test');

    expect(getHandler('test', 'key1')).toBeUndefined();
    expect(getHandler('test', 'key2')).toBeUndefined();
  });

  it('should not clear handlers from other namespaces', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    registerHandler('test', 'key1', fn1);
    registerHandler('other', 'key1', fn2);

    clearHandlers('test');

    expect(getHandler('test', 'key1')).toBeUndefined();
    expect(getHandler('other', 'key1')).toBe(fn2);
  });

  it('should warn and not register if arguments are invalid', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registerHandler(null, 'key', () => {});
    expect(consoleSpy).toHaveBeenCalled();

    registerHandler('test', null, () => {});
    expect(consoleSpy).toHaveBeenCalled();

    registerHandler('test', 'key', 'not a function');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
