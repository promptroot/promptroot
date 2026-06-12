---
title: VS Code Extension Marketplace Publishing
slug: vscode-extension-store
date: 2026-03-07
status: shipped
owner: promptroot-core
tags: [vscode, extension, marketplace, publishing]
visibility: public
related:
  - modular-sdd-prompt-planner
---

# SDD: VS Code Extension — Marketplace Publishing

**Project:** PromptRoot VS Code Extension  
**Document Type:** Software Design Document (SDD)  
**Date:** March 7, 2026  
**Status:** v0.1.1 Published  
**Website:** [https://promptroot.ai](https://promptroot.ai)

---

## 1. Objective

Prepare and publish the PromptRoot VS Code extension to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/) so that any developer can install it directly from VS Code. Simultaneously, add a dedicated **IDE Extension** page to the [promptroot.ai](https://promptroot.ai) web application (modeled on the existing Web Capture page) to drive installs and provide usage instructions.

---

## 2. Current State

### VS Code Extension (`vscode-extension/`)

| Area | Status | Notes |
|------|--------|-------|
| Core functionality | ✅ Complete | 30+ commands, 4 tree views, Firebase integration |
| TypeScript source | ✅ Complete | 25+ modules, strict typing |
| Unit tests | ✅ 84 passing | Vitest with coverage |
| `package.json` metadata | ✅ Done | icon, repository, homepage, keywords, galleryBanner, license, badges added |
| Extension icon | ✅ Done | `icon.png` placed in extension root |
| CHANGELOG.md | ✅ Done | Initial 0.1.0 release |
| LICENSE file | ✅ Done | AGPL-3.0-only full text |
| CONTRIBUTING.md | ✅ Done | Dev setup moved out of README |
| `.vscodeignore` | ✅ Done | Excludes dev files; `out/` excluded in favour of `dist/` |
| esbuild bundling | ✅ Done | `esbuild.js` bundles all deps (incl. Firebase) into `dist/extension.js` |
| `main` entry point | ✅ Done | Points to `./dist/extension.js` |
| Activation events | ✅ Done | `onStartupFinished` + `onView:*` for all 4 tree views |
| Activation crash fix | ✅ Done | Firebase/auth init wrapped in try-catch; tree providers always register |
| VSIX size | ✅ 1.22 MB | v0.1.1 — includes screenshot + esbuild minification |
| Screenshots | ✅ Done | `assets/screenshots/extension-main-view.png` added; embedded in README |
| Publisher account | ✅ Done | `promptroot` publisher created; v0.1.0 + v0.1.1 published |
| Website link in sidebar | ✅ Done | Globe icon button in all 4 tree view title bars opens promptroot.ai |

### Web Application

| Area | Status | Notes |
|------|--------|-------|
| Web Capture page | ✅ Exists | `pages/webcapture/webcapture.html` — used as template |
| IDE Extension page | ✅ Done | `pages/ide-extension/ide-extension.html` |
| Page init module | ✅ Done | `src/pages/ide-extension-page.js` |
| `VSCODE_EXTENSION_URL` constant | ✅ Done | Added to `src/utils/constants.js` |
| Header navigation | ✅ Done | Mobile + desktop nav links added |
| Service worker cache | ✅ Done | Both new files added to `STATIC_ASSETS` |
| Firebase hosting rewrite | ✅ Done | `/ide-extension` → page HTML |

---

## 3. Workstreams

### Workstream A — Extension Marketplace Readiness

Everything needed to pass marketplace review and provide a polished listing.

### Workstream B — Web App IDE Extension Page

A new page on [promptroot.ai](https://promptroot.ai) to showcase the extension and link to the marketplace listing.

---

## 4. Workstream A — Extension Marketplace Readiness

### A1. Create Publisher Account ✅

- [x] `promptroot` publisher created on [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
- [x] Microsoft account created
- [x] Extension published via VSIX drag-and-drop on publisher dashboard

### A2. Extension Icon ✅

- [x] 128×128 PNG `icon.png` placed in `vscode-extension/` root
- [x] Referenced in `package.json` as `"icon": "icon.png"`

### A3. Update `package.json` Metadata ✅

Added/updated the following top-level fields:

```jsonc
{
  "icon": "icon.png",
  "homepage": "https://promptroot.ai",
  "repository": { "type": "git", "url": "https://github.com/promptroot/promptroot" },
  "bugs": { "url": "https://github.com/promptroot/promptroot/issues" },
  "license": "AGPL-3.0-only",
  "galleryBanner": { "color": "#1a1d2e", "theme": "dark" },
  "keywords": ["promptroot", "prompts", "ai", "jules", "prompt-management", "github", "queue", "markdown"],
  "badges": [{ "url": "https://img.shields.io/badge/website-promptroot.ai-blue", "href": "https://promptroot.ai", "description": "PromptRoot Website" }],
  "categories": ["Other", "SCM Providers"]
}
```

### A4. Prominent Website Link ✅

Achieved through:
1. `"homepage": "https://promptroot.ai"` — marketplace sidebar "Homepage" link
2. `"badges"` array — clickable badge at top of listing
3. README hero `<p align="center">` badge + `>` blockquote with link
4. Footer line: `**[promptroot.ai](https://promptroot.ai)** | GitHub | Issues`
5. **Globe `$(globe)` icon button** in all 4 tree view title bars (Assets, Queue, Sessions, Repositories) — always visible in sidebar, opens promptroot.ai
6. `openDocs` command fixed to open `https://promptroot.ai` (was pointing to GitHub repo)

### A5. Create `.vscodeignore` ✅

Excludes `src/`, `out/`, `coverage/`, `node_modules/`, TypeScript source files, test files, and build config. The bundled output (`dist/extension.js`) is the only compiled artifact included.

### A6. Create `CHANGELOG.md` ✅

`vscode-extension/CHANGELOG.md` documents version 0.1.0 initial release.

### A7. LICENSE File ✅

`vscode-extension/LICENSE` contains the full AGPL-3.0 text (downloaded from gnu.org).

### A8. Restructure README.md ✅

`vscode-extension/README.md` restructured for end-user/marketplace consumption:
- Hero badge + blockquote with [promptroot.ai](https://promptroot.ai) link
- Feature table with descriptions
- Quick Start (5 steps including sign-in)
- Commands table grouped by category
- Tree views summary table
- Configuration table
- Data sync section (prominently links to promptroot.ai)
- Requirements, Troubleshooting, Contributing, License
- Footer: `promptroot.ai | GitHub | Issues`
- Dev/roadmap/phase tracking removed → moved to `CONTRIBUTING.md`

### A9. Screenshots ✅

| # | File | Status |
|---|------|--------|
| 1 | `assets/screenshots/extension-main-view.png` | ✅ Added |

- [x] Screenshot placed in `vscode-extension/assets/screenshots/`
- [x] Referenced in README (`![Promptroot VS Code Extension](assets/screenshots/extension-main-view.png)`)
- [x] Included in VSIX (1.22 MB total)

> Additional screenshots (queue, sessions, create prompt) can be added in future versions.

### A10. Test Packaging ✅

esbuild bundling added (`esbuild.js`). `vsce:prepublish` runs `node esbuild.js --minify`.

```bash
cd vscode-extension
vsce package
# v0.1.0: promptroot-vscode-0.1.0.vsix (485 KB, 9 files)
# v0.1.1: promptroot-vscode-0.1.1.vsix (1.22 MB, 10 files — includes screenshot)
```

Validation checklist:
- [x] `vsce package` completes without errors
- [x] VSIX well under 20 MB limit
- [x] Install locally succeeds
- [ ] All 4 tree views load after install ← **pending user verification**
- [ ] Commands execute from Command Palette
- [ ] Status bar items appear
- [x] `dist/extension.js` is the only compiled JS in package

**Note — bundling fix:** The initial VSIX (129 KB) excluded `node_modules/` via `.vscodeignore` but the compiled JS wasn't bundled, causing a module-not-found crash on activation (the Output channel never appeared). Root cause: `firebase` and all deps must be bundled into the output JS. Fixed by:
1. Adding `esbuild.js` with `bundle: true`, `external: ['vscode']`, `outfile: './dist/extension.js'`
2. Switching `"main"` to `"./dist/extension.js"`
3. Switching `"vscode:prepublish"` to `"node esbuild.js --minify"`
4. Excluding `out/**` in `.vscodeignore` (keeping `dist/`)

**Note — activation events fix:** Extension also wasn't activating in workspaces without a `prompts/` folder. Fixed by adding `"onStartupFinished"` and `onView:*` events for all 4 tree views to `activationEvents`.

**Note — activation crash fix:** Firebase/AuthManager constructor threw before tree providers were registered. Moved `new AuthManager()`, `new FirestoreService()`, and all dependent Jules/queue init into a try-catch block so tree views always register even if Firebase is unreachable.

### A11. Security & Privacy Review

Before store submission:

- [ ] Ensure no hardcoded secrets or API keys in source
- [ ] Firebase config values are non-secret (project ID, etc.) — verify this is acceptable
- [ ] OAuth flow uses Firebase server-side token exchange (no client secrets exposed)
- [ ] Extension permissions are minimal and justified
- [ ] Privacy policy link ([promptroot.ai/privacy](https://promptroot.ai/pages/privacy/privacy.html)) is accessible

### A12. Publish to Marketplace ✅

- [x] v0.1.0 uploaded via drag-and-drop to marketplace publisher dashboard (verifying → public)
- [x] v0.1.1 uploaded with screenshot, globe website button, and URL fix
- [ ] Verify [promptroot.ai](https://promptroot.ai) link visible in listing sidebar
- [ ] Verify screenshot renders in listing
- [ ] Test install from marketplace: search "Promptroot" in VS Code Extensions panel

---

## 5. Workstream B — Web App IDE Extension Page

### B1. Page HTML ✅

**File:** `pages/ide-extension/ide-extension.html`

Hero panel, 5 feature cards, installation instructions (Marketplace, CLI, VSIX), How to Use, Core Commands cheat sheet, Troubleshooting section, footer with promptroot.ai link.

### B2. Page Initialization Module ✅

**File:** `src/pages/ide-extension-page.js`

Imports `VSCODE_EXTENSION_URL` from constants, binds install button click to open marketplace with loading/success feedback.

### B3. Constants ✅

**File:** `src/utils/constants.js`

```javascript
export const VSCODE_EXTENSION_URL = 'https://marketplace.visualstudio.com/items?itemName=promptroot.promptroot-vscode';
```

### B4. Navigation Link ✅

**File:** `partials/header.html`

IDE Extension nav item added in both mobile sidebar and desktop nav (after Web Capture).

### B5. Page-Specific Styles

No custom CSS needed — all styling uses existing shared component classes.

### B6. Service Worker Cache ✅

**File:** `sw.js`

`/pages/ide-extension/ide-extension.html` and `/src/pages/ide-extension-page.js` added to `STATIC_ASSETS`.

### B7. Firebase Hosting Rewrite ✅

**File:** `firebase.json`

`/ide-extension` → `pages/ide-extension/ide-extension.html` added to rewrites.

---

## 6. Dependency & Sequencing

```
A1 (Publisher Account)
 │
 ├── A2 (Icon) ✅ ──────────┐
 ├── A3 (package.json) ✅ ──┤
 ├── A5 (.vscodeignore) ✅ ─┤
 ├── A6 (CHANGELOG) ✅ ─────┤
 ├── A7 (LICENSE) ✅ ────────┤
 │                           ▼
 │               A10 (Test Packaging) ✅
 │                           │
 ├── A4 (Website Link) ✅ ──┤
 ├── A8 (README) ✅ ─────────┤
 ├── A9 (Screenshots) ✅ ────┤
 ├── A11 (Security) ─────────┤  ← remaining
 │                           ▼
 │                     A12 (Publish) ✅
 │
 └── Workstream B (all ✅ complete)
```

---

## 7. Acceptance Criteria

### Marketplace Listing

- [ ] Extension installs from VS Code Extensions panel via search "Promptroot"
- [x] Listing icon set (128×128, dark banner)
- [x] Listing sidebar shows **Homepage → [promptroot.ai](https://promptroot.ai)**
- [x] Badge at top of listing links to [promptroot.ai](https://promptroot.ai)
- [x] Screenshot embedded in README (renders in marketplace listing)
- [x] README is end-user focused (no dev/roadmap sections)
- [x] CHANGELOG shows 0.1.0 and 0.1.1 releases
- [ ] All 4 tree views load after install ← **pending verification**
- [ ] Sign in, create prompt, add to queue workflows function end-to-end
- [x] VSIX package size < 10MB (1.22 MB)

### Web App IDE Extension Page

- [x] Page accessible at `/pages/ide-extension/ide-extension.html`
- [x] Header nav shows "IDE Extension" in both mobile and desktop
- [x] Hero section with install CTA button opens marketplace listing
- [x] **Prominent link to [promptroot.ai](https://promptroot.ai)** visible on page
- [x] Features section lists 5 key capabilities with icons
- [x] Installation instructions cover marketplace, CLI, and VSIX methods
- [x] Troubleshooting section present
- [x] Service worker caches the page for offline access
- [x] Firebase hosting rewrite configured

---

## 8. Estimated Effort

| Task | Effort | Priority | Status |
|------|--------|----------|--------|
| A1 — Publisher Account | 30 min | P0 | ✅ Done |
| A2 — Extension Icon | 1–2 hrs | P0 | ✅ Done |
| A3 — package.json Metadata | 30 min | P0 | ✅ Done |
| A4 — Website Link Integration | 1 hr | P0 | ✅ Done (incl. sidebar globe button) |
| A5 — .vscodeignore | 15 min | P0 | ✅ Done |
| A6 — CHANGELOG.md | 30 min | P0 | ✅ Done (0.1.0 + 0.1.1) |
| A7 — LICENSE File | 15 min | P0 | ✅ Done |
| A8 — README Restructure | 2–3 hrs | P1 | ✅ Done |
| A9 — Screenshots | 1–2 hrs | P1 | ✅ Done (1 screenshot) |
| A10 — Test Packaging / esbuild | 2 hrs | P0 | ✅ Done |
| A11 — Security Review | 1 hr | P0 | ⬜ Pending |
| A12 — Publish | 30 min | P0 | ✅ Done (v0.1.0 + v0.1.1) |
| B1 — Page HTML | 2–3 hrs | P1 | ✅ Done |
| B2 — Page JS Module | 30 min | P1 | ✅ Done |
| B3 — Constants | 10 min | P1 | ✅ Done |
| B4 — Navigation Link | 15 min | P1 | ✅ Done |
| B5 — Page Styles | N/A | P2 | ✅ N/A (no custom CSS needed) |
| B6 — Service Worker | 15 min | P1 | ✅ Done |
| B7 — Firebase Hosting Rewrite | 10 min | P2 | ✅ Done |

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Publisher name `promptroot` already taken | Blocks publishing | Check early (A1); fallback: `promptroot-team` |
| Firebase config in source flagged by review | Listing rejection | Firebase web config is inherently public; add comment in README explaining this |
| Large VSIX from `firebase` npm dependency | Slow install / size rejection | ✅ Resolved — esbuild bundles and minifies to 485 KB |
| Activation crash on Firebase unavailability | Trees never load | ✅ Resolved — Firebase init wrapped in try-catch |
| Extension not activating without `prompts/` folder | Trees never load | ✅ Resolved — `onStartupFinished` + `onView:*` activation events added |
| Extension breaks on VS Code update | User complaints | Set `engines.vscode` to a stable range; test with Insiders before publishing |
| Marketplace SEO — hard to find | Low installs | Optimize `keywords`, `displayName`, `description`; drive traffic from [promptroot.ai](https://promptroot.ai) IDE Extension page |

---

## 10. Future Enhancements (Post-Launch)

- **Auto-update notifications** — in-extension banner when new version is available
- **Walkthrough contribution** — VS Code Getting Started walkthrough with step-by-step onboarding
- **Extension pack** — bundle with complementary extensions (Markdown preview, GitHub tools)
- **Telemetry** — opt-in usage analytics via VS Code telemetry API
- **Rating prompt** — after N successful queue runs, prompt user to rate on marketplace
- **Open VSX Registry** — publish to [open-vsx.org](https://open-vsx.org/) for non-Microsoft editors (VSCodium, Gitpod)
- **Deep links** — `vscode://promptroot.promptroot-vscode/open?prompt=...` URI handler

---

*This document should be updated as tasks are completed. Mark checkboxes and update the Status field at the top.*

**Website:** [https://promptroot.ai](https://promptroot.ai)
