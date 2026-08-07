# Code Review: PR #829 — OpenHands Integration

| | |
|---|---|
| **PR** | [promptroot/promptroot#829](https://github.com/promptroot/promptroot/pull/829) |
| **Branch** | `open-hands-integration` → `main` |
| **Author** | RyanS4 |
| **Size** | +1,897 / −25 across 26 files (9 commits) |
| **Head reviewed** | `33219b2` |
| **Merge state** | ⚠️ **Conflicts with main** (`src/modules/copen-manager.js`, `src/utils/copen-config.js` — main has since added Qwen/Devin copens) |

## Verdict

The integration is functionally solid and well-scoped — the API client is careful about OpenHands' async start-task lifecycle, error normalization is thorough, and the new modules come with real unit tests. However, **two changes introduce XSS exposure** (a new `innerHTML` path in the shared `toast.js`, and `innerHTML` rendering of server-supplied data on the new workspace page), and several files break the project's own architecture rules (no HTML in JS, no inline styles, constants in `constants.js`). There is also dead/contradictory config (an unused Firestore rule and unused constants pointing at a different collection/default URL than the code actually uses). **Recommend: request changes** — fix the High items, rebase onto main, then this is mergeable.

---

## High severity

### H1. `toast.js` turns every toast into a potential XSS sink
`src/modules/toast.js:47-51`

```js
if (message.includes('<a ') || message.includes('</')) {
  messageEl.innerHTML = message;
} else {
  messageEl.textContent = message;
}
```

This heuristic switches the **shared, app-wide** toast component to `innerHTML` whenever the message merely *contains* `<a ` or `</`. Toast messages routinely embed server-controlled text:

- `openhands-api.js` builds `Error` messages from the OpenHands server's response body (`detail`, `error`, `message` fields in `handleErrorResponse`), and callers do `showToast('Failed to start OpenHands session: ' + err.message, 'error')` (`jules-free-input.js`, `openhands-modal.js`, `openhands-page.js`).
- A malicious/compromised OpenHands endpoint (or a MITM on the plain-HTTP `localhost` base URLs this PR explicitly enables) can return `{"detail": "</b><img src=x onerror=...>"}` and have it parsed as HTML.
- The success toasts interpolate `sessionUrl` — taken from the server response (`result.url || result.web_url || ...`) — **unescaped into an `href` attribute**, so a hostile server can inject `javascript:` URLs or break out of the attribute.

The site CSP (`script-src 'self'`, no `unsafe-inline`) blunts script execution on Firebase Hosting, but: (a) `pages/openhands/openhands.html` ships **without a CSP meta tag**, and per CLAUDE.md the app also deploys to GitHub Pages where `firebase.json` headers don't apply — there the sink is fully exploitable; (b) even under CSP, markup injection enables phishing links and UI spoofing inside a trusted toast.

**Fix:** revert `toast.js` to `textContent` only. For the "Open Workspace" link, extend `showToast` with an explicit, structured option (e.g. `{ link: { href, label } }`) built via `createElement`, and validate the URL scheme (`http:`/`https:`) before assigning `href`. This also removes the inline `style="..."` attributes in the link HTML, which violate the no-inline-styles rule.

### H2. Workspace page renders server data via `innerHTML` with incomplete sanitization
`src/pages/openhands-page.js` — `renderConversations()`, `renderSandboxes()`, `renderSpecs()`

Card markup is built with template literals + `innerHTML` from fields returned by the OpenHands server. Problems:

- `renderSandboxes`: `status` is interpolated **unsanitized** — `Status: <strong class="accent-text">${status.toUpperCase()}</strong>`.
- `DOMPurify.sanitize()` output is placed into **attribute contexts** (`data-id="${cleanId}"`, `href="${webUrl}"`). DOMPurify sanitizes HTML fragments; it does not quote-escape for attribute injection, so an `id` containing `"` breaks out of the attribute (and `webUrl` embeds the raw `id`).
- `renderConversations` crashes with a `TypeError` if a conversation has neither `id` nor `conversation_id` (`id.slice(0, 8)` on `undefined`).
- This directly violates the project rule *"No HTML in JavaScript: Use DOM APIs only (createElement, etc.)"* (CLAUDE.md), which every other page module follows.

**Fix:** build cards with `createElement`/`dom-helpers.js` and `textContent` (this makes DOMPurify unnecessary here and removes the CDN dependency from `openhands.html`), guard missing `id`s, and validate `baseUrl`-derived link URLs.

Related hardening in the same file: `card.style.display = 'flex'` etc. are inline styles — move to a CSS class.

---

## Medium severity

### M1. PR is not mergeable — conflicts with current `main`
`git merge-tree` confirms content conflicts in `src/modules/copen-manager.js` and `src/utils/copen-config.js` (main added Qwen and Devin copens: `cc2965c`, `7bcf9e5`). Rebase required; re-check the copen ID rename (M2) against the new lists.

### M2. Copen ID rename `allhands` → `openhands` has no migration
`src/modules/copen-manager.js:10`, `src/utils/copen-config.js:12`

Existing user state references the old ID:
- Firestore `userCopens/{uid}.disabledDefaults` containing `'allhands'` no longer matches — the copen silently reappears for users who disabled it.
- `userCopens/{uid}.order` entries for `'allhands'` no longer match, so OpenHands drops to the end of the user's custom ordering.
- `localStorage['copen-last-selection']` values of `'allhands'` no longer resolve to an option.

**Fix:** map `'allhands'` → `'openhands'` when reading stored config (one-line normalization in `getUserCopens`/wherever the stored selection is read), or keep the old ID and change only the label.

### M3. OpenHands modal silently clobbers the app-wide repo/branch selection
`src/modules/openhands-modal.js:29-40`

`localStorage.selectedRepoId` and `selectedBranchRepo` are the shared persistence keys used by `RepoSelector`/`BranchSelector` across the whole app (`src/modules/repo-branch-selector.js:94-100,804-813`). Merely *opening* the OpenHands env modal with an `owner/repo` overwrites the user's saved selection everywhere else (e.g. the Jules queue), even if they cancel. Pre-populate the selectors via their APIs/parameters instead of writing global storage.

### M4. Dead Firestore rule and contradictory constants
- `config/firestore/firestore.rules:63-66` adds a rule for `/openhandsKeys/{userId}` — but the code stores config in `users/{uid}.openhandsConfig` (`src/modules/openhands-keys.js`). The rule guards a collection that is never read or written. Either move storage to `openhandsKeys` (cleaner separation, mirrors `julesKeys`) or drop the rule.
- `src/utils/constants.js` adds `OPENHANDS.KEY_COLLECTION: 'openhandsKeys'` (unused, and wrong per above) and `OPENHANDS.DEFAULT_BASE_URL: 'http://localhost:3000'` (unused; the profile UI defaults to `https://app.all-hands.dev`, and `openhands-keys.js:105` hardcodes its own `'http://localhost:3000'` fallback). The entire `OPENHANDS_UI_TEXT` block is dead — `profile-page.js` hardcodes all of those strings. This contradicts the project convention that constants live in `constants.js` *and are used*.

**Fix:** pick one storage location, one default URL constant, and wire `OPENHANDS_UI_TEXT` into `profile-page.js` — or delete the unused constants and rule.

### M5. CSP changes are broader than the feature needs, and still don't cover the feature
`firebase.json`, `index.html`, `browser-extension/manifest.json`

- Production `connect-src` now allows `http://localhost:*`, `http://127.0.0.1:*`, and (firebase.json only) `ws://localhost:*` / `ws://127.0.0.1:*`. Nothing in this PR uses WebSockets — drop the `ws:` entries until needed.
- The **browser extension** manifest gets `http://localhost:*` and `https://*.all-hands.dev` added to its CSP, but no extension code in this PR talks to OpenHands. Unnecessary scope widening in a Chrome-review-sensitive file — revert.
- Conversely, the UI advertises support for *self-hosted* instances at arbitrary URLs ("Configure your OpenHands instance"), but any base URL that isn't `localhost` or `*.all-hands.dev` will be blocked by `connect-src`, and the resulting fetch failure will surface as the misleading "your API Key is invalid" message from `openhandsFetch`. Either document the limitation in the profile UI or detect the CSP block and say so.

### M6. API key "encryption" is derived from the (non-secret) Firebase UID
`src/modules/openhands-keys.js:66,150`

PBKDF2 password = `uid`, with salt/IV stored next to the ciphertext. Anyone who can read the Firestore doc almost certainly knows the UID (it's the document ID), so this is obfuscation rather than encryption. This **matches the existing `jules-keys.js` pattern** (same construction at `jules-keys.js:62`), so it's an inherited design decision, not a regression — but the PR description's "Security & Encryption Layer" framing oversells it. Worth a note in `docs/SECURITY.md`; a real fix (server-side key handling or a user-supplied passphrase) is out of scope here but should be tracked for both Jules and OpenHands keys.

---

## Low severity / code quality

1. **Header merge contradicts its comment** — `src/modules/openhands-api.js:70-76`: the comment says "options.headers takes precedence" but `createOpenHandsHeaders()` is spread last, so callers can never override `Content-Type`/`Accept`/`Authorization`. Harmless today; fix the comment or the order.
2. **`isLocalhost` substring check** — `openhands-api.js:28`: `baseUrl.includes('localhost')` matches `https://localhost.evil.com` or any URL containing the substring. It only gates a UX validation (API-key-required), but `new URL(baseUrl).hostname` checks are just as easy.
3. **Debug logging left in** — `jules-free-input.js` (a dozen `[FreeInput]` logs, including the user's UID), `openhands-api.js` (`console.log` of start-task payloads). Strip or downgrade to a debug flag before merge.
4. **Pointless `try { … } catch (error) { throw error; }`** wrapper in `encryptAndStoreOpenHandsConfig` (`openhands-keys.js`).
5. **Null-config crash path** — `openhands-page.js` `loadAndDisplayOpenHands()`: `checkOpenHandsConfig()` only checks the doc exists; if decryption then fails, `getDecryptedOpenHandsConfig()` returns `null` and `config.baseUrl` throws. Guard it.
6. **`deleteStoredOpenHandsConfig` writes `openhandsConfig: null`** instead of `FieldValue.delete()` — leaves a null field in the users doc forever. Cosmetic, but `checkOpenHandsConfig` truthiness handles it.
7. **Button state churn via `insertAdjacentHTML`** — `profile-page.js` save/delete handlers rebuild button content with HTML strings (twice each, duplicated in success and error paths). Use the icon helper + `createElement`, and extract a helper to de-duplicate.
8. **Modal cleanup edge** — `openhands-modal.js`: `handleSubmit` re-enables the submit button in `finally` after the modal is already hidden; harmless but confusing. Also missing trailing newline (only file in the PR without one).
9. **No `/openhands` rewrite** in `firebase.json` — every comparable page (`/openclaw`, `/agent-api`, …) has a clean-URL rewrite; nav links use the full path so nothing breaks, but it's inconsistent.
10. **Firestore users-doc double caching** — `openhands-keys.js` caches the *entire* `users/{uid}` doc in sessionStorage under `openhands_key_data` (via `getDoc`'s cacheKey), plus a 5-minute in-memory cache of the decrypted config. Two caches of the same doc under different keys can drift from other modules' view of `users/{uid}`. The stored blob is ciphertext, so no secret leaks — but consider caching only `openhandsConfig`.

---

## Tests

- `openhands-api.test.js` (309 lines) is genuinely good: covers request shapes, the `items` fallback, start-task polling incl. ERROR and timeout, and all three `callRunOpenHandsFunction` resolution paths.
- `openhands-keys.test.js` is **largely tautological**: WebCrypto, `TextEncoder`/`TextDecoder`, `atob`/`btoa` are all mocked (identity or fixed-string), so the tests verify call wiring, not that encrypt→decrypt round-trips. jsdom + Node's real `webcrypto` could test the actual round-trip cheaply.
- **No tests** for the `toast.js` behavior change (the riskiest diff in the PR), `openhands-modal.js`, `openhands-page.js` rendering, or the `variable-substitution.js` agent-routing changes.
- E2E: only the dropdown-option assertion was extended — reasonable for extended suite scope.

## What's good

- The start-task lifecycle handling in `openhands-api.js` (poll `start-tasks` until `app_conversation_id`, direct-URL short-circuit, home-page fallback) is well thought out and clearly commented.
- Error normalization (`handleErrorResponse` handling string/array/object `detail`) and the CORS-vs-auth hint are user-friendly touches.
- Dynamic `import()` keeps OpenHands modules out of the initial load for users who never touch the feature, consistent with the codebase's lazy-loading pattern.
- Modal/CSS reuse (`jules-modals.css` selector extension, `RepoSelector`/`BranchSelector` reuse) fits the existing architecture.
- `variable-substitution.js` "Send to <last agent>" generalization is a nice UX improvement beyond the minimum.

## Recommended merge checklist

1. ~~Fix H1 (revert `toast.js` to `textContent`; structured link option)~~ — **blocker**
2. ~~Fix H2 (DOM-API rendering on workspace page)~~ — **blocker**
3. Rebase onto `main`, resolve copen conflicts (M1)
4. Add `allhands` → `openhands` normalization (M2)
5. Stop writing global `selectedRepoId`/`selectedBranchRepo` from the modal (M3)
6. Reconcile `openhandsKeys` rule + constants with actual storage; remove dead `OPENHANDS_UI_TEXT` or use it (M4)
7. Trim CSP additions (`ws:`, extension manifest) (M5)
8. Strip debug `console.log`s (L3)
