# Deployment configuration (fork-and-deploy checklist)

This app's project/domain identity is centralized so a fork can be pointed at a
different Firebase/GCP project by editing a small, known set of places instead of
hunting through the codebase.

## The two config modules (edit these first)

| File | Scope | What it holds |
|------|-------|---------------|
| `src/app-config.js` | Browser | `PROJECT_ID`, `REGION`, and the Firebase web `firebaseConfig` (apiKey, appId, messagingSenderId; authDomain/storageBucket are derived from `PROJECT_ID`). Everything client-side (`firebase-init.js`, `cloud-function-url.js`, `rag-client.js`) reads from here. |
| `functions/config.js` | Cloud Functions | `PROJECT_ID`, `PRIMARY_DOMAIN`, `DEVICE_FLOW_VERIFICATION_URL`, and `WIKI_ALLOWED_ORIGINS` (CORS). `wiki.js`, `wiki-device-flow.js`, and `rag.js` read from here. All values are env-overridable (`PROMPTROOT_PROJECT_ID`, `PROMPTROOT_PRIMARY_DOMAIN`, `PROMPTROOT_ALLOWED_ORIGINS`, `DEVICE_FLOW_VERIFICATION_URL`). |

## Two static files that cannot import JS (edit in lockstep)

| File | What to change |
|------|----------------|
| `firebase.json` | The hosting `site` (2 places) and the CSP `connect-src` entry `https://us-central1-<project>.cloudfunctions.net`. If the CSP host is wrong, the browser blocks all calls to your functions. |
| `.firebaserc` | The default deploy project alias. |

## Remaining manual touch points (not part of the SDD/wiki subsystem)

These are only relevant if you keep the non-SDD features (Jules, OpenClaw, the
public prompt library). For a private SDD-only instance they are typically
disabled instead of repointed:

- `functions/index.js` CORS allowlist (for the Jules/OpenClaw/GitHub endpoints).
- `src/utils/constants.js` `OWNER`/`REPO`/`BRANCH` (default prompt library source),
  `JULES_API_BASE`, and the OpenClaw relay URLs.
- Branding/SEO: `index.html`, `sitemap.xml`, `robots.txt`.

## Downstream clients (separate deployables)

Each talks to the same backend and has its own single config source. Repoint
these only if you want that client to hit your instance too.

| Client | Config source (edit this) | Static files to edit in lockstep |
|--------|---------------------------|----------------------------------|
| MCP server / CLI | `mcp-server/src/config.js` (`DEFAULT_PROJECT_ID`, `DEFAULT_REGION`, `DEFAULT_WEB_URL`; or the `PROMPTROOT_API_BASE` / `PROMPTROOT_WEB_URL` / `PROMPTROOT_DEVICE_FLOW_URL` env vars) | none |
| Browser extension | `browser-extension/config.js` (`PROJECT_ID`, `REGION`) | `browser-extension/manifest.json` (host_permissions, CSP `connect-src`, content_scripts `matches`) and the web-app hostnames in `browser-extension/content.js` |
| VS Code extension | `vscode-extension/src/firebase-config.ts` (`DEFAULT_PROJECT_ID`; authDomain/storageBucket derive from it) or the `promptroot.firebase.projectId` user setting | `vscode-extension/package.json` (the setting's `default`) |

## GitHub OAuth (required, per-project)

Firebase Auth's GitHub provider is per-project. Create a new GitHub OAuth App
with its callback set to `https://<project>.firebaseapp.com/__/auth/handler`, and
set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` for the functions.

## Quick fork sequence

1. Edit `src/app-config.js` (project id, region, Firebase web config).
2. Edit `functions/config.js` (or set the `PROMPTROOT_*` env vars).
3. Update `firebase.json` (hosting site + CSP `connect-src`) and `.firebaserc`.
4. Create the GitHub OAuth App and set the functions env vars.
5. `firebase deploy --only firestore:rules,functions,hosting`.
