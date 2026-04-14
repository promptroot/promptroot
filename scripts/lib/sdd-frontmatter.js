import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname, relative, sep, posix } from 'node:path';

const REQUIRED_FIELDS = ['title', 'slug', 'date', 'status', 'owner', 'tags', 'visibility', 'related'];
const VALID_STATUSES = ['proposal', 'approved', 'in-progress', 'shipped', 'archived'];
const VALID_VISIBILITIES = ['public', 'private'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    throw new Error('Missing frontmatter: file must begin with ---');
  }
  const closeIdx = text.indexOf('\n---', 4);
  if (closeIdx === -1) {
    throw new Error('Frontmatter not closed: missing terminating ---');
  }
  const body = text.slice(text.indexOf('\n', 0) + 1, closeIdx);
  return parseYamlSubset(body);
}

function parseYamlSubset(yaml) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) throw new Error(`Invalid frontmatter line: ${JSON.stringify(line)}`);
    const key = m[1];
    const rest = m[2];
    if (rest === '') {
      const items = [];
      i++;
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(stripQuotes(lines[i].replace(/^\s*-\s+/, '').trim()));
        i++;
      }
      out[key] = items;
      continue;
    }
    if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      out[key] = inner === '' ? [] : inner.split(',').map(s => stripQuotes(s.trim()));
      i++;
      continue;
    }
    out[key] = stripQuotes(rest.trim());
    i++;
  }
  return out;
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function validate(parsed, { filename, isInPrivateDir, knownSlugs }) {
  const errors = [];

  for (const f of REQUIRED_FIELDS) {
    if (!(f in parsed)) errors.push(`missing required field: ${f}`);
  }
  if (errors.length) return errors;

  if (typeof parsed.title !== 'string' || parsed.title.trim() === '') errors.push('title must be a non-empty string');
  if (typeof parsed.slug !== 'string' || !SLUG_PATTERN.test(parsed.slug)) errors.push(`slug must be lowercase kebab-case (got: ${parsed.slug})`);

  const stem = basename(filename, extname(filename));
  if (parsed.slug !== stem) errors.push(`slug "${parsed.slug}" does not match filename stem "${stem}"`);

  if (typeof parsed.date !== 'string' || !ISO_DATE.test(parsed.date)) errors.push(`date must be ISO 8601 YYYY-MM-DD (got: ${parsed.date})`);
  if (!VALID_STATUSES.includes(parsed.status)) errors.push(`status must be one of ${VALID_STATUSES.join(', ')} (got: ${parsed.status})`);
  if (typeof parsed.owner !== 'string' || parsed.owner.trim() === '') errors.push('owner must be a non-empty string');
  if (!Array.isArray(parsed.tags)) errors.push('tags must be an array');
  if (!VALID_VISIBILITIES.includes(parsed.visibility)) errors.push(`visibility must be one of ${VALID_VISIBILITIES.join(', ')} (got: ${parsed.visibility})`);
  if (!Array.isArray(parsed.related)) errors.push('related must be an array');

  if (isInPrivateDir && parsed.visibility !== 'private') {
    errors.push(`file under private/ must declare visibility: private (got: ${parsed.visibility})`);
  }
  if (!isInPrivateDir && parsed.visibility === 'private') {
    errors.push('file declaring visibility: private must live under docs/sdd/private/');
  }

  if (Array.isArray(parsed.related) && knownSlugs) {
    for (const slug of parsed.related) {
      if (slug === parsed.slug) errors.push(`related[] cannot reference self: ${slug}`);
      else if (!knownSlugs.has(slug)) errors.push(`related slug not found: ${slug}`);
    }
  }

  return errors;
}

export function listSddFiles(rootDir) {
  const out = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.md')) continue;
      if (entry === 'README.md' || entry === '_template.md') continue;
      out.push(full);
    }
  }
  walk(rootDir);
  return out;
}

export function isUnderPrivateDir(rootDir, fullPath) {
  const rel = relative(rootDir, fullPath).split(sep).join(posix.sep);
  return rel.startsWith('private/');
}

export function validateAll(rootDir) {
  const files = listSddFiles(rootDir);
  const parsedByPath = new Map();
  const allErrors = [];

  for (const f of files) {
    try {
      parsedByPath.set(f, parseFrontmatter(readFileSync(f, 'utf8')));
    } catch (err) {
      allErrors.push({ file: f, errors: [err.message] });
    }
  }

  const knownSlugs = new Set();
  for (const parsed of parsedByPath.values()) {
    if (parsed.slug) knownSlugs.add(parsed.slug);
  }

  for (const [file, parsed] of parsedByPath) {
    const errors = validate(parsed, {
      filename: file,
      isInPrivateDir: isUnderPrivateDir(rootDir, file),
      knownSlugs
    });
    if (errors.length) allErrors.push({ file, errors });
  }

  return { fileCount: files.length, errors: allErrors };
}
