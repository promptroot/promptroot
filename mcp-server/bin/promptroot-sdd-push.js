#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { callFunction } from '../src/api.js';
import { resolveTenantId } from '../src/tenant-resolver.js';

function usage() {
  process.stderr.write(
    'Usage: promptroot-sdd-push <file.md> [--tenant <slug>] [--note "change note"]\n' +
    '\n' +
    'Reads a markdown file with YAML frontmatter and pushes it to PromptRoot.\n' +
    'If a SDD with the same slug already exists in the tenant, it is updated;\n' +
    'otherwise it is created. Tenant resolves from --tenant, .promptroot-tenant,\n' +
    'or git remote in that order.\n'
  );
}

const args = process.argv.slice(2);
let file = null;
let explicitTenant = null;
let changeNote = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--tenant' && args[i + 1]) { explicitTenant = args[++i]; }
  else if (a === '--note' && args[i + 1]) { changeNote = args[++i]; }
  else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
  else if (!a.startsWith('--')) { file = a; }
}

if (!file) { usage(); process.exit(1); }

const filePath = resolve(file);
if (!existsSync(filePath)) {
  process.stderr.write(`File not found: ${file}\n`);
  process.exit(1);
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    throw new Error('Missing --- frontmatter block at top of file');
  }
  const closeIdx = text.indexOf('\n---', 4);
  if (closeIdx === -1) throw new Error('Frontmatter block not closed with ---');
  const yaml = text.slice(text.indexOf('\n', 0) + 1, closeIdx);
  const body = text.slice(closeIdx + 4).replace(/^\r?\n/, '');
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
  return { frontmatter: out, body };
}

const text = readFileSync(filePath, 'utf8');
let frontmatter, body;
try {
  ({ frontmatter, body } = parseFrontmatter(text));
} catch (err) {
  process.stderr.write(`Failed to parse ${file}: ${err.message}\n`);
  process.exit(1);
}

if (!frontmatter.slug) {
  process.stderr.write('Frontmatter must include "slug:".\n');
  process.exit(1);
}

const tenantId = explicitTenant || await resolveTenantId({});
if (!tenantId) {
  process.stderr.write('Could not resolve tenant. Pass --tenant <slug> or add a .promptroot-tenant marker file at the repo root.\n');
  process.exit(1);
}

const slug = frontmatter.slug;
const payload = { tenantId, slug, frontmatter, body };
if (changeNote) payload.changeNote = changeNote;

try {
  const result = await callFunction('createSdd', payload);
  process.stderr.write(`Created ${slug} in tenant ${tenantId} (version ${result.versionId}).\n`);
  if (result.url) process.stderr.write(`URL: ${result.url}\n`);
} catch (err) {
  if (err.statusCode === 409) {
    try {
      const result = await callFunction('updateSdd', payload);
      process.stderr.write(`Updated ${slug} in tenant ${tenantId} (version ${result.versionId}).\n`);
    } catch (updateErr) {
      process.stderr.write(`Update failed: ${updateErr.message}\n`);
      process.exit(1);
    }
  } else {
    process.stderr.write(`Push failed: ${err.message}\n`);
    process.exit(1);
  }
}