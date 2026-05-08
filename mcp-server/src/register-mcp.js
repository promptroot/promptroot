import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const MCP_KEY = 'promptroot';
const MCP_ENTRY = { command: 'promptroot-mcp-server' };

/**
 * Upserts the promptroot MCP server entry into ~/.claude/settings.json.
 * Handles missing file, missing mcpServers key, and existing entry (idempotent).
 * @returns {boolean} true if the file was written, false if already up-to-date
 */
export function registerMcpServer() {
  let settings = {};
  try {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  } catch {
    // File doesn't exist or invalid JSON — start fresh
  }

  if (!settings.mcpServers) settings.mcpServers = {};

  const existing = settings.mcpServers[MCP_KEY];
  if (existing?.command === MCP_ENTRY.command) return false;

  settings.mcpServers[MCP_KEY] = { ...MCP_ENTRY };

  mkdirSync(join(homedir(), '.claude'), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return true;
}
