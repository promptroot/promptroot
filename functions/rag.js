const { tokenize } = require('../scripts/lib/tokenizer.cjs');

const K1 = 1.5;
const B = 0.75;
const HEADING_BOOST = 1.5;
const TAG_BOOST = 1.25;

function computeStats(chunks) {
  const docFreq = new Map();
  let totalLen = 0;
  for (const chunk of chunks) {
    const seen = new Set();
    for (const tok of chunk.tokens) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      docFreq.set(tok, (docFreq.get(tok) || 0) + 1);
    }
    totalLen += chunk.tokens.length;
  }
  return {
    docFreq,
    avgLen: chunks.length > 0 ? totalLen / chunks.length : 0,
    N: chunks.length
  };
}

function scoreChunk(chunk, queryTokens, stats) {
  const termFreq = new Map();
  for (const t of chunk.tokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);

  const headingTokens = new Set(tokenize(chunk.heading || ''));
  const tagTokens = new Set((chunk.tags || []).flatMap(t => tokenize(t)));

  let score = 0;
  const len = chunk.tokens.length || 1;
  for (const q of queryTokens) {
    const df = stats.docFreq.get(q) || 0;
    if (df === 0) continue;
    const idf = Math.log(1 + (stats.N - df + 0.5) / (df + 0.5));
    const tf = termFreq.get(q) || 0;
    if (tf === 0) continue;
    const norm = 1 - B + B * (len / (stats.avgLen || 1));
    let contribution = idf * ((tf * (K1 + 1)) / (tf + K1 * norm));
    if (headingTokens.has(q)) contribution *= HEADING_BOOST;
    if (tagTokens.has(q)) contribution *= TAG_BOOST;
    score += contribution;
  }
  return score;
}

function rank({ query, chunks, topK = 5, includePrivate = false }) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const filtered = includePrivate
    ? chunks
    : chunks.filter(c => c.visibility !== 'private');
  const stats = computeStats(filtered);
  const scored = [];
  for (const chunk of filtered) {
    const score = scoreChunk(chunk, queryTokens, stats);
    if (score > 0) scored.push({ chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ chunk, score }) => ({
    docPath: chunk.docPath,
    slug: chunk.slug,
    heading: chunk.heading,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    score,
    url: `https://promptroot.ai/wiki#${chunk.slug}`
  }));
}

module.exports = { rank, computeStats, scoreChunk };
