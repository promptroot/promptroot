import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const serverJsonPath = path.resolve(dirname, '../server.json');
const packageJsonPath = path.resolve(dirname, '../package.json');

test('server.json', async (t) => {
  const serverJson = JSON.parse(fs.readFileSync(serverJsonPath, 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  await t.test('version matches package.json', () => {
    assert.strictEqual(serverJson.version, packageJson.version);
    assert.strictEqual(serverJson.packages[0].version, packageJson.version);
  });

  await t.test('declares stdio transport for the published npm package', () => {
    const pkg = serverJson.packages[0];
    assert.strictEqual(pkg.registryType, 'npm');
    assert.strictEqual(pkg.identifier, packageJson.name);
    assert.strictEqual(pkg.transport.type, 'stdio');
  });
});
