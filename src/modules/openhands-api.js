import { getAuth } from './firebase-service.js';
import { getDecryptedOpenHandsConfig } from './openhands-keys.js';

// ===== OpenHands API Client Module =====
// Connects to self-hosted or cloud OpenHands V1 endpoints.

function createOpenHandsHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json'
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
      throw new Error(`Could not connect to OpenHands at ${config.baseUrl}. Please check that OpenHands is running and CORS is allowed.`);
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
  
  // Extract conversation ID
  const conversationId = result.id || result.conversation_id;
  if (!conversationId) {
    throw new Error('OpenHands server did not return a valid conversation ID.');
  }

  // Get base URL to build Web UI URL
  const config = await getDecryptedOpenHandsConfig(user.uid);
  return `${config.baseUrl}/conversations/${conversationId}`;
}
