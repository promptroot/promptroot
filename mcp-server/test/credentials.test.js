import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readCredentials, writeCredentials, clearCredentials } from '../src/credentials.js';

test('credentials', async (t) => {
  let tempDir;

  t.before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'promptroot-test-'));
    process.env.PROMPTROOT_CREDENTIALS_PATH = join(tempDir, 'creds.json');
  });

  t.after(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
    delete process.env.PROMPTROOT_CREDENTIALS_PATH;
  });

  await t.test('readCredentials returns null when file does not exist', async () => {
    const result = await readCredentials();
    assert.strictEqual(result, null);
  });

  await t.test('writeCredentials creates file with correct permissions', async () => {
    const creds = { sessionToken: 'prs_abc123', uid: 'user-123' };
    await writeCredentials(creds);

    const content = await fs.readFile(process.env.PROMPTROOT_CREDENTIALS_PATH, 'utf8');
    assert.deepStrictEqual(JSON.parse(content), creds);
  });

  await t.test('readCredentials parses JSON correctly', async () => {
    const creds = { sessionToken: 'prs_xyz', uid: 'user-456', deviceLabel: 'laptop' };
    await writeCredentials(creds);

    const result = await readCredentials();
    assert.deepStrictEqual(result, creds);
  });

  await t.test('clearCredentials removes the file', async () => {
    await writeCredentials({ sessionToken: 'prs_abc' });
    await clearCredentials();

    const result = await readCredentials();
    assert.strictEqual(result, null);
  });

  await t.test('clearCredentials is idempotent', async () => {
    await clearCredentials();
    await clearCredentials();
    const result = await readCredentials();
    assert.strictEqual(result, null);
  });
});
