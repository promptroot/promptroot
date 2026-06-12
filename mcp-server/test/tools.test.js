import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolDefinitions } from '../src/tools.js';

test('toolDefinitions', async (t) => {
  await t.test('exports 7 tool definitions', () => {
    assert.strictEqual(toolDefinitions.length, 7);
  });

  await t.test('each tool has required fields', () => {
    for (const tool of toolDefinitions) {
      assert(typeof tool.name === 'string', 'name required');
      assert(typeof tool.description === 'string', 'description required');
      assert(tool.inputSchema && typeof tool.inputSchema === 'object', 'inputSchema required');
      assert(typeof tool.handler === 'function', 'handler function required');
    }
  });

  await t.test('tool names are valid identifiers', () => {
    const names = toolDefinitions.map(t => t.name);
    assert.deepStrictEqual(names, [
      'promptroot_search_sdds',
      'promptroot_list_sdds',
      'promptroot_get_sdd',
      'promptroot_create_sdd',
      'promptroot_update_sdd',
      'promptroot_list_versions',
      'promptroot_restore_version'
    ]);
  });

  await t.test('promptroot_search_sdds has correct schema', () => {
    const tool = toolDefinitions.find(t => t.name === 'promptroot_search_sdds');
    assert(tool.inputSchema.properties.query);
    assert.strictEqual(tool.inputSchema.properties.query.type, 'string');
    assert.deepStrictEqual(tool.inputSchema.required, ['query']);
  });

  await t.test('promptroot_create_sdd has slug pattern validation', () => {
    const tool = toolDefinitions.find(t => t.name === 'promptroot_create_sdd');
    assert(tool.inputSchema.properties.slug.pattern);
    // Validate kebab-case pattern
    const pattern = new RegExp(tool.inputSchema.properties.slug.pattern);
    assert(pattern.test('my-sdd'));
    assert(pattern.test('sdd-123'));
    assert(!pattern.test('MySDd'));
  });

  await t.test('promptroot_restore_version requires slug and versionId', () => {
    const tool = toolDefinitions.find(t => t.name === 'promptroot_restore_version');
    assert.deepStrictEqual(new Set(tool.inputSchema.required), new Set(['slug', 'versionId']));
  });
});
