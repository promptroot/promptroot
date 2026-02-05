# Jules API Research Summary for VS Code Extension

**Date:** February 5, 2026  
**Purpose:** Research existing Jules API implementation to inform Phase 4 integration

---

## Executive Summary

The prompt-sharing application has a mature Jules API integration that we can leverage for the VS Code extension. The API is Google's Jules coding assistant service, accessible via REST endpoints with API key authentication.

**Key Finding:** The existing implementation provides read-only and write operations against the Jules API. For Phase 4 (Read-Only), we should focus on viewing sources and sessions data.

---

## Jules API Overview

### Base URL
```
https://jules.googleapis.com/v1alpha
```

### Authentication
- API Key based: `X-Goog-Api-Key` header
- Keys are encrypted in Firestore using AES-GCM
- Decryption uses user UID as encryption key material
- Keys cached for 5 minutes to reduce decryption overhead

### Existing API Client (`src/modules/jules-api.js`)

The web app has a comprehensive API client with the following capabilities:

#### Read-Only Operations (Suitable for Phase 4)

1. **`listJulesSources(apiKey, pageToken)`**
   - Lists all repositories connected via Jules GitHub App
   - Paginated results
   - Returns: `{ sources: [...], nextPageToken: "..." }`

2. **`getJulesSourceDetails(apiKey, sourceId)`**
   - Get detailed info about a specific repository
   - Includes branch information
   - Returns source metadata

3. **`listJulesSessions(apiKey, pageSize, pageToken)`**
   - Lists recent Jules coding sessions
   - Default page size: 10 (configurable)
   - Paginated results
   - Returns: `{ sessions: [...], nextPageToken: "..." }`

4. **`getJulesSession(apiKey, sessionId)`**
   - Get details for a specific session
   - Includes state, prompt, timestamps
   - Session states: COMPLETED, FAILED, IN_PROGRESS, PLANNING, QUEUED

5. **`getJulesSessionActivities(apiKey, sessionId)`**
   - Get execution log and step history for a session
   - Returns activity timeline

6. **`loadJulesProfileInfo(uid)`**
   - High-level function that loads all profile data
   - Fetches sources and sessions in parallel
   - Handles API key decryption
   - Good candidate for extension to use

#### Write Operations (Phase 5 - Future)

7. **`createJulesSession(apiKey, sessionConfig)`**
   - Create new Jules coding session
   - Takes: prompt, title, sourceId, branch
   - Optional: autoCreatePR, requirePlanApproval

8. **`approveJulesSessionPlan(apiKey, sessionId)`**
   - Approve agent execution plan when paused

---

## Data Models

### Source (Repository)
```javascript
{
  name: "sources/12345",
  displayName: "owner/repo",
  // ... other metadata
}
```

### Session
```javascript
{
  name: "sessions/abc123",
  state: "COMPLETED" | "FAILED" | "IN_PROGRESS" | "PLANNING" | "QUEUED",
  prompt: "Fix the bug in...",
  title: "Fix bug",
  createTime: "2026-02-05T12:00:00Z",
  // ... other metadata
}
```

### Session Activity
```javascript
{
  activities: [
    { type: "...", timestamp: "...", details: "..." },
    // ... execution steps
  ]
}
```

---

## Security Implementation

### API Key Storage (Firestore)
- Collection: `julesKeys/{uid}`
- Keys encrypted with AES-GCM before storage
- Encryption key derived from user UID (padded to 32 bytes)
- IV derived from first 12 chars of UID

### Decryption Flow
```javascript
1. Fetch encrypted key from Firestore: julesKeys/{uid}
2. Derive encryption key from UID
3. Decrypt using AES-GCM with UID-based IV
4. Cache decrypted key for 5 minutes
5. Return plain text API key
```

### For VS Code Extension
- **Cannot use Firestore directly** (browser-only SDK)
- **Options:**
  1. Store API key in VS Code SecretStorage (user enters manually)
  2. Call a Cloud Function to decrypt and return the key
  3. Use VS Code authentication to get Firebase token, then call Cloud Function

---

## Recommended Approach for Phase 4

### Option A: Manual API Key Entry (Simplest)
**Pros:**
- No Firebase dependencies
- Works offline
- User has full control
- Aligns with VS Code patterns

**Cons:**
- User must manually copy key from web app
- No automatic sync with web app

**Implementation:**
```typescript
// VS Code settings
"promptroot.julesApiKey": {
  "type": "string",
  "description": "Your Jules API key"
}

// Store in SecretStorage
await context.secrets.store('promptroot.julesApiKey', apiKey);
const apiKey = await context.secrets.get('promptroot.julesApiKey');
```

### Option B: Firebase Cloud Function (More Integrated)
**Pros:**
- Reuses existing encryption/storage
- Automatic sync with web app
- Secure key handling

**Cons:**
- Requires Firebase authentication in VS Code
- Requires new Cloud Function
- More complex setup

**Implementation:**
```typescript
// 1. Authenticate user with Firebase
// 2. Call Cloud Function with user token
// 3. Function decrypts and returns key
// 4. Cache in VS Code SecretStorage
```

### Recommendation: **Start with Option A for Phase 4**
- Gets working functionality faster
- Simpler verification
- Can add Option B in later phase if desired

---

## Phase 4 Implementation Plan

### 1. Configuration Settings
Add to `vscode-extension/package.json`:
```json
{
  "configuration": {
    "properties": {
      "promptroot.julesApiEnabled": {
        "type": "boolean",
        "default": false,
        "description": "Enable Jules API integration"
      }
    }
  }
}
```

### 2. API Key Management
Create `src/jules-config.ts`:
- Store/retrieve API key from SecretStorage
- Validate API key format
- Clear cached key

### 3. API Client
Create `src/jules-client.ts`:
- Port `listJulesSources()` from web app
- Port `listJulesSessions()` from web app
- Add proper TypeScript types
- Error handling for network failures
- Timeout handling

### 4. UI Integration
Add commands:
- `promptroot.configureJulesApi` - Set up API key
- `promptroot.viewJulesSources` - Show sources in Quick Pick
- `promptroot.viewJulesSessions` - Show sessions in Quick Pick

### 5. Display Options
- Quick Pick for sources/sessions (simple, native VS Code UI)
- Or: Tree view provider (more complex, better for hierarchy)
- Or: Webview panel (most flexible, but more overhead)

**Recommendation:** Start with **Quick Pick** for simplicity.

---

## API Endpoints Needed for Phase 4

### Read-Only Operations
1. **List Sources** - `GET /sources`
   - Shows connected repositories
   - Use case: Let user see what repos Jules can access

2. **List Sessions** - `GET /sessions`
   - Shows recent coding sessions
   - Use case: Quick reference to past work

3. **Get Session Details** - `GET /sessions/{id}`
   - Shows full session info
   - Use case: View session status and results

### Headers Required
```typescript
{
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': apiKey
}
```

---

## Error Handling

### Common Error Scenarios
1. **No API key configured** → Prompt user to configure
2. **Invalid API key** → Show error, offer to reconfigure
3. **Network timeout** → Show retry option
4. **API rate limit** → Show friendly message, suggest waiting
5. **API unavailable** → Show offline message

### Error Messages (from web app)
```javascript
ERRORS.JULES_KEY_REQUIRED = "Jules API key is required"
JULES_MESSAGES.NOT_LOGGED_IN = "Please log in to use Jules"
JULES_MESSAGES.LOGIN_REQUIRED = "Login required"
```

---

## Testing Strategy for Phase 4

### Valid Scenarios
- Configure API key → Success message
- List sources → Show repositories
- List sessions → Show recent sessions
- Refresh data → Updated results

### Invalid Scenarios
- No API key → Show configuration prompt
- Invalid API key → Show error message
- Network failure → Show retry option
- Empty results → Show "No data" message

### Manual Testing Checklist
1. Configure API key via command
2. Verify key stored in SecretStorage
3. Call listJulesSources with valid key
4. Call listJulesSessions with valid key
5. Test with invalid/missing key
6. Test network timeout scenario
7. Test refresh command

---

## Next Steps

1. ✅ Research complete
2. Create Jules API client module for extension
3. Add SecretStorage for API key
4. Implement configuration command
5. Add Quick Pick UI for sources/sessions
6. Add error handling
7. Test all scenarios
8. Document usage

---

## References

- Web app Jules API client: `src/modules/jules-api.js`
- Jules API docs: `docs/JULES_API_INTEGRATION.md`
- Constants: `src/utils/constants.js` (JULES_API_BASE)
- VS Code SecretStorage: https://code.visualstudio.com/api/references/vscode-api#SecretStorage
- VS Code Quick Pick: https://code.visualstudio.com/api/references/vscode-api#QuickPick
