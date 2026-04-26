#!/usr/bin/env node
import { loginViaDeviceFlow } from '../src/device-flow.js';

const args = process.argv.slice(2);
const labelIdx = args.findIndex(a => a === '--label');
const deviceLabel = labelIdx >= 0 ? args[labelIdx + 1] : undefined;

loginViaDeviceFlow({ deviceLabel }).then((result) => {
  process.stderr.write(`Logged in as ${result.uid}.\nSession id: ${result.sessionId}\n`);
}).catch(err => {
  process.stderr.write(`Login failed: ${err?.message || err}\n`);
  process.exit(1);
});
