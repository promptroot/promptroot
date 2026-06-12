#!/usr/bin/env node
import { loginViaDeviceFlow } from '../src/device-flow.js';
import { registerMcpServer } from '../src/register-mcp.js';

const args = process.argv.slice(2);
const labelIdx = args.findIndex(a => a === '--label');
const deviceLabel = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

loginViaDeviceFlow({ deviceLabel }).then((result) => {
  process.stderr.write(`Logged in as ${result.uid}.\nSession id: ${result.sessionId}\n`);
  try {
    const wrote = registerMcpServer();
    if (wrote) {
      process.stderr.write('Registered MCP server in ~/.claude/settings.json\n');
    }
  } catch (err) {
    process.stderr.write(`Warning: could not register MCP server: ${err?.message || err}\n`);
  }
}).catch(err => {
  process.stderr.write(`Login failed: ${err?.message || err}\n`);
  process.exit(1);
});
