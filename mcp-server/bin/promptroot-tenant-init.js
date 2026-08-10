#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output, stderr } from 'node:process';
import { callFunction } from '../src/api.js';
import { parseGithubRepoFromRemote } from '../src/tenant-resolver.js';
import { apiBase, webBase } from '../src/config.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TENANT_MARKER = '.promptroot-tenant';

const AGENTS_TEMPLATE = (slug) => `# AGENTS.md

This repo's dev history lives in PromptRoot under tenant \`${slug}\`.

Coding agents (Claude Code, Cursor, Continue, Cline, Jules) use that tenant
for SDD search and authoring. The MCP server resolves the tenant
automatically from the \`.promptroot-tenant\` file in this repo, so no
per-call configuration is needed.

## Quick start for agents

- Read SDDs: \`promptroot_search_sdds\` / \`promptroot_get_sdd\`.
- Create new SDDs: \`promptroot_create_sdd\` (frontmatter + body).
- Update an SDD: \`promptroot_update_sdd\` (writes a new version).

If no MCP server is configured, fall back to:

    POST ${apiBase()}/ragQuery
    {
      "query": "<question>",
      "topK": 5,
      "tenantId": "${slug}"
    }
`;

async function readTenantSlugFromArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tenant' && args[i + 1]) return args[i + 1];
    if (args[i].startsWith('--tenant=')) return args[i].split('=')[1];
  }
  return null;
}

async function detectGitRepo() {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin']);
    return parseGithubRepoFromRemote(stdout.trim());
  } catch {
    return null;
  }
}

async function chooseTenant() {
  const fromArg = await readTenantSlugFromArgs();
  if (fromArg) return fromArg;

  let tenants = [];
  try {
    ({ tenants } = await callFunction('listTenants', {}));
  } catch (err) {
    stderr.write(`! Could not list tenants: ${err.message}\n  Run "promptroot-mcp-login" first if you need to sign in.\n`);
  }

  const repo = await detectGitRepo();
  const guess = repo ? tenants.find(t => {
    const normalized = parseGithubRepoFromRemote(t.githubRepo) || t.githubRepo;
    return normalized === repo;
  }) : null;
  if (guess) {
    stderr.write(`Detected tenant ${guess.slug} from git remote ${repo}.\n`);
    return guess.slug;
  }

  if (tenants.length === 0) {
    stderr.write(`No tenants found. Create one at ${webBase()}/wiki/tenants and rerun.\n`);
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  stderr.write('Available tenants:\n');
  tenants.forEach((t, i) => stderr.write(`  ${i + 1}. ${t.slug} — ${t.name}\n`));
  const answer = await rl.question('Select a tenant (number or slug): ');
  rl.close();

  const idx = parseInt(answer, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= tenants.length) return tenants[idx - 1].slug;
  const match = tenants.find(t => t.slug === answer.trim());
  if (match) return match.slug;
  stderr.write('No matching tenant.\n');
  process.exit(1);
}

async function writeIfMissing(filename, content) {
  const path = join(process.cwd(), filename);
  try {
    await fs.access(path);
    stderr.write(`= ${filename} already exists; leaving untouched.\n`);
  } catch {
    await fs.writeFile(path, content, 'utf8');
    stderr.write(`+ wrote ${filename}\n`);
  }
}

async function main() {
  const slug = await chooseTenant();
  await writeIfMissing(TENANT_MARKER, `${slug}\n`);
  await writeIfMissing('AGENTS.md', AGENTS_TEMPLATE(slug));
  stderr.write(`\nDone. Tenant: ${slug}\n`);
}

main().catch(err => {
  stderr.write(`tenant-init failed: ${err?.message || err}\n`);
  process.exit(1);
});
