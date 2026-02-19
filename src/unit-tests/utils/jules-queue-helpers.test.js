import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  parseDateInTimeZone,
  getCommonTimeZones,
  sortByCreatedAt,
  formatScheduledDate,
  calculateProgress,
  validateSchedule,
  cleanIdForDOM,
  combineSubtasksToPrompt
} from '../../utils/jules-queue-helpers.js';

describe('Jules Queue Helpers', () => {

  describe('parseDateInTimeZone', () => {
    it('should parse valid ISO datetime string with UTC', () => {
      const result = parseDateInTimeZone('2023-10-27T12:00:00', 'UTC');
      expect(result.toISOString()).toBe('2023-10-27T12:00:00.000Z');
    });

    it('should parse valid ISO datetime string with US/Pacific', () => {
      // 12:00 Pacific is 19:00 UTC (assuming daylight savings or standard time correctly handled by system)
      // Since specific offset depends on date (DST), let's pick a date in standard time (e.g., Jan)
      // 2023-01-01 12:00 PST -> 20:00 UTC
      const result = parseDateInTimeZone('2023-01-01T12:00:00', 'America/Los_Angeles');
      // expected: 2023-01-01T20:00:00.000Z
      expect(result.toISOString()).toBe('2023-01-01T20:00:00.000Z');
    });

    it('should throw error for invalid date format', () => {
      expect(() => parseDateInTimeZone('invalid-date', 'UTC')).toThrow('Invalid date format');
    });

    it('should handle boundary dates (midnight)', () => {
      const result = parseDateInTimeZone('2023-01-01T00:00:00', 'UTC');
      expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should handle boundary dates (year-end)', () => {
        const result = parseDateInTimeZone('2023-12-31T23:59:59', 'UTC');
        expect(result.toISOString()).toBe('2023-12-31T23:59:59.000Z');
    });
  });

  describe('getCommonTimeZones', () => {
    it('should return a non-empty array', () => {
      const zones = getCommonTimeZones();
      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);
    });

    it('should have value and label properties for all entries', () => {
      const zones = getCommonTimeZones();
      zones.forEach(zone => {
        expect(zone).toHaveProperty('value');
        expect(zone).toHaveProperty('label');
      });
    });

    it('should include UTC', () => {
      const zones = getCommonTimeZones();
      const utc = zones.find(z => z.value === 'UTC');
      expect(utc).toBeDefined();
    });
  });

  describe('sortByCreatedAt', () => {
    const queueCache = [
      { id: '1', createdAt: { seconds: 1000 } },
      { id: '2', createdAt: { seconds: 2000 } },
      { id: '3', createdAt: { seconds: 500 } }, // earliest
      { id: '4' } // missing createdAt
    ];

    it('should sort in ascending order based on createdAt', () => {
      const ids = ['1', '2', '3'];
      const sorted = sortByCreatedAt(ids, queueCache);
      expect(sorted).toEqual(['3', '1', '2']);
    });

    it('should sort missing timestamps to the start', () => {
      const ids = ['1', '4'];
      const sorted = sortByCreatedAt(ids, queueCache);
      expect(sorted).toEqual(['4', '1']);
    });

    it('should return empty array if input is empty', () => {
      const sorted = sortByCreatedAt([], queueCache);
      expect(sorted).toEqual([]);
    });
  });

  describe('formatScheduledDate', () => {
    it('should format valid Firestore timestamp object', () => {
      const timestamp = { seconds: 1672531200 }; // 2023-01-01T00:00:00Z
      // In UTC: Jan 1, 2023, 12:00 AM
      const formatted = formatScheduledDate(timestamp, 'UTC');
      expect(formatted).toContain('Jan 1, 2023');
      expect(formatted).toContain('12:00 AM');
    });

    it('should return empty string for null input', () => {
      expect(formatScheduledDate(null, 'UTC')).toBe('');
    });

    it('should respect timezone formatting', () => {
        const timestamp = { seconds: 1672531200 }; // 2023-01-01T00:00:00Z
        // In Los Angeles (PST): Dec 31, 2022, 4:00 PM
        const formatted = formatScheduledDate(timestamp, 'America/Los_Angeles');
        expect(formatted).toContain('Dec 31, 2022');
        expect(formatted).toContain('04:00 PM');
    });
  });

  describe('calculateProgress', () => {
    it('should return 100 if total is zero', () => {
      expect(calculateProgress(0, 0)).toBe(100);
      expect(calculateProgress(5, 0)).toBe(100);
    });

    it('should calculate normal ratio correctly', () => {
      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(1, 3)).toBe(33); // 33.33... -> 33
      expect(calculateProgress(2, 3)).toBe(67); // 66.66... -> 67
    });

    it('should handle done exceeding total', () => {
      expect(calculateProgress(15, 10)).toBe(150);
    });
  });

  describe('validateSchedule', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return valid for future date', () => {
      const now = new Date('2023-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const future = new Date('2023-01-01T13:00:00Z');
      const result = validateSchedule(future);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return invalid for past date', () => {
      const now = new Date('2023-01-01T12:00:00Z');
      vi.setSystemTime(now);

      const past = new Date('2023-01-01T11:00:00Z');
      const result = validateSchedule(past);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Scheduled time must be in the future');
    });

    it('should return invalid for date exactly now', () => {
        // Technically "now" is treated as past if check is < (less than) strictly?
        // Wait, implementation is: if (scheduledDate < now)
        // If they are equal, it is NOT less than, so it is valid.
        // But user request says "date exactly now is invalid".
        // Let's check implementation again.
        // implementation: if (scheduledDate < now) return { valid: false ... }
        // So scheduledDate >= now is valid.
        // If user wants "exactly now is invalid", then implementation might be wrong or my interpretation.
        // "7. Test validateSchedule: ... date exactly now is invalid"
        // I should stick to the user's requirement. If the test fails, I might need to update the implementation or verify the implementation behavior.
        // But the task is "Create unit tests", implying the code is already there.
        // If the code allows "now", then the test "should be invalid" will fail.
        // Let's assume the user wants me to test the *current behavior* or *expected behavior*.
        // If implementation is `scheduledDate < now`, then `scheduledDate == now` returns valid.
        // Let's verify the implementation.
        // `if (scheduledDate < now)` -> equal is valid.

        // I will write the test to expect what the user asked ("invalid"), and if it fails, I'll see.
        // Wait, if I am just adding tests, I should match the implementation unless I am supposed to fix bugs.
        // The user prompt is "Create unit tests...".
        // If I write a test that expects failure and the code passes, the test fails.
        // I will test a date slightly in the past just to be sure, or check the boundary condition.
        // "date exactly now is invalid" -> This implies `scheduledDate <= now` logic.
        // But the code says `<`.
        // I will write the test to expect `valid: true` for "now" if that's what the code does, OR expect `valid: false` if I think the code is intended to forbid it.
        // However, "Test validateSchedule: ... date exactly now is invalid" is a specific instruction.
        // I will write the test expecting `false`. If it fails, I will know the code allows it.
        // Actually, usually you can't schedule for "now" because "now" becomes "past" immediately.
        // Let's write the test as requested.

        const now = new Date('2023-01-01T12:00:00Z');
        vi.setSystemTime(now);

        const result = validateSchedule(now);
        // Based on user instruction, expected: invalid.
        // Based on code: valid.
        // I will follow user instruction.
        expect(result.valid).toBe(false);
    });
  });

  describe('cleanIdForDOM', () => {
    it('should remove special characters', () => {
      expect(cleanIdForDOM('abc@def#ghi')).toBe('abc_def_ghi');
    });

    it('should preserve alphanumeric characters', () => {
      expect(cleanIdForDOM('abc123XYZ')).toBe('abc123XYZ');
    });

    it('should handle empty string', () => {
      expect(cleanIdForDOM('')).toBe('');
    });
  });

  describe('combineSubtasksToPrompt', () => {
    it('should join subtasks with separator', () => {
      const subtasks = [
        { fullContent: 'Task 1' },
        { fullContent: 'Task 2' }
      ];
      expect(combineSubtasksToPrompt(subtasks)).toBe('Task 1\n\n---\n\nTask 2');
    });

    it('should handle empty fullContent', () => {
        const subtasks = [
            { fullContent: 'Task 1' },
            { fullContent: '' },
            { prompt: 'Task 3' } // fallback to prompt
        ];
        expect(combineSubtasksToPrompt(subtasks)).toBe('Task 1\n\n---\n\n\n\n---\n\nTask 3');
    });

    it('should handle single subtask', () => {
        const subtasks = [{ fullContent: 'Single Task' }];
        expect(combineSubtasksToPrompt(subtasks)).toBe('Single Task');
    });
  });
});
