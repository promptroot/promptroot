import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { credentialsPath } from './config.js';

export async function readCredentials() {
  const path = credentialsPath();
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeCredentials(creds) {
  const path = credentialsPath();
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(creds, null, 2), { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') {
    try { await fs.chmod(path, 0o600); } catch { /* best effort */ }
  }
}

export async function clearCredentials() {
  const path = credentialsPath();
  try { await fs.unlink(path); } catch { /* ignore */ }
}
