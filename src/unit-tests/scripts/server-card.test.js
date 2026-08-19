import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MCP Server Card (.well-known/mcp/server-card.json)', () => {
  const filePath = path.resolve(process.cwd(), '.well-known/mcp/server-card.json');
  const packageJsonPath = path.resolve(process.cwd(), 'mcp-server/package.json');

  it('exists and is valid JSON', () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
    expect(typeof parsed).toBe('object');
  });

  it('contains required SEP-1649 metadata fields', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(parsed.$schema).toContain('mcp-server-card');
    expect(parsed.version).toBe('1.0');
    expect(parsed.protocolVersion).toBe('2025-06-18');
    expect(parsed.serverInfo).toBeDefined();
    expect(parsed.serverInfo.name).toBe('promptroot');
    expect(parsed.serverInfo.version).toBeDefined();
  });

  it('matches version with mcp-server/package.json and server runtime', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    expect(parsed.serverInfo.version).toBe(pkg.version);
    if (parsed.packages && parsed.packages[0]) {
      expect(parsed.packages[0].version).toBe(pkg.version);
    }

    const serverJs = fs.readFileSync(path.resolve(process.cwd(), 'mcp-server/src/server.js'), 'utf8');
    const versionMatch = serverJs.match(/version:\s*['"]([^'"]+)['"]/);
    expect(versionMatch).not.toBeNull();
    expect(versionMatch[1]).toBe(pkg.version);
  });

  it('declares transport, packages and tool capabilities', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(parsed.transport).toBeDefined();
    expect(parsed.transport.type).toBe('stdio');
    expect(parsed.capabilities).toBeDefined();
    expect(parsed.capabilities.tools).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_search_sdds).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_list_sdds).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_get_sdd).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_create_sdd).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_update_sdd).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_list_versions).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_restore_version).toBeDefined();
  });
});
