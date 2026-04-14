#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, basename } from 'node:path';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { listSddFiles, parseFrontmatter, isUnderPrivateDir } from './lib/sdd-frontmatter.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const sddRoot = resolve(repoRoot, 'docs', 'sdd');

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

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(text);
    const closeIdx = text.indexOf('\n---', 4);
    const body = text.slice(closeIdx + 4).replace(/^\r?\n/, '');
    const stat = statSync(file);
    docs.push({
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
    });
  }

  docs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    docs
  };
}

const index = buildIndex();
const outPath = resolve(sddRoot, '_index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(`Wrote ${relative(repoRoot, outPath)} (${index.docs.length} docs)`);
