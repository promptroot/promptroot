import { describe, it, expect } from 'vitest';
import {
  PromptTemplate,
  validateAssetName,
  assetNameToFilename,
  generatePromptContent,
  getAvailableTemplates,
  templateFromLabel,
} from './templates';

describe('templates', () => {
  describe('validateAssetName', () => {
    it('should accept valid names', () => {
      expect(validateAssetName('Valid Name')).toBeUndefined();
      expect(validateAssetName('Test-Prompt-123')).toBeUndefined();
      expect(validateAssetName('Simple')).toBeUndefined();
    });

    it('should reject empty names', () => {
      expect(validateAssetName('')).toBe('Name cannot be empty');
      expect(validateAssetName('   ')).toBe('Name cannot be empty');
    });

    it('should reject names with invalid characters', () => {
      expect(validateAssetName('Test/Name')).toContain('invalid characters');
      expect(validateAssetName('Test:Name')).toContain('invalid characters');
      expect(validateAssetName('Test<Name')).toContain('invalid characters');
      expect(validateAssetName('Test>Name')).toContain('invalid characters');
      expect(validateAssetName('Test"Name')).toContain('invalid characters');
      expect(validateAssetName('Test\\Name')).toContain('invalid characters');
      expect(validateAssetName('Test|Name')).toContain('invalid characters');
      expect(validateAssetName('Test?Name')).toContain('invalid characters');
      expect(validateAssetName('Test*Name')).toContain('invalid characters');
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101);
      expect(validateAssetName(longName)).toContain('too long');
    });

    it('should accept names at maximum length', () => {
      const maxName = 'a'.repeat(100);
      expect(validateAssetName(maxName)).toBeUndefined();
    });
  });

  describe('assetNameToFilename', () => {
    it('should convert spaces to hyphens', () => {
      expect(assetNameToFilename('My Awesome Prompt')).toBe('my-awesome-prompt.md');
    });

    it('should convert to lowercase', () => {
      expect(assetNameToFilename('UPPERCASE')).toBe('uppercase.md');
      expect(assetNameToFilename('MixedCase')).toBe('mixedcase.md');
    });

    it('should remove special characters', () => {
      expect(assetNameToFilename('Test!@#$%Prompt')).toBe('testprompt.md');
      expect(assetNameToFilename('Prompt (v2)')).toBe('prompt-v2.md');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(assetNameToFilename('Test   Multiple   Spaces')).toBe('test-multiple-spaces.md');
    });

    it('should trim whitespace', () => {
      expect(assetNameToFilename('  Padded Name  ')).toBe('padded-name.md');
    });

    it('should add .md extension', () => {
      expect(assetNameToFilename('Simple')).toBe('simple.md');
    });

    it('should handle numbers and hyphens', () => {
      expect(assetNameToFilename('Task-123')).toBe('task-123.md');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return array of template options', () => {
      const templates = getAvailableTemplates();
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBe(3);
    });

    it('should include all template types', () => {
      const templates = getAvailableTemplates();
      const labels = templates.map(t => t.label);
      expect(labels).toContain('Basic Prompt');
      expect(labels).toContain('Task Prompt');
      expect(labels).toContain('Tutorial Prompt');
    });

    it('should have required QuickPickItem properties', () => {
      const templates = getAvailableTemplates();
      templates.forEach(template => {
        expect(template).toHaveProperty('label');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('detail');
      });
    });
  });

  describe('templateFromLabel', () => {
    it('should map Basic Prompt to Basic', () => {
      expect(templateFromLabel('Basic Prompt')).toBe(PromptTemplate.Basic);
    });

    it('should map Task Prompt to Task', () => {
      expect(templateFromLabel('Task Prompt')).toBe(PromptTemplate.Task);
    });

    it('should map Tutorial Prompt to Tutorial', () => {
      expect(templateFromLabel('Tutorial Prompt')).toBe(PromptTemplate.Tutorial);
    });

    it('should default to Basic for unknown labels', () => {
      expect(templateFromLabel('Unknown')).toBe(PromptTemplate.Basic);
      expect(templateFromLabel('')).toBe(PromptTemplate.Basic);
    });
  });

  describe('generatePromptContent', () => {
    const mockMetadata = {
      name: 'Test Prompt',
      description: 'Test description',
      category: 'Testing',
      author: 'Test Author',
    };

    describe('Basic template', () => {
      it('should include metadata in header', () => {
        const content = generatePromptContent(PromptTemplate.Basic, mockMetadata);
        expect(content).toContain('# Test Prompt');
        expect(content).toContain('**Description:** Test description');
        expect(content).toContain('**Category:** Testing');
        expect(content).toContain('**Author:** Test Author');
      });

      it('should include date in ISO format', () => {
        const content = generatePromptContent(PromptTemplate.Basic, mockMetadata);
        expect(content).toMatch(/\*\*Created:\*\* \d{4}-\d{2}-\d{2}/);
      });

      it('should include standard sections', () => {
        const content = generatePromptContent(PromptTemplate.Basic, mockMetadata);
        expect(content).toContain('## Prompt');
        expect(content).toContain('## Example Usage');
        expect(content).toContain('## Expected Output');
        expect(content).toContain('## Notes');
      });
    });

    describe('Task template', () => {
      it('should include metadata in header', () => {
        const content = generatePromptContent(PromptTemplate.Task, mockMetadata);
        expect(content).toContain('# Test Prompt');
        expect(content).toContain('**Description:** Test description');
      });

      it('should include task-specific sections', () => {
        const content = generatePromptContent(PromptTemplate.Task, mockMetadata);
        expect(content).toContain('## Objective');
        expect(content).toContain('## Prerequisites');
        expect(content).toContain('## Steps');
        expect(content).toContain('## Expected Results');
        expect(content).toContain('## Verification');
        expect(content).toContain('## Troubleshooting');
        expect(content).toContain('## References');
      });

      it('should include placeholder steps', () => {
        const content = generatePromptContent(PromptTemplate.Task, mockMetadata);
        expect(content).toContain('1. [Step 1]');
        expect(content).toContain('2. [Step 2]');
        expect(content).toContain('3. [Step 3]');
      });
    });

    describe('Tutorial template', () => {
      it('should include metadata in header', () => {
        const content = generatePromptContent(PromptTemplate.Tutorial, mockMetadata);
        expect(content).toContain('# Test Prompt');
        expect(content).toContain('**Description:** Test description');
      });

      it('should include tutorial-specific sections', () => {
        const content = generatePromptContent(PromptTemplate.Tutorial, mockMetadata);
        expect(content).toContain('## Overview');
        expect(content).toContain('## Learning Objectives');
        expect(content).toContain('## Prerequisites');
        expect(content).toContain('## Tutorial');
        expect(content).toContain('## Summary');
        expect(content).toContain('## Next Steps');
        expect(content).toContain('## Additional Resources');
      });

      it('should include tutorial parts', () => {
        const content = generatePromptContent(PromptTemplate.Tutorial, mockMetadata);
        expect(content).toContain('### Part 1:');
        expect(content).toContain('### Part 2:');
        expect(content).toContain('### Part 3:');
      });

      it('should include learning objectives structure', () => {
        const content = generatePromptContent(PromptTemplate.Tutorial, mockMetadata);
        expect(content).toContain('After completing this tutorial, you will be able to:');
        expect(content).toContain('- [Objective 1]');
      });
    });

    it('should handle special characters in metadata', () => {
      const specialMetadata = {
        name: 'Test & Special <Characters>',
        description: 'Description with "quotes"',
        category: 'Testing',
        author: "O'Brien",
      };
      const content = generatePromptContent(PromptTemplate.Basic, specialMetadata);
      expect(content).toContain('Test & Special <Characters>');
      expect(content).toContain('Description with "quotes"');
      expect(content).toContain("O'Brien");
    });
  });
});
