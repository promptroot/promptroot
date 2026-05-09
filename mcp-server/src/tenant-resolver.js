import { promises as fs } from 'node:fs';
import { join, parse } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { callFunction } from './api.js';

const execFileAsync = promisify(execFile);
const TENANT_MARKER = '.promptroot-tenant';

async function readMarker(startDir) {
  let dir = startDir;
  for (;;) {
    try {
      const text = await fs.readFile(join(dir, TENANT_MARKER), 'utf8');
      const slug = text.trim().split(/\r?\n/)[0];
      if (slug) return slug;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    const parent = parse(dir).dir;
    if (parent === dir) return null;
    dir = parent;
  }
}

async function readGitRemote(startDir) {
  try {
    const { stdout } = await execFileAsync('git', ['-C', startDir, 'remote', 'get-url', 'origin']);
    const url = stdout.trim();
    return parseGithubRepoFromRemote(url);
  } catch {
    return null;
  }
}

export function parseGithubRepoFromRemote(url) {
  if (!url) return null;
  let m = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  if (m) return m[1];
  return null;
}

export async function resolveTenantId({ explicit, cwd } = {}) {
  if (explicit) return explicit;
  const startDir = cwd || process.cwd();
  const marker = await readMarker(startDir);
  if (marker) return marker;

  const repo = await readGitRemote(startDir);
  if (repo) {
    try {
      const { tenants } = await callFunction('listTenants', {});
      const match = (tenants || []).find(t => {
        const normalized = parseGithubRepoFromRemote(t.githubRepo) || t.githubRepo;
        return normalized === repo;
      });
      if (match) return match.slug;
    } catch {
      /* signed-out or transient — fall through */
    }
  }
  return null;
}
