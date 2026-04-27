const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
  'have', 'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that',
  'the', 'this', 'to', 'was', 'were', 'will', 'with', 'but', 'not', 'we',
  'you', 'your', 'our', 'their', 'them', 'they', 'he', 'she', 'i', 'do',
  'does', 'did', 'can', 'could', 'should', 'would', 'there', 'so', 'no',
  'any', 'all', 'been', 'being', 'had', 'than', 'then', 'when', 'what',
  'which', 'who', 'why', 'how'
]);

function stripMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ' $1 ')
    .replace(/[#*_>~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  if (!text) return [];
  const cleaned = stripMarkdown(text).toLowerCase();
  const tokens = cleaned.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.filter(t => t.length > 1 && !STOPWORDS.has(t));
}

module.exports = { STOPWORDS, stripMarkdown, tokenize };
