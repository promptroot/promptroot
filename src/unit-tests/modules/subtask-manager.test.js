import { describe, it, expect } from 'vitest';
import {
  extractTaskStubs,
  extractManualSplits,
  extractNumberedTasks,
  analyzePromptStructure,
  validateSubtasks,
  buildSubtaskSequence,
  generateSplitSummary
} from '../../modules/subtask-manager.js';

describe('subtask-manager.js', () => {
  // 1. extractTaskStubs
  describe('extractTaskStubs', () => {
    it('should extract valid task-stub blocks', () => {
      const text = `
        Some intro.
        :::task-stub{title="Task 1"}
        Content 1
        :::
        :::task-stub{title="Task 2"}
        Content 2
        :::
      `;
      const stubs = extractTaskStubs(text);
      expect(stubs).toHaveLength(2);
      expect(stubs[0]).toEqual({ title: 'Task 1', content: 'Content 1' });
      expect(stubs[1]).toEqual({ title: 'Task 2', content: 'Content 2' });
    });

    it('should handle nested content correctly', () => {
      const text = `
        :::task-stub{title="Nested"}
        Line 1
        Line 2
        :::
      `;
      const stubs = extractTaskStubs(text);
      expect(stubs[0].content).toBe('Line 1\n        Line 2');
    });

    it('should return empty array for empty input', () => {
      expect(extractTaskStubs('')).toEqual([]);
    });

    it('should handle malformed delimiters gracefully', () => {
      const text = `
        :::task-stub{title="Broken"
        Missing closing brace
        :::
      `;
      // The regex requires matches to close correctly
      expect(extractTaskStubs(text)).toEqual([]);
    });

    it('should return array of 1 for single stub', () => {
      const text = `:::task-stub{title="Single"}Content:::`;
      const stubs = extractTaskStubs(text);
      expect(stubs).toHaveLength(1);
      expect(stubs[0]).toEqual({ title: 'Single', content: 'Content' });
    });
  });

  // 2. extractManualSplits
  describe('extractManualSplits', () => {
    it('should split by multiple --- separators', () => {
      const text = `
Section 1
---
Section 2
---
Section 3
      `.trim();
      const splits = extractManualSplits(text);
      expect(splits).toHaveLength(3);
      expect(splits[0].content).toContain('Section 1');
      expect(splits[1].content).toContain('Section 2');
      expect(splits[2].content).toContain('Section 3');
    });

    it('should return empty for single section', () => {
      const text = `Just one block of text without separators`;
      expect(extractManualSplits(text)).toEqual([]);
    });

    it('should use headings as titles', () => {
      const text = `
# First Part
Content here
---
## Second Part
More content
      `.trim();
      const splits = extractManualSplits(text);
      // The implementation uses the first line of the split part
      // Note: the split consumes the --- lines.
      // The implementation splits by /^---+$/m
      // Wait, if text starts with \n, the first part might be empty?
      // implementation filters p => p.length > 0

      expect(splits[0].title).toBe('First Part');
      expect(splits[1].title).toBe('Second Part');
    });

    it('should handle content without headings', () => {
      const text = `
Just text
---
More text
      `.trim();
      const splits = extractManualSplits(text);
      // It uses firstLine.substring(0, 50) if no #
      expect(splits[0].title).toBe('Just text');
    });
  });

  // 3. extractNumberedTasks
  describe('extractNumberedTasks', () => {
    it('should extract sequential numbering', () => {
      const text = `
Task 1: Do this
Details 1
Task 2: Do that
Details 2
      `.trim();
      const tasks = extractNumberedTasks(text);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].number).toBe(1);
      expect(tasks[1].number).toBe(2);
    });

    it('should handle gaps in numbering', () => {
      const text = `
Task 1: First
Content 1
Task 3: Third
Content 3
      `.trim();
      const tasks = extractNumberedTasks(text);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].number).toBe(1);
      expect(tasks[1].number).toBe(3);
    });

    it('should handle duplicate numbers', () => {
       const text = `
Task 1: First
Content 1
Task 1: Duplicate
Content 2
      `.trim();
       const tasks = extractNumberedTasks(text);
       expect(tasks).toHaveLength(2);
       expect(tasks[0].number).toBe(1);
       expect(tasks[1].number).toBe(1);
    });

    it('should handle content spanning multiple lines per task', () => {
      const text = `
Task 1: Multi line
Line 1
Line 2

Task 2: Next
      `.trim();
      const tasks = extractNumberedTasks(text);
      expect(tasks[0].content).toBe('Line 1\nLine 2');
    });
  });

  // 4. analyzePromptStructure
  describe('analyzePromptStructure', () => {
    it('should prioritize task-stubs', () => {
      const text = `
        :::task-stub{title="T1"}C1:::
        :::task-stub{title="T2"}C2:::
Task 1: Ignore me
Task 2: Ignore me
      `;
      const result = analyzePromptStructure(text);
      expect(result.strategy).toBe('task-stubs');
    });

    it('should fallback to manual-splits if no stubs', () => {
      const text = `
Part 1
---
Part 2
      `.trim();
      const result = analyzePromptStructure(text);
      expect(result.strategy).toBe('manual-splits');
    });

    it('should fallback to numbered-tasks', () => {
      const text = `
Task 1: One
Content 1
Task 2: Two
Content 2
      `.trim();
      const result = analyzePromptStructure(text);
      expect(result.strategy).toBe('numbered-tasks');
    });

    it('should fallback to paragraphs if long enough', () => {
      const text = `
        P1

        P2

        P3

        P4
      `;
      const result = analyzePromptStructure(text);
      expect(result.strategy).toBe('paragraph-based');
    });

    it('should return none for mixed formats that do not meet thresholds or empty input', () => {
      expect(analyzePromptStructure('').strategy).toBe('none');
      // Single task stub -> not enough (needs > 1)
      expect(analyzePromptStructure(':::task-stub{title="T1"}C1:::').strategy).toBe('none');
    });
  });

  // 5. validateSubtasks
  describe('validateSubtasks', () => {
    it('should return error for empty array', () => {
      const result = validateSubtasks([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No subtasks selected');
    });

    it('should return error for subtask with empty content', () => {
      const result = validateSubtasks([{ title: 'T1', content: '' }]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Subtask 1 is empty');
    });

    it('should warn for subtask exceeding 10000 chars', () => {
      const longContent = 'a'.repeat(10001);
      const result = validateSubtasks([{ title: 'T1', content: longContent }]);
      expect(result.valid).toBe(true); // Warnings don't invalidate
      expect(result.warnings[0]).toContain('very large');
    });

    it('should warn for more than 20 subtasks', () => {
      const tasks = Array(21).fill({ title: 'T', content: 'C' });
      const result = validateSubtasks(tasks);
      expect(result.valid).toBe(true);
      expect(result.warnings[0]).toContain('Many subtasks');
    });
  });

  // 6. buildSubtaskSequence
  describe('buildSubtaskSequence', () => {
    it('should add sequence info', () => {
      const tasks = [
        { title: 'T1', content: 'C1' },
        { title: 'T2', content: 'C2' }
      ];
      const result = buildSubtaskSequence('full', tasks);
      expect(result[0].sequenceInfo).toEqual({ current: 1, total: 2 });
      expect(result[1].sequenceInfo).toEqual({ current: 2, total: 2 });
    });

    it('should prepend title if content does not start with it', () => {
      const tasks = [{ title: 'My Task', content: 'Do something' }];
      const result = buildSubtaskSequence('', tasks);
      expect(result[0].fullContent).toBe('My Task\n\nDo something');
    });

    it('should not prepend title if content already starts with it', () => {
      const tasks = [{ title: 'My Task', content: 'My Task\nDo something' }];
      const result = buildSubtaskSequence('', tasks);
      expect(result[0].fullContent).toBe('My Task\nDo something');
    });
  });

  // 7. generateSplitSummary
  describe('generateSplitSummary', () => {
    it('should return correct summary stats', () => {
      const tasks = [
        { title: 'T1', content: 'Line 1\nLine 2' },
        { title: 'T2', content: 'Line 1' }
      ];
      const summary = generateSplitSummary(tasks);
      expect(summary.totalSubtasks).toBe(2);
      expect(summary.estimatedMinutes).toBe(10); // 2 * 5
      expect(summary.breakdown[0].lines).toBe(2);
      expect(summary.breakdown[1].lines).toBe(1);
    });
  });
});
