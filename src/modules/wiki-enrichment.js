import { ragQuery } from '../utils/rag-client.js';

export function formatEnrichmentSection(results) {
  if (!Array.isArray(results) || results.length === 0) return '';
  const lines = [
    '## Relevant Prior Design Decisions',
    '',
    'The following excerpts from the PromptRoot dev history wiki may be relevant',
    'to this task. Source URLs are provided for reference; you do not need to',
    'fetch them.',
    ''
  ];
  for (const r of results) {
    lines.push(`### [${r.heading || r.slug}](${r.url})`);
    lines.push('');
    lines.push(r.text);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  lines.push('(end of prior design context)');
  lines.push('');
  return lines.join('\n');
}

export async function enrichPrompt(taskPrompt, options = {}) {
  if (options.enabled === false) return taskPrompt;
  try {
    const results = await ragQuery({
      query: taskPrompt,
      topK: options.topK || 5,
      endpoint: options.endpoint,
      fetchImpl: options.fetchImpl
    });
    const section = formatEnrichmentSection(results);
    if (!section) return taskPrompt;
    return `${section}\n${taskPrompt}`;
  } catch (err) {
    if (options.onError) options.onError(err);
    return taskPrompt;
  }
}
