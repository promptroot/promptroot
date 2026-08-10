// Single source of truth for this extension's backend identity.
// To point the extension at a self-hosted instance, change PROJECT_ID/REGION
// here. You must ALSO update browser-extension/manifest.json (host_permissions,
// CSP connect-src, content_scripts matches) and the hostnames in content.js.
// See docs/DEPLOYMENT_CONFIG.md.
const PROJECT_ID = 'promptroot-b02a2';
const REGION = 'us-central1';

const CONFIG = {
  github: {
    clientId: 'Ov23liz8g6qMlD1izTFe',
    redirectUri: `https://${PROJECT_ID}.firebaseapp.com/oauth-callback.html`,
    scopes: ['repo'],
    targetRepo: {
      owner: 'promptroot',
      repo: 'promptroot',
      branch: 'web-captures',
      path: 'webcaptures'
    }
  },

  firebase: {
    projectId: PROJECT_ID,
    functionsUrl: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`,

    endpoints: {
      oauthExchange: '/githubOAuthExchange',
      getGitHubUser: '/getGitHubUser'
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
