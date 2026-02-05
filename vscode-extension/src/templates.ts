import * as vscode from 'vscode';

/**
 * Interface representing metadata for a new prompt asset
 */
export interface PromptAssetMetadata {
    name: string;
    description: string;
    category: string;
    author: string;
}

/**
 * Available prompt asset templates
 */
export enum PromptTemplate {
    Basic = 'basic',
    Task = 'task',
    Tutorial = 'tutorial',
}

/**
 * Get list of available templates for Quick Pick
 */
export function getAvailableTemplates(): vscode.QuickPickItem[] {
    return [
        {
            label: 'Basic Prompt',
            description: 'Simple prompt template with metadata',
            detail: 'Best for general-purpose prompts',
        },
        {
            label: 'Task Prompt',
            description: 'Structured template for specific tasks',
            detail: 'Best for step-by-step instructions',
        },
        {
            label: 'Tutorial Prompt',
            description: 'Comprehensive tutorial template',
            detail: 'Best for educational content',
        },
    ];
}

/**
 * Map Quick Pick label to template enum
 */
export function templateFromLabel(label: string): PromptTemplate {
    switch (label) {
        case 'Basic Prompt':
            return PromptTemplate.Basic;
        case 'Task Prompt':
            return PromptTemplate.Task;
        case 'Tutorial Prompt':
            return PromptTemplate.Tutorial;
        default:
            return PromptTemplate.Basic;
    }
}

/**
 * Generate prompt content from template and metadata
 */
export function generatePromptContent(template: PromptTemplate, metadata: PromptAssetMetadata): string {
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (template) {
        case PromptTemplate.Basic:
            return generateBasicTemplate(metadata, timestamp);
        case PromptTemplate.Task:
            return generateTaskTemplate(metadata, timestamp);
        case PromptTemplate.Tutorial:
            return generateTutorialTemplate(metadata, timestamp);
        default:
            return generateBasicTemplate(metadata, timestamp);
    }
}

/**
 * Generate basic prompt template
 */
function generateBasicTemplate(metadata: PromptAssetMetadata, timestamp: string): string {
    return `# ${metadata.name}

**Description:** ${metadata.description}

**Category:** ${metadata.category}

**Author:** ${metadata.author}

**Created:** ${timestamp}

---

## Prompt

[Write your prompt content here]

## Example Usage

\`\`\`
[Provide example usage]
\`\`\`

## Expected Output

[Describe expected output or behavior]

## Notes

- [Add any relevant notes or tips]
`;
}

/**
 * Generate task prompt template
 */
function generateTaskTemplate(metadata: PromptAssetMetadata, timestamp: string): string {
    return `# ${metadata.name}

**Description:** ${metadata.description}

**Category:** ${metadata.category}

**Author:** ${metadata.author}

**Created:** ${timestamp}

---

## Objective

[Define the task objective]

## Prerequisites

- [List prerequisites]

## Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Expected Results

[Describe expected results]

## Verification

[How to verify successful completion]

## Troubleshooting

- **Issue:** [Common issue]
  - **Solution:** [How to resolve]

## References

- [Link to relevant documentation]
`;
}

/**
 * Generate tutorial prompt template
 */
function generateTutorialTemplate(metadata: PromptAssetMetadata, timestamp: string): string {
    return `# ${metadata.name}

**Description:** ${metadata.description}

**Category:** ${metadata.category}

**Author:** ${metadata.author}

**Created:** ${timestamp}

---

## Overview

[Provide overview of what this tutorial covers]

## Learning Objectives

After completing this tutorial, you will be able to:

- [Objective 1]
- [Objective 2]
- [Objective 3]

## Prerequisites

Before starting this tutorial, you should have:

- [Prerequisite 1]
- [Prerequisite 2]

## Tutorial

### Part 1: [Section Title]

[Tutorial content for part 1]

### Part 2: [Section Title]

[Tutorial content for part 2]

### Part 3: [Section Title]

[Tutorial content for part 3]

## Summary

[Summarize what was covered]

## Next Steps

- [Suggestion for further learning]
- [Link to related tutorials]

## Additional Resources

- [Resource 1]
- [Resource 2]
`;
}

/**
 * Validate asset name (filename safe)
 */
export function validateAssetName(name: string): string | undefined {
    if (!name || name.trim().length === 0) {
        return 'Name cannot be empty';
    }
    
    const trimmed = name.trim();
    
    // Check for invalid filename characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(trimmed)) {
        return 'Name contains invalid characters: < > : " / \\ | ? *';
    }
    
    // Check length
    if (trimmed.length > 100) {
        return 'Name is too long (max 100 characters)';
    }
    
    return undefined;
}

/**
 * Convert asset name to filename
 */
export function assetNameToFilename(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, '') // Remove special characters
        + '.md';
}
