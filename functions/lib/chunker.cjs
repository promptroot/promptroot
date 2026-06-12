const { tokenize } = require('./tokenizer.cjs');

const MAX_TOKENS = 500;

function splitByHeading(body) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let current = { heading: null, lines: [] };
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current.lines.length > 0 || current.heading) sections.push(current);
      current = { heading: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0 || current.heading) sections.push(current);
  return sections.map(s => ({
    heading: s.heading,
    text: s.lines.join('\n').trim()
  })).filter(s => s.text.length > 0 || s.heading);
}

function subdivideOversized(section) {
  const tokens = tokenize(section.text);
  if (tokens.length <= MAX_TOKENS) return [section];
  const paragraphs = section.text.split(/\n{2,}/);
  const pieces = [];
  let buf = [];
  let bufTokens = 0;
  for (const p of paragraphs) {
    const pTokens = tokenize(p).length;
    if (bufTokens + pTokens > MAX_TOKENS && buf.length > 0) {
      pieces.push(buf.join('\n\n'));
      buf = [p];
      bufTokens = pTokens;
    } else {
      buf.push(p);
      bufTokens += pTokens;
    }
  }
  if (buf.length > 0) pieces.push(buf.join('\n\n'));
  return pieces.map(text => ({ heading: section.heading, text }));
}

function chunkDoc(doc, body) {
  const sections = splitByHeading(body);
  const chunks = [];
  let idx = 0;
  for (const section of sections) {
    const pieces = subdivideOversized(section);
    for (const piece of pieces) {
      chunks.push({
        id: `${doc.slug}__${idx}`,
        slug: doc.slug,
        docPath: doc.docPath,
        heading: piece.heading || doc.title,
        chunkIndex: idx,
        text: piece.text,
        tokens: tokenize(`${piece.heading || ''} ${piece.text}`),
        visibility: doc.visibility,
        tags: doc.tags || [],
        date: doc.date
      });
      idx++;
    }
  }
  return chunks;
}

module.exports = {
  MAX_TOKENS,
  splitByHeading,
  subdivideOversized,
  chunkDoc
};
