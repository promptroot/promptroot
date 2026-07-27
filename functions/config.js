// Single source of truth for this deployment's server-side identity and origins.
//
// To point the Cloud Functions at a different project/domain, set the env vars
// below (preferred, so no code change per environment) or change the defaults.
// You must ALSO update, in lockstep:
//   - src/app-config.js   browser-side Firebase config, project id, region
//   - firebase.json       hosting "site" and the CSP `connect-src` cloudfunctions host
//   - .firebaserc         default deploy project alias
// See docs/DEPLOYMENT_CONFIG.md for the full fork-and-deploy checklist.

const PROJECT_ID = process.env.PROMPTROOT_PROJECT_ID || 'promptroot-b02a2';
const PRIMARY_DOMAIN = process.env.PROMPTROOT_PRIMARY_DOMAIN || 'https://promptroot.ai';

const DEVICE_FLOW_VERIFICATION_URL =
  process.env.DEVICE_FLOW_VERIFICATION_URL || `${PRIMARY_DOMAIN}/auth/device`;

// Browser origins allowed to call the wiki + device-flow endpoints.
// Override with PROMPTROOT_ALLOWED_ORIGINS (comma-separated) or edit the default.
const WIKI_ALLOWED_ORIGINS = process.env.PROMPTROOT_ALLOWED_ORIGINS
  ? process.env.PROMPTROOT_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : [
      'https://promptroot.io',
      PRIMARY_DOMAIN,
      `https://${PROJECT_ID}.web.app`,
      `https://${PROJECT_ID}.firebaseapp.com`,
      'http://localhost:3000',
      'http://localhost:5000'
    ];

module.exports = {
  PROJECT_ID,
  PRIMARY_DOMAIN,
  DEVICE_FLOW_VERIFICATION_URL,
  WIKI_ALLOWED_ORIGINS
};
