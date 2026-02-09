// ===== Jules API Client Module =====
// Provides access to the Jules API for managing sources, sessions, and activities

import { getAuth } from './firebase-service.js';
import { JULES_API_BASE, ERRORS, PAGE_SIZES, JULES_MESSAGES, TIMEOUTS } from '../utils/constants.js';
import { showToast } from './toast.js';
import { handleError, ErrorCategory } from '../utils/error-handler.js';
import { clearCache, CACHE_KEYS } from '../utils/session-cache.js';
import { getDecryptedJulesKey, clearJulesKeyCache } from './jules-keys.js';

export { getDecryptedJulesKey, clearJulesKeyCache };

function createJulesHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey
  };
}

export async function listJulesSources(apiKey, pageToken = null) {
  const url = new URL(`${JULES_API_BASE}/sources`);
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }
  
  const response = await fetch(url.toString(), {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function getJulesSourceDetails(apiKey, sourceId) {
  const url = `${JULES_API_BASE}/${sourceId}`;
  const response = await fetch(url, {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source details: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function listJulesSessions(apiKey, pageSize = null, pageToken = null) {
  const url = new URL(`${JULES_API_BASE}/sessions`);
  url.searchParams.set('pageSize', (pageSize || PAGE_SIZES.julesSessions).toString());
  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function getJulesSession(apiKey, sessionId) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}`, {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    const error = new Error(`Failed to fetch session: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

export async function getJulesSessionActivities(apiKey, sessionId) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}/activities`, {
    headers: createJulesHeaders(apiKey)
  });

  if (!response.ok) {
    const error = new Error(`Failed to fetch session activities: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

export async function createJulesSession(apiKey, sessionConfig) {
  const body = {
    prompt: sessionConfig.prompt,
    title: sessionConfig.title || '',
    sourceContext: {
      source: sessionConfig.sourceId,
      githubRepoContext: {
        startingBranch: sessionConfig.branch
      }
    }
  };

  if (sessionConfig.autoCreatePR) {
    body.automationMode = 'AUTO_CREATE_PR';
  }

  if (sessionConfig.requirePlanApproval !== undefined) {
    body.requirePlanApproval = sessionConfig.requirePlanApproval;
  }

  const response = await fetch(`${JULES_API_BASE}/sessions`, {
    method: 'POST',
    headers: createJulesHeaders(apiKey),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function approveJulesSessionPlan(apiKey, sessionId) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}:approvePlan`, {
    method: 'POST',
    headers: createJulesHeaders(apiKey),
    body: JSON.stringify({})
  });

  if (!response.ok) {
    throw new Error(`Failed to approve plan: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

export async function loadJulesProfileInfo(uid) {
  const apiKey = await getDecryptedJulesKey(uid);
  if (!apiKey) {
    throw new Error(ERRORS.JULES_KEY_REQUIRED);
  }

  const fetchAllSources = async () => {
    let allSources = [];
    let pageToken = null;
    do {
      const response = await listJulesSources(apiKey, pageToken);
      if (response.sources) {
        allSources.push(...response.sources);
      }
      pageToken = response.nextPageToken;
    } while (pageToken);
    return allSources;
  };

  const [sources, sessionsData] = await Promise.all([
    fetchAllSources(),
    listJulesSessions(apiKey)
  ]);

  return {
    sources,
    sessions: sessionsData.sessions || []
  };
}

export async function callRunJulesFunction(promptText, sourceId, branch = 'master', title = '') {
  const user = getAuth()?.currentUser || null;
  if (!user) {
    handleError(JULES_MESSAGES.NOT_LOGGED_IN, { source: 'callRunJulesFunction' }, { category: ErrorCategory.AUTH });
    return null;
  }

  if (!sourceId) {
    throw new Error('No repository selected');
  }

  const julesBtn = document.getElementById('julesBtn');
  const originalText = julesBtn?.textContent;
  if (julesBtn) {
    julesBtn.textContent = 'Running...';
    julesBtn.disabled = true;
  }

  try {
    const sessionUrl = await runJulesAPI(promptText, sourceId, branch, title, user);
    
    // Invalidate session cache to ensure new session appears in profile
    clearCache(CACHE_KEYS.JULES_ACCOUNT, user.uid);

    if (julesBtn) {
      julesBtn.textContent = originalText;
      julesBtn.disabled = false;
    }

    return sessionUrl;
  } catch (error) {
    if (julesBtn) {
      julesBtn.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'icon icon-inline';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = 'smart_toy';
      julesBtn.appendChild(icon);
      julesBtn.appendChild(document.createTextNode(' Try in Jules'));
      julesBtn.disabled = false;
    }
    throw error;
  }
}

async function runJulesAPI(promptText, sourceId, branch, title, user) {
  const token = await user.getIdToken(true);
  const functionUrl = 'https://runjuleshttp-fjbc67s6eq-uc.a.run.app';

  const payload = { promptText: promptText || '', sourceId: sourceId, branch: branch, title: title };
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }

  return result.sessionUrl || null;
}

export async function handleTryInJules(promptText) {
  try {
    const user = getAuth()?.currentUser || null;
    if (!user) {
      try {
        const { signInWithGitHub } = await import('./auth.js');
        await signInWithGitHub();
        setTimeout(() => handleTryInJulesAfterAuth(promptText), TIMEOUTS.uiDelay);
      } catch (error) {
        handleError(JULES_MESSAGES.LOGIN_REQUIRED, { source: 'handleTryInJules.auth' }, { category: ErrorCategory.AUTH, toastType: 'warn' });
      }
      return;
    }
    await handleTryInJulesAfterAuth(promptText);
  } catch (error) {
    handleError(error, { source: 'handleTryInJules' }, { category: ErrorCategory.UNEXPECTED });
  }
}

export async function handleTryInJulesAfterAuth(promptText) {
  const user = getAuth()?.currentUser || null;
  if (!user) {
    handleError(JULES_MESSAGES.NOT_LOGGED_IN, { source: 'handleTryInJulesAfterAuth' }, { category: ErrorCategory.AUTH });
    return;
  }

  try {
    const { checkJulesKey } = await import('./jules-keys.js');
    const { showJulesKeyModal, showJulesEnvModal } = await import('./jules-modal.js');
    
    const hasKey = await checkJulesKey(user.uid);
    
    if (!hasKey) {
      showJulesKeyModal(() => {
        showJulesEnvModal(promptText);
      });
    } else {
      showJulesEnvModal(promptText);
    }
  } catch (error) {
    handleError(error, { source: 'handleTryInJulesAfterAuth' });
  }
}
