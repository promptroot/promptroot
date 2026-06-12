import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGithubRepoFromRemote, resolveTenantId } from '../src/tenant-resolver.js';

test('parseGithubRepoFromRemote', async (t) => {
  await t.test('extracts owner/repo from https git URL', () => {
    const result = parseGithubRepoFromRemote('https://github.com/promptroot/promptroot.git');
    assert.strictEqual(result, 'promptroot/promptroot');
  });

  await t.test('extracts owner/repo from https URL without .git', () => {
    const result = parseGithubRepoFromRemote('https://github.com/promptroot/promptroot');
    assert.strictEqual(result, 'promptroot/promptroot');
  });

  await t.test('extracts owner/repo from ssh URL', () => {
    const result = parseGithubRepoFromRemote('git@github.com:promptroot/promptroot.git');
    assert.strictEqual(result, 'promptroot/promptroot');
  });

  await t.test('returns null for non-GitHub URL', () => {
    const result = parseGithubRepoFromRemote('https://gitlab.com/promptroot/promptroot.git');
    assert.strictEqual(result, null);
  });

  await t.test('returns null for empty/invalid input', () => {
    assert.strictEqual(parseGithubRepoFromRemote(''), null);
    assert.strictEqual(parseGithubRepoFromRemote(null), null);
  });

  await t.test('handles unusual GitHub URL variations', () => {
    assert.strictEqual(
      parseGithubRepoFromRemote('https://github.com/my-org/my-repo'),
      'my-org/my-repo'
    );
    assert.strictEqual(
      parseGithubRepoFromRemote('git@github.com:my-org/my-repo'),
      'my-org/my-repo'
    );
  });
});

test('resolveTenantId', async (t) => {
  await t.test('returns explicit tenantId if provided', async () => {
    const result = await resolveTenantId({ explicit: 'planet' });
    assert.strictEqual(result, 'planet');
  });

  await t.test('returns null when no marker and no git repo', async () => {
    const result = await resolveTenantId({ cwd: '/tmp/nonexistent-' + Math.random() });
    assert.strictEqual(result, null);
  });
});

// Tenants created via the UI store githubRepo as a full URL; the git remote
// parser returns only "owner/repo". Both sides must normalize to the same form.
test('githubRepo normalization', async (t) => {
  await t.test('full URL stored in tenant normalizes to same value as parsed remote', () => {
    const fromRemote = parseGithubRepoFromRemote('https://github.com/open-learning-exchange/myplanet.git');
    const fromTenant = parseGithubRepoFromRemote('https://github.com/open-learning-exchange/myplanet');
    assert.strictEqual(fromRemote, 'open-learning-exchange/myplanet');
    assert.strictEqual(fromTenant, 'open-learning-exchange/myplanet');
    assert.strictEqual(fromRemote, fromTenant);
  });

  await t.test('short owner/repo stored in tenant falls back to itself unchanged', () => {
    const raw = 'promptroot/promptroot';
    const normalized = parseGithubRepoFromRemote(raw) ?? raw;
    assert.strictEqual(normalized, 'promptroot/promptroot');
  });
});
