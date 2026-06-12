#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { listSddFiles, parseFrontmatter, isUnderPrivateDir } from './lib/sdd-frontmatter.js';

const require = createRequire(import.meta.url);
const { chunkDoc } = require('../functions/lib/chunker.cjs');

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const sddRoot = resolve(repoRoot, 'wiki');

function extractHeadings(body) {
  const headings = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  }
  return headings;
}

function buildIndex() {
  const files = listSddFiles(sddRoot);
  const docs = [];
  const chunks = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(text);
    const closeIdx = text.indexOf('\n---', 4);
    const body = text.slice(closeIdx + 4).replace(/^\r?\n/, '');
    const stat = statSync(file);
    const doc = {
      slug: fm.slug,
      title: fm.title,
      date: fm.date,
      status: fm.status,
      owner: fm.owner,
      tags: fm.tags || [],
      visibility: fm.visibility,
      related: fm.related || [],
      docPath: relative(repoRoot, file).split(/[\\/]/).join('/'),
      private: isUnderPrivateDir(sddRoot, file),
      headings: extractHeadings(body),
      lastModified: stat.mtime.toISOString()
    };
    docs.push(doc);
    for (const chunk of chunkDoc(doc, body)) {
      chunks.push(chunk);
    }
  }

  docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    index: {
      version: 1,
      docs
    },
    chunks: {
      version: 1,
      chunks
    }
  };
}

const { index, chunks } = buildIndex();
const indexPath = resolve(sddRoot, '_index.json');
const chunksPath = resolve(sddRoot, '_chunks.json');
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
writeFileSync(chunksPath, JSON.stringify(chunks, null, 2) + '\n', 'utf8');
console.log(`Wrote ${relative(repoRoot, indexPath)} (${index.docs.length} docs)`);
console.log(`Wrote ${relative(repoRoot, chunksPath)} (${chunks.chunks.length} chunks)`);
