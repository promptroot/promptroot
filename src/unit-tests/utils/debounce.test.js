import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from '../../utils/debounce.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();

    // Should not be called immediately
    expect(func).not.toHaveBeenCalled();

    // Should be called after wait time
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should call function only once when called multiple times within wait period', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    debouncedFunc();
    debouncedFunc();

    // Should not be called yet
    expect(func).not.toHaveBeenCalled();

    // Should be called only once after wait time
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on each call', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    debouncedFunc();
    vi.advanceTimersByTime(50);

    // Should not be called yet (timer was reset)
    expect(func).not.toHaveBeenCalled();

    // Should be called after full wait time from last call
    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the debounced function', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('arg1', 'arg2', 123);

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledWith('arg1', 'arg2', 123);
  });

  it('should use arguments from the last call', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('first');
    debouncedFunc('second');
    debouncedFunc('third');

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('third');
  });

  it('should preserve this context', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    const obj = {
      value: 'test',
      method: debouncedFunc
    };

    obj.method();

    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledTimes(1);
    expect(func.mock.contexts[0]).toBe(obj);
  });

  it('should allow multiple debounced functions to work independently', () => {
    const func1 = vi.fn();
    const func2 = vi.fn();
    const debouncedFunc1 = debounce(func1, 100);
    const debouncedFunc2 = debounce(func2, 200);

    debouncedFunc1();
    debouncedFunc2();

    // After 100ms, only func1 should be called
    vi.advanceTimersByTime(100);
    expect(func1).toHaveBeenCalledTimes(1);
    expect(func2).not.toHaveBeenCalled();

    // After another 100ms (200ms total), func2 should be called
    vi.advanceTimersByTime(100);
    expect(func1).toHaveBeenCalledTimes(1);
    expect(func2).toHaveBeenCalledTimes(1);
  });

  it('should handle different wait times', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 500);

    debouncedFunc();

    vi.advanceTimersByTime(400);
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should handle zero wait time', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 0);

    debouncedFunc();

    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should allow calling debounced function multiple times after execution', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    // First call
    debouncedFunc('first');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledWith('first');

    // Second call
    debouncedFunc('second');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(2);
    expect(func).toHaveBeenCalledWith('second');

    // Third call
    debouncedFunc('third');
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(3);
    expect(func).toHaveBeenCalledWith('third');
  });

  it('should handle functions that return values', () => {
    const func = vi.fn(() => 'result');
    const debouncedFunc = debounce(func, 100);

    debouncedFunc();
    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalled();
    expect(func()).toBe('result');
  });

  it('should clear pending timer when called again', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 100);

    debouncedFunc('first');
    vi.advanceTimersByTime(90);
    
    debouncedFunc('second');
    vi.advanceTimersByTime(90);
    
    // First call should have been cancelled
    expect(func).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(10);
    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('second');
  });
});
