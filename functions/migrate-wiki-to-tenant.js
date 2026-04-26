#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Migrates wiki/*.md files into tenants/{TENANT}/sdds/{slug} with v1 versions.
 *
 * Usage:
 *   node functions/migrate-wiki-to-tenant.js [--tenant=promptroot] [--dry-run]
 *
 * Auth:
 *   Uses Application Default Credentials. Set GOOGLE_APPLICATION_CREDENTIALS to
 *   a service account JSON, or run within a GCP environment that has admin
 *   privileges, or against the Firestore emulator (set FIRESTORE_EMULATOR_HOST).
 */

const fs = require('node:fs');
const path = require('node:path');
const admin = require('firebase-admin');

const DEFAULT_TENANT_ID = 'promptroot';

function parseArgs(argv) {
  const out = { tenant: DEFAULT_TENANT_ID, dryRun: false, tenantName: 'PromptRoot', tenantOwner: 'system' };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--tenant=')) out.tenant = a.split('=')[1];
    else if (a.startsWith('--name=')) out.tenantName = a.split('=')[1];
    else if (a.startsWith('--owner=')) out.tenantOwner = a.split('=')[1];
  }
  return out;
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    throw new Error('Missing frontmatter');
  }
  const closeIdx = text.indexOf('\n---', 4);
  if (closeIdx === -1) throw new Error('Frontmatter not closed');
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

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function listWikiFiles(rootDir) {
  const out = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.md')) continue;
      if (entry === 'README.md' || entry === '_template.md') continue;
      out.push(full);
    }
  }
  walk(rootDir);
  return out;
}

function extractHeadings(body) {
  const headings = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (m) headings.push({ level: m[1].length, text: m[2].trim() });
  }
  return headings;
}

async function ensureTenant(db, { tenantId, name, ownerUid, dryRun }) {
  const ref = db.doc(`tenants/${tenantId}`);
  const snap = await ref.get();
  if (snap.exists) return ref;
  console.log(`+ Creating tenant ${tenantId}`);
  if (!dryRun) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({
      slug: tenantId,
      name,
      description: 'PromptRoot dev history wiki (seed tenant).',
      visibility: 'public',
      ownerUid,
      members: [ownerUid],
      githubRepo: 'promptroot/promptroot',
      mirrorEnabled: false,
      createdAt: now,
      updatedAt: now
    });
  }
  return ref;
}

async function migrateOne(db, { tenantId, file, dryRun }) {
  const text = fs.readFileSync(file, 'utf8');
  const { frontmatter, body } = parseFrontmatter(text);
  const slug = frontmatter.slug;
  if (!slug) throw new Error(`Missing slug in ${file}`);

  const fm = {
    title: frontmatter.title,
    slug,
    date: frontmatter.date,
    status: frontmatter.status,
    owner: frontmatter.owner,
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    related: Array.isArray(frontmatter.related) ? frontmatter.related : [],
    visibility: frontmatter.visibility
  };

  const sddRef = db.doc(`tenants/${tenantId}/sdds/${slug}`);
  const versionId = 'v1';
  const versionRef = sddRef.collection('versions').doc(versionId);

  const existing = await sddRef.get();
  if (existing.exists) {
    console.log(`= Skipping ${slug} (already migrated)`);
    return false;
  }
  console.log(`+ Migrating ${slug}`);
  if (dryRun) return true;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(sddRef, {
    tenantId,
    slug,
    title: fm.title,
    status: fm.status,
    owner: fm.owner,
    date: fm.date,
    tags: fm.tags,
    related: fm.related,
    visibility: fm.visibility,
    body,
    headings: extractHeadings(body),
    currentVersion: versionId,
    lastEditorUid: 'migration',
    lastModified: now
  });
  batch.set(versionRef, {
    body,
    frontmatter: fm,
    authorUid: 'migration',
    authorName: 'Migration script',
    savedAt: now,
    changeNote: 'Initial import from wiki/*.md'
  });
  await batch.commit();
  return true;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(__dirname, '..');
  const wikiRoot = path.join(repoRoot, 'wiki');
  if (!fs.existsSync(wikiRoot)) {
    console.error(`No wiki directory at ${wikiRoot}`);
    process.exit(1);
  }

  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  console.log(`Tenant: ${args.tenant}`);
  console.log(`Dry run: ${args.dryRun}`);
  console.log(`Wiki root: ${wikiRoot}`);

  await ensureTenant(db, {
    tenantId: args.tenant,
    name: args.tenantName,
    ownerUid: args.tenantOwner,
    dryRun: args.dryRun
  });

  const files = listWikiFiles(wikiRoot);
  console.log(`Found ${files.length} markdown file(s).`);

  let migrated = 0;
  let skipped = 0;
  for (const file of files) {
    try {
      const ok = await migrateOne(db, { tenantId: args.tenant, file, dryRun: args.dryRun });
      if (ok) migrated++; else skipped++;
    } catch (err) {
      console.error(`! Failed ${file}: ${err.message}`);
    }
  }
  console.log(`Done. Migrated: ${migrated}, skipped: ${skipped}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
