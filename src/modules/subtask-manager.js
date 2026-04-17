/**
 * Parse task-stub blocks: :::task-stub{title="..."}...:::
 */
export function extractTaskStubs(text) {
  const taskStubRegex = /:::task-stub\{title="([^"]+)"\}\s*([\s\S]*?):::/g;
  const stubs = [];
  let match;

  while ((match = taskStubRegex.exec(text)) !== null) {
    stubs.push({
      title: match[1],
      content: match[2].trim()
    });
  }

  return stubs;
}

export function extractManualSplits(text) {
  const parts = text.split(/^---+$/m).map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length <= 1) {
    return [];
  }
  
  return parts.map(content => {
    const firstLine = content.split('\n')[0];
    const title = firstLine.startsWith('#') 
      ? firstLine.replace(/^#+\s*/, '').trim() 
      : firstLine.substring(0, 50);
    
    return { title, content };
  });
}

/**
 * Extract numbered tasks (e.g., "Task 1:", "Task 2:") from plans
 */
export function extractNumberedTasks(text) {
  const tasks = [];
  const lines = text.split('\n');
  
  let currentTask = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^Task\s+(\d+):\s*(.+?)$/i);
    
    if (match) {
      if (currentTask) {
        tasks.push({
          number: currentTask.number,
          title: currentTask.title,
          content: currentContent.join('\n').trim()
        });
      }
      
      currentTask = {
        number: parseInt(match[1]),
        title: match[2].trim()
      };
      currentContent = [];
    } else if (currentTask) {
      if (line.match(/^Task\s+\d+/i)) {
        continue;
      }
      currentContent.push(line);
    }
  }
  
  if (currentTask && currentContent.length > 0) {
    tasks.push({
      number: currentTask.number,
      title: currentTask.title,
      content: currentContent.join('\n').trim()
    });
  }
  
  return tasks;
}

export function breakIntoParagraphs(text) {
  const sections = [];
  const lines = text.split('\n');
  let currentSection = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading = line.match(/^#+\s+(.+)/);
    const isBlank = line.trim() === '';

    if (isHeading && currentSection.length > 0) {
      const sectionText = currentSection.join('\n').trim();
      if (sectionText.length > 0) {
        sections.push({ content: sectionText });
      }
      currentSection = [line];
    } else if (isBlank && currentSection.length > 0) {
      const sectionText = currentSection.join('\n').trim();
      if (sectionText.length > 0) {
        sections.push({ content: sectionText });
      }
      currentSection = [];
    } else if (!isBlank) {
      currentSection.push(line);
    }
  }

  if (currentSection.length > 0) {
    const sectionText = currentSection.join('\n').trim();
    if (sectionText.length > 0) {
      sections.push({ content: sectionText });
    }
  }

  return sections;
}

/**
 * Auto-detect best subtask strategy based on content
 */
export function analyzePromptStructure(text) {
  const taskStubs = extractTaskStubs(text);

  if (taskStubs.length > 1) {
    return {
      strategy: 'task-stubs',
      subtasks: taskStubs.map((stub, idx) => ({
        id: idx + 1,
        title: stub.title,
        content: stub.content,
        type: 'task-stub'
      })),
      recommendation: `Detected ${taskStubs.length} task blocks. These are ideal for sequential submission.`
    };
  }

  const manualSplits = extractManualSplits(text);
  if (manualSplits.length > 1) {
    return {
      strategy: 'manual-splits',
      subtasks: manualSplits.map((split, idx) => ({
        id: idx + 1,
        title: split.title,
        content: split.content,
        type: 'manual-split'
      })),
      recommendation: `Detected ${manualSplits.length} manual splits (separated by ---).`
    };
  }

  const numberedTasks = extractNumberedTasks(text);
  if (numberedTasks.length > 1) {
    return {
      strategy: 'numbered-tasks',
      subtasks: numberedTasks.map(task => ({
        id: task.number,
        title: task.title,
        content: task.content,
        type: 'numbered-task'
      })),
      recommendation: `Detected ${numberedTasks.length} numbered tasks. Perfect for structured plans.`
    };
  }

  const paragraphs = breakIntoParagraphs(text);
  if (paragraphs.length > 3) {
    return {
      strategy: 'paragraph-based',
      subtasks: paragraphs.map((para, idx) => ({
        id: idx + 1,
        title: `Part ${idx + 1}`,
        content: para.content,
        type: 'paragraph'
      })),
      recommendation: `Detected ${paragraphs.length} logical sections. You can merge/split as needed.`
    };
  }

  return {
    strategy: 'none',
    subtasks: [],
    recommendation: 'Prompt is relatively short or unstructured. Consider sending as-is or manual splitting.'
  };
}

/**
 * Add sequence headers and context to each subtask
 */
export function buildSubtaskSequence(fullPrompt, selectedSubtasks) {
  return selectedSubtasks.map((subtask, idx) => {
    const shouldAddHeader = subtask.title && 
                           subtask.title !== `Part ${idx + 1}` && 
                           !subtask.content.trim().startsWith(subtask.title);
    
    const header = shouldAddHeader ? `${subtask.title}\n\n` : '';
    const julesContent = header + subtask.content;

    return {
      ...subtask,
      fullContent: julesContent,
      sequenceInfo: {
        current: idx + 1,
        total: selectedSubtasks.length
      }
    };
  });
}

/**
 * Generate a summary of the split strategy
 */
export function generateSplitSummary(subtasks) {
  const summary = {
    totalSubtasks: subtasks.length,
    estimatedMinutes: Math.ceil(subtasks.length * 5),
    breakdown: subtasks.map((st, idx) => ({
      number: idx + 1,
      title: st.title || `Part ${idx + 1}`,
      contentLength: st.content.length,
      lines: st.content.split('\n').length
    }))
  };
  return summary;
}

/**
 * Check for validation errors and warnings
 */
export function validateSubtasks(subtasks) {
  const errors = [];
  const warnings = [];

  if (subtasks.length === 0) {
    errors.push('No subtasks selected');
  }

  if (subtasks.length > 20) {
    warnings.push('Many subtasks (20+) may take a long time to process');
  }

  subtasks.forEach((st, idx) => {
    if (!st.content || st.content.trim().length === 0) {
      errors.push(`Subtask ${idx + 1} is empty`);
    }
    if (st.content.length > 10000) {
      warnings.push(`Subtask ${idx + 1} is very large (${st.content.length} chars)`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
