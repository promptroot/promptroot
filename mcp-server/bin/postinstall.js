#!/usr/bin/env node
import { registerMcpServer } from '../src/register-mcp.js';

try {
  const wrote = registerMcpServer();
  if (wrote) {
    process.stderr.write('promptroot: registered MCP server in ~/.claude/settings.json\n');
  }
} catch (err) {
  // Non-fatal — don't block the install
  process.stderr.write(`promptroot: could not register MCP server: ${err?.message || err}\n`);
}
