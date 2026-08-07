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
  
  // Require API key for remote hosts to prevent cryptic CORS errors from unauthenticated requests
  let isLocalhost = false;
  try {
    const hostname = new URL(config.baseUrl).hostname;
    isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch (_) {
    isLocalhost = false;
  }

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
  
  // Base headers first, options.headers takes precedence
  const headers = {
    ...createOpenHandsHeaders(config.apiKey),
    ...(options.headers || {})
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw await handleErrorResponse(response, defaultErrorMsg);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
      throw new Error(`Failed to fetch from OpenHands at ${config.baseUrl}. If you are connecting to a remote server, verify your API Key and network origin permissions.`);
    }
    throw error;
  }
}

export async function listAppConversations() {
  return await openhandsFetch('/api/v1/app-conversations/search?limit=100', {}, 'Failed to list conversations');
}

export async function createAppConversation(prompt, repository = null, branch = null, title = '') {
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
    body.git_provider = 'github';
  }

  if (branch) {
    body.selected_branch = branch;
  }

  if (title) {
    body.title = title;
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

export async function getAppConversationStartTasks(taskIds) {
  const ids = (Array.isArray(taskIds) ? taskIds : [taskIds]).map(encodeURIComponent).join(',');
  return await openhandsFetch(`/api/v1/app-conversations/start-tasks?ids=${ids}`, {}, 'Failed to check OpenHands conversation status');
}

// POST /api/v1/app-conversations returns an AppConversationStartTask, not the
// conversation itself. The task's own id is NOT a conversation id — the real
// app_conversation_id only appears once the task status reaches READY (sandbox
// provisioning and repository cloning can take well over 10 seconds).
export async function waitForConversationReady(startTaskId, maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let task = null;
    try {
      const data = await getAppConversationStartTasks(startTaskId);
      const tasks = data.items || data.tasks || (Array.isArray(data) ? data : []);
      task = tasks.find(t => t && t.id === startTaskId) || tasks[0] || null;
    } catch (err) {
      console.warn('[OpenHands] Polling start task warning:', err);
    }
    if (task) {
      if (task.status === 'ERROR') {
        throw new Error(task.detail || 'OpenHands failed to start the conversation.');
      }
      if (task.app_conversation_id) {
        console.log(`[OpenHands] Start task ${startTaskId} ready (attempt ${attempt + 1}):`, task);
        return task;
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function callRunOpenHandsFunction(promptText, sourceId, branch = 'main', title = '') {
  const user = getAuth()?.currentUser || null;
  if (!user) {
    throw new Error('Please sign in to run OpenHands.');
  }

  // Normalize sourceId to clean repository format (e.g., owner/repo)
  let cleanRepo = null;
  if (sourceId && typeof sourceId === 'string') {
    cleanRepo = sourceId.replace(/^sources\/github\//, '');
  }

  const result = await createAppConversation(promptText, cleanRepo, branch, title);
  const config = await getDecryptedOpenHandsConfig(user.uid);

  // Prefer direct Web UI URL if the server provides one
  const directUrl = result.url || result.web_url || result.conversation_url || result.session_url;
  if (directUrl) {
    return directUrl;
  }

  // Self-hosted instances may resolve immediately; otherwise poll the start task
  let conversationId = result.app_conversation_id || result.conversation_id;

  if (!conversationId) {
    const taskId = result.id;
    if (!taskId) {
      throw new Error('OpenHands server did not return a start task ID.');
    }
    const readyTask = await waitForConversationReady(taskId);
    conversationId = readyTask && readyTask.app_conversation_id;
  }

  if (!conversationId) {
    // The conversation was created but is still provisioning; open the
    // OpenHands home page so the user can see it appear in their list.
    console.warn('[OpenHands] Conversation still provisioning after polling window; opening home page.');
    return config.baseUrl;
  }

  return `${config.baseUrl}/conversations/${conversationId}`;
}
