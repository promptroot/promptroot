import { waitForFirebase } from '../shared-init.js';
import { getAuth } from '../modules/firebase-service.js';
import { listJulesSessions, getDecryptedJulesKey } from '../modules/jules-api.js';
import { showPromptViewer } from '../modules/prompt-viewer.js';
import { debounce } from '../utils/debounce.js';
import { createElement, createIcon } from '../utils/dom-helpers.js';
import { TIMEOUTS } from '../utils/constants.js';
import { loadFuse } from '../utils/lazy-loaders.js';

let allSessionsCache = [];
let sessionNextPageToken = null;
let isSessionsLoading = false;
let cachedSessions = null;
let cachedSearchData = null;
let cachedFuseInstance = null;

function waitForComponents() {
  if (document.querySelector('header')) {
    initApp();
  } else {
    setTimeout(waitForComponents, TIMEOUTS.componentCheck);
  }
}

async function loadSessionsPage() {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) return;
  
  const allSessionsList = document.getElementById('allSessionsList');
  const loadMoreSection = document.getElementById('sessionsLoadMore');
  const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');
  
  try {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading...';
    
    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      throw new Error('Jules API key not found');
    }
    
    const result = await listJulesSessions(apiKey, 50, sessionNextPageToken);
    
    if (result.sessions && result.sessions.length > 0) {
      allSessionsCache = [...allSessionsCache, ...result.sessions];
      sessionNextPageToken = result.nextPageToken || null;
      
      await renderAllSessions(allSessionsCache);
      
      if (sessionNextPageToken) {
        loadMoreSection.classList.remove('hidden');
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      } else {
        loadMoreSection.classList.add('hidden');
      }
    } else if (allSessionsCache.length === 0) {
      allSessionsList.replaceChildren();
      const noSessionsDiv = createElement('div', { className: 'list-empty' });
      noSessionsDiv.textContent = 'No sessions found';
      allSessionsList.appendChild(noSessionsDiv);
    }
  } catch (error) {
    if (allSessionsCache.length === 0) {
      allSessionsList.replaceChildren();
      const errorDiv = createElement('div', { 
        className: 'list-empty color-error'
      });
      errorDiv.textContent = `Failed to load sessions: ${error.message}`;
      allSessionsList.appendChild(errorDiv);
    }
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load More';
  }
}

export async function renderAllSessions(sessions) {
  const allSessionsList = document.getElementById('allSessionsList');
  const searchInput = document.getElementById('sessionSearchInput');
  const searchTerm = searchInput.value.trim();
  
  let filteredSessions = [];
  if (!searchTerm) {
    filteredSessions = sessions;
  } else {
    if (cachedSessions !== sessions) {
      cachedSessions = sessions;
      cachedSearchData = sessions.map(s => ({
        ...s,
        promptText: s.prompt || s.displayName || '',
        sessionId: s.name?.split('/').pop() || ''
      }));
      cachedFuseInstance = null; // Clear old instance
    }
    if (!cachedFuseInstance) {
      const Fuse = await loadFuse(); // Lazy load only when searching
      cachedFuseInstance = new Fuse(cachedSearchData, {
        keys: ['promptText', 'sessionId'],
        includeScore: true,
        threshold: 0.4,
      });
    }
    filteredSessions = cachedFuseInstance.search(searchTerm).map(result => result.item);
  }
  
  if (filteredSessions.length === 0 && searchTerm) {
    allSessionsList.replaceChildren();
    const noResultsDiv = createElement('div', {
      className: 'list-empty'
    });
    noResultsDiv.textContent = 'No sessions match your search';
    allSessionsList.appendChild(noResultsDiv);
    return;
  }
  
  allSessionsList.replaceChildren();

  filteredSessions.forEach(session => {
    const state = session.state || 'UNKNOWN';
    const stateIcons = {
      'COMPLETED': 'check_circle',
      'FAILED': 'cancel',
      'IN_PROGRESS': 'schedule',
      'PLANNING': 'schedule',
      'QUEUED': 'pause_circle',
      'AWAITING_USER_FEEDBACK': 'chat_bubble'
    };
    const stateIcon = stateIcons[state] || 'help';
    
    const stateLabel = {
      'COMPLETED': 'COMPLETED',
      'FAILED': 'FAILED',
      'IN_PROGRESS': 'IN PROGRESS',
      'PLANNING': 'IN PROGRESS',
      'QUEUED': 'QUEUED',
      'AWAITING_USER_FEEDBACK': 'AWAITING USER FEEDBACK'
    }[state] || state.replace(/_/g, ' ');
    
    const promptPreview = (session.prompt || 'No prompt text').substring(0, 150);
    const displayPrompt = promptPreview.length < (session.prompt || '').length ? promptPreview + '...' : promptPreview;
    const createdAt = session.createTime ? new Date(session.createTime).toLocaleString() : 'Unknown';
    const prUrl = session.outputs?.[0]?.pullRequest?.url;
    
    const sessionId = session.name?.split('sessions/')[1] || session.id?.split('sessions/')[1] || session.id;
    const sessionUrl = sessionId ? `https://jules.google.com/session/${sessionId}` : 'https://jules.google.com';
    
    const card = createElement('div', 'session-card');
    card.onclick = () => window.open(sessionUrl, '_blank', 'noopener');

    const metaDiv = createElement('div', 'session-meta', createdAt);
    const promptDiv = createElement('div', 'session-prompt', displayPrompt);

    const rowDiv = createElement('div', 'session-row');

    const pillSpan = createElement('span', 'session-pill');
    const iconSpan = createIcon(stateIcon, 'icon-inline');
    pillSpan.appendChild(iconSpan);
    pillSpan.appendChild(document.createTextNode(' ' + stateLabel));
    rowDiv.appendChild(pillSpan);

    if (prUrl) {
      const link = createElement('a', 'small-text', ' View PR');
      link.href = prUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.onclick = (e) => e.stopPropagation();
      const linkIcon = createIcon('link', 'icon-inline');
      link.prepend(linkIcon);
      rowDiv.appendChild(link);
    }

    const hintSpan = createElement('span', 'session-hint', ' Click to view session');
    const hintIcon = createIcon('info', 'icon-inline');
    hintSpan.prepend(hintIcon);
    rowDiv.appendChild(hintSpan);

    const viewBtn = createElement('button', 'btn-icon session-view-btn');
    viewBtn.title = 'View full prompt';
    viewBtn.onclick = (e) => {
      e.stopPropagation();
      showPromptViewer(session.prompt || 'No prompt text available', sessionId);
    };
    const viewIcon = createIcon('visibility');
    viewBtn.appendChild(viewIcon);
    rowDiv.appendChild(viewBtn);

    card.appendChild(metaDiv);
    card.appendChild(promptDiv);
    card.appendChild(rowDiv);

    allSessionsList.appendChild(card);
  });
}

async function loadSessions() {
  if (isSessionsLoading) return;
  const auth = getAuth();
  const user = auth?.currentUser;
  
  const loadingDiv = document.getElementById('sessionsLoading');
  const notSignedInDiv = document.getElementById('sessionsNotSignedIn');
  const sessionsList = document.getElementById('allSessionsList');
  
  if (!user) {
    loadingDiv.classList.add('hidden');
    sessionsList.classList.add('hidden');
    notSignedInDiv.classList.remove('hidden');
    return;
  }

  try {
    isSessionsLoading = true;
    loadingDiv.classList.remove('hidden');
    notSignedInDiv.classList.add('hidden');
    sessionsList.classList.add('hidden');
    
    await loadSessionsPage();
    
    loadingDiv.classList.add('hidden');
    sessionsList.classList.remove('hidden');
  } catch (err) {
    console.error('Sessions loading error:', err);
    loadingDiv.classList.add('hidden');
  } finally {
    isSessionsLoading = false;
  }
}

async function initApp() {
  try {
    await waitForFirebase();

    loadSessions();
    
    const searchInput = document.getElementById('sessionSearchInput');
    const searchClear = document.getElementById('sessionSearchClear');
    if (searchInput) {
      const toggleClear = () => {
        if (searchClear) {
          if (searchInput.value) {
            searchClear.classList.remove('hidden');
          } else {
            searchClear.classList.add('hidden');
          }
        }
      };
      
      const debouncedRender = debounce(async () => {
        await renderAllSessions(allSessionsCache);
      }, 300);
      
      searchInput.addEventListener('input', () => { 
        // Immediate UI updates
        toggleClear(); 
        // Debounced search
        debouncedRender();
      });
      if (searchClear && !searchClear.dataset.bound) {
        searchClear.dataset.bound = 'true';
        searchClear.addEventListener('click', async () => {
          searchInput.value = '';
          toggleClear();
          await renderAllSessions(allSessionsCache);
          searchInput.focus();
        });
      }
      toggleClear();
    }
    
    const loadMoreBtn = document.getElementById('loadMoreSessionsBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadSessionsPage);
    }

    const auth = getAuth();
    if (auth && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(() => {
        loadSessions();
      });
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForComponents);
} else {
  waitForComponents();
}
