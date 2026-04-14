#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';
import { validateAll } from './lib/sdd-frontmatter.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const sddRoot = resolve(repoRoot, 'docs', 'sdd');

const { fileCount, errors } = validateAll(sddRoot);

if (errors.length === 0) {
  console.log(`SDD frontmatter OK: ${fileCount} file(s) validated.`);
  process.exit(0);
}

console.error(`SDD frontmatter validation failed (${errors.length} file(s) with errors):\n`);
for (const { file, errors: errs } of errors) {
  console.error(`  ${relative(repoRoot, file)}`);
  for (const e of errs) console.error(`    - ${e}`);
}
process.exit(1);
