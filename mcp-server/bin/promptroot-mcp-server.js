#!/usr/bin/env node
import { runStdio } from '../src/server.js';

runStdio().catch(err => {
  process.stderr.write(`promptroot-mcp-server: ${err?.message || err}\n`);
  process.exit(1);
});
