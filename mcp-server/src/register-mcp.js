import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const MCP_KEY = 'promptroot';

function resolveCommand() {
  // Use absolute path so VS Code (which may not have nvm in PATH) can find the binary.
  try {
    const abs = execFileSync('which', ['promptroot-mcp-server'], { encoding: 'utf8' }).trim();
    if (abs) return abs;
  } catch { /* fall through */ }
  return 'promptroot-mcp-server';
}

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

  const command = resolveCommand();
  const existing = settings.mcpServers[MCP_KEY];
  if (existing?.command === command) return false;

  settings.mcpServers[MCP_KEY] = { command };

  mkdirSync(join(homedir(), '.claude'), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return true;
}
