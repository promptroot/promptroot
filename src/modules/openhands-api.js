import { getAuth } from './firebase-service.js';
import { getDecryptedOpenHandsConfig } from './openhands-keys.js';

// ===== OpenHands API Client Module =====
// Connects to self-hosted or cloud OpenHands V1 endpoints.

function createOpenHandsHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

async function getActiveConfig() {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('Please sign in to configure or use OpenHands.');
  }
  const config = await getDecryptedOpenHandsConfig(user.uid);
  if (!config || !config.baseUrl) {
    throw new Error('OpenHands is not configured. Please enter your OpenHands Base URL in Profile Settings.');
  }
  
  // Require API key for the managed SaaS to prevent cryptic CORS errors from unauthenticated requests
  const isLocalhost = config.baseUrl.includes('localhost') || config.baseUrl.includes('127.0.0.1');
  if (!isLocalhost && !config.apiKey) {
    throw new Error('An OpenHands API Key is required when connecting to a remote OpenHands instance (like app.all-hands.dev).');
  }
  return config;
}

async function handleErrorResponse(response, defaultMsg) {
  let errorDetail = '';
  try {
    const errJson = await response.json();
    if (errJson) {
      if (errJson.detail) {
        if (typeof errJson.detail === 'string') {
          errorDetail = errJson.detail;
        } else if (Array.isArray(errJson.detail)) {
          errorDetail = errJson.detail.map(d => {
            const loc = d.loc ? d.loc.join('.') : '';
            return loc ? `${loc}: ${d.msg}` : d.msg;
          }).join(', ');
        } else {
          errorDetail = JSON.stringify(errJson.detail);
        }
      } else if (errJson.error) {
        errorDetail = errJson.error;
      } else if (errJson.message) {
        errorDetail = errJson.message;
      } else {
        errorDetail = JSON.stringify(errJson);
      }
    }
  } catch (_) {
    errorDetail = response.statusText;
  }
  
  const suffix = errorDetail ? `: ${errorDetail}` : '';
  return new Error(`${defaultMsg} (${response.status}${suffix})`);
}

async function openhandsFetch(path, options = {}, defaultErrorMsg = 'Failed to execute request') {
  const config = await getActiveConfig();
  const url = `${config.baseUrl}${path}`;
  
  // Merge headers: options.headers takes precedence, but Authorization from
  // createOpenHandsHeaders should ALWAYS be included to avoid auth failures
  const headers = {
    ...(options.headers || {}),           // Options headers first (can include additional headers)
    ...createOpenHandsHeaders(config.apiKey)  // Auth headers override to ensure they're always present
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors'  // Explicitly set CORS mode for cross-origin requests
    });
    
    if (!response.ok) {
      throw await handleErrorResponse(response, defaultErrorMsg);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
      throw new Error(`Failed to fetch from OpenHands at ${config.baseUrl}. If you are using app.all-hands.dev, this 'CORS' error often means your API Key is invalid or the OpenHands server rejected the payload. Please verify your API Key in Profile Settings.`);
    }
    throw error;
  }
}

export async function listAppConversations() {
  return await openhandsFetch('/api/v1/app-conversations/search?limit=100', {}, 'Failed to list conversations');
}

export async function createAppConversation(prompt, repository = null, branch = null) {
  const body = {
    initial_message: {
      content: [
        {
          type: "text",
          text: prompt
        }
      ]
    }
  };

  if (repository) {
    body.selected_repository = repository;
  }

  if (branch) {
    body.selected_branch = branch;
  }

  try {
    const tokenDataStr = sessionStorage.getItem('github_access_token');
    if (tokenDataStr) {
      const tokenData = JSON.parse(tokenDataStr);
      if (tokenData && tokenData.token) {
        body.github_token = tokenData.token;
      }
    }
  } catch (err) {
    console.warn('Could not read GitHub access token for OpenHands', err);
  }

  return await openhandsFetch('/api/v1/app-conversations', {
    method: 'POST',
    body: JSON.stringify(body)
  }, 'Failed to create OpenHands conversation');
}

export async function listSandboxes() {
  return await openhandsFetch('/api/v1/sandboxes/search', {}, 'Failed to list sandboxes');
}

export async function pauseSandbox(sandboxId) {
  return await openhandsFetch(`/api/v1/sandboxes/${sandboxId}/pause`, {
    method: 'POST',
    body: JSON.stringify({})
  }, 'Failed to pause sandbox');
}

export async function resumeSandbox(sandboxId) {
  return await openhandsFetch(`/api/v1/sandboxes/${sandboxId}/resume`, {
    method: 'POST',
    body: JSON.stringify({})
  }, 'Failed to resume sandbox');
}

export async function listSandboxSpecs() {
  return await openhandsFetch('/api/v1/sandbox-specs/search', {}, 'Failed to fetch sandbox specs');
}

export async function loadOpenHandsProfileInfo() {
  let firstError = null;

  const [conversationsResult, sandboxesResult, specsResult] = await Promise.all([
    listAppConversations().catch(err => {
      console.warn('Could not load OpenHands conversations:', err);
      firstError = firstError || err;
      return { conversations: [] };
    }),
    listSandboxes().catch(err => {
      console.warn('Could not load OpenHands sandboxes:', err);
      firstError = firstError || err;
      return { sandboxes: [] };
    }),
    listSandboxSpecs().catch(err => {
      console.warn('Could not load OpenHands sandbox specs:', err);
      firstError = firstError || err;
      return { sandbox_specs: [] };
    })
  ]);

  const conversations = conversationsResult.conversations || conversationsResult.items || (Array.isArray(conversationsResult) ? conversationsResult : []);
  const sandboxes = sandboxesResult.sandboxes || sandboxesResult.items || (Array.isArray(sandboxesResult) ? sandboxesResult : []);
  const sandboxSpecs = specsResult.sandbox_specs || specsResult.items || (Array.isArray(specsResult) ? specsResult : []);

  return {
    conversations,
    sandboxes,
    sandboxSpecs,
    error: firstError
  };
}

export async function waitForConversationReady(appConvId, maxAttempts = 8, delayMs = 1200) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await listAppConversations();
      const conversations = data.conversations || data.items || (Array.isArray(data) ? data : []);
      const match = conversations.find(c => 
        (c.id === appConvId || c.app_conversation_id === appConvId || c.conversation_id === appConvId) &&
        (c.conversation_id || c.app_conversation_id || (c.status && c.status !== 'WORKING'))
      );
      if (match) {
        console.log(`[OpenHands] Conversation ${appConvId} resolved to ready conversation (attempt ${attempt + 1}):`, match);
        return match;
      }
    } catch (err) {
      console.warn('[OpenHands] Polling conversation index warning:', err);
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function callRunOpenHandsFunction(promptText, sourceId, branch = 'master', title = '') {
  const user = getAuth()?.currentUser || null;
  if (!user) {
    throw new Error('Please sign in to run OpenHands.');
  }

  // Normalize sourceId to clean repository format (e.g., owner/repo)
  let cleanRepo = null;
  if (sourceId && typeof sourceId === 'string') {
    cleanRepo = sourceId.replace(/^sources\/github\//, '');
  }

  // Create OpenHands conversation
  const result = await createAppConversation(promptText, cleanRepo, branch);
  console.log('[OpenHands] createAppConversation initial response:', result);
  
  const initialId = result.id || result.app_conversation_id || result.conversation_id;
  if (!initialId) {
    throw new Error('OpenHands server did not return a valid conversation ID.');
  }

  // Wait briefly for OpenHands to index the newly created conversation and retrieve updated conversation metadata
  const readyItem = await waitForConversationReady(initialId);
  console.log('[OpenHands] readyItem from index:', readyItem);

  const targetObj = readyItem || result;

  // Prefer direct Web UI URL provided by server if available
  const directUrl = result.url || result.web_url || result.conversation_url || result.session_url || result.share_url ||
                    (readyItem && (readyItem.url || readyItem.web_url || readyItem.conversation_url || readyItem.session_url || readyItem.share_url));
  if (directUrl) {
    return directUrl;
  }

  // Extract the actual conversation ID (prefer conversation_id over app_conversation job ID)
  const conversationId = targetObj.conversation_id || targetObj.app_conversation_id || targetObj.id || initialId;

  // Get base URL to build Web UI URL
  const config = await getDecryptedOpenHandsConfig(user.uid);

  // If workspace ID is present in response, construct workspace-scoped URL
  const wsId = targetObj.workspace_id || targetObj.org_id || result.workspace_id || result.org_id;
  if (wsId) {
    return `${config.baseUrl}/workspaces/${wsId}/conversations/${conversationId}`;
  }

  return `${config.baseUrl}/conversations/${conversationId}`;
}
