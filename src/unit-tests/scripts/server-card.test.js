import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MCP Server Card (.well-known/mcp/server-card.json)', () => {
  const filePath = path.resolve(process.cwd(), '.well-known/mcp/server-card.json');

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

  it('declares transport and tools capabilities', () => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(parsed.transport).toBeDefined();
    expect(parsed.transport.type).toBe('streamable-http');
    expect(parsed.capabilities).toBeDefined();
    expect(parsed.capabilities.tools).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_search_sdds).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_list_sdds).toBeDefined();
    expect(parsed.capabilities.tools.promptroot_get_sdd).toBeDefined();
  });
});
