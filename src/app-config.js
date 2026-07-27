// Single source of truth for this deployment's Firebase/GCP identity (browser side).
//
// To point this app at a different Firebase project (e.g. a self-hosted company
// instance), change the values in THIS file. You must ALSO update, in lockstep:
//   - functions/config.js   server-side allowed origins, primary domain, device-flow URL
//   - firebase.json         hosting "site" and the CSP `connect-src` cloudfunctions host
//   - .firebaserc           default deploy project alias
// See docs/DEPLOYMENT_CONFIG.md for the full fork-and-deploy checklist.
//
// Note: the Firebase web apiKey is a public client identifier, not a secret.

export const PROJECT_ID = 'promptroot-b02a2';
export const REGION = 'us-central1';

// authDomain and storageBucket follow the standard Firebase naming derived from
// PROJECT_ID. Override the literals here if your project uses custom values.
export const firebaseConfig = {
  apiKey: 'AIzaSyD_NzQlgmcUfgrqpgTl3Q3pCkfBrO8PcoA',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: '494845853842',
  appId: '1:494845853842:web:6c97aec4822be003fc264b'
};
