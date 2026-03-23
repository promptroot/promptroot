let currentPageData = null;
const pageTitleInput = document.getElementById('pageTitle');
const filenameInput = document.getElementById('filename');
const previewDiv = document.getElementById('preview');
const downloadBtn = document.getElementById('downloadBtn');
const syncBtn = document.getElementById('syncBtn');
const statusDiv = document.getElementById('status');
const connectGitHubBtn = document.getElementById('connectGitHubBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const githubDisconnected = document.getElementById('githubDisconnected');
const githubConnected = document.getElementById('githubConnected');
const githubAvatar = document.getElementById('githubAvatar');
const githubUsername = document.getElementById('githubUsername');
const repoPath = document.getElementById('repoPath');

const iconHelpers = window.IconHelpers;
if (!iconHelpers) {
  throw new Error('IconHelpers not loaded. Ensure icon-helpers.js is included before popup.js');
}

const { createIcon, createIconWithText, ICONS } = iconHelpers;

function setButtonContent(btn, iconName, text, iconOptions = { size: 'inline' }) {
  btn.replaceChildren();
  btn.insertAdjacentHTML('beforeend', createIcon(iconName, iconOptions));
  if (text) {
    btn.appendChild(document.createTextNode(' ' + text));
  }
}

function restoreSyncButton() {
  syncBtn.replaceChildren();
  const img = document.createElement('img');
  img.src = 'PromptRootLogo.svg';
  img.alt = '';
  img.className = 'button-icon';
  syncBtn.appendChild(img);
  syncBtn.appendChild(document.createTextNode('Send to PromptRoot'));
}

function setDownloadButtonIdle() {
  setButtonContent(downloadBtn, ICONS.DOWNLOAD, 'Download');
}

async function init() {
  await updateGitHubStatus();
  setButtonContent(connectGitHubBtn, ICONS.LINK, 'Connect to GitHub');
  setButtonContent(disconnectBtn, ICONS.LOGOUT, '', { title: 'Disconnect' });
  disconnectBtn.title = 'Disconnect';
  setDownloadButtonIdle();
  extractContent();
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'authSuccess') {
      updateGitHubStatus();
      showStatus('Connected to GitHub!', 'success');
    }
  });
}

async function extractContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Inject content script on-demand
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Could not connect to page. Try refreshing.', 'error');
        return;
      }
      
      if (response && response.success) {
        currentPageData = response;
        displayPageData(response);
      } else {
        showStatus('Error extracting content: ' + (response?.error || 'Unknown error'), 'error');
      }
    });
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

function displayPageData(data) {
  pageTitleInput.value = data.title;
  pageTitleInput.disabled = false;
  
  const filename = generateFilename(data.title, data.domain);
  filenameInput.value = filename;
  
  const previewText = data.markdown.substring(0, 500) + '...';
  previewDiv.textContent = previewText;
  
  downloadBtn.disabled = false;
  GitHubAuth.isAuthenticated().then(isAuth => {
    syncBtn.disabled = !isAuth;
  });
}

function generateFilename(title, domain) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  
  const domainShort = domain.replace(/^www\./, '').split('.')[0];
  
  return `${timestamp}-${domainShort}-${safeName || 'page'}.md`;
}

function downloadMarkdown() {
  if (!currentPageData) {
    showStatus('No content to save', 'error');
    return;
  }
  
  const filename = filenameInput.value.trim();
  if (!filename) {
    showStatus('Please enter a filename', 'error');
    return;
  }
  
  const finalFilename = filename.endsWith('.md') ? filename : filename + '.md';
  
  downloadBtn.disabled = true;
  setButtonContent(downloadBtn, ICONS.LOADING, 'Downloading...');
  showStatus('Preparing download...', 'info');
  
  try {
    const blob = new Blob([currentPageData.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('Downloaded successfully!', 'success');
    setTimeout(() => {
      downloadBtn.disabled = false;
      setDownloadButtonIdle();
    }, 1500);
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    downloadBtn.disabled = false;
    setDownloadButtonIdle();
  }
}

async function syncToGitHub() {
  if (!currentPageData) {
    showStatus('No content to send', 'error');
    return;
  }
  
  const filename = filenameInput.value.trim();
  if (!filename) {
    showStatus('Please enter a filename', 'error');
    return;
  }
  
  const finalFilename = filename.endsWith('.md') ? filename : filename + '.md';
  
  syncBtn.disabled = true;
  setButtonContent(syncBtn, ICONS.LOADING, 'Sending...');
  showStatus('Sending to PromptRoot...', 'info');
  
  try {
    const result = await GitHubSync.syncWebClip(
      currentPageData.title,
      currentPageData.url,
      currentPageData.markdown,
      finalFilename
    );
    
    if (result.success) {
      showStatus(result.message, 'success');
      
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = result.url;
        link.textContent = 'View on GitHub';
        link.className = 'link block mt-8';
        link.target = '_blank';
        statusDiv.appendChild(link);
      }, 100);
    } else {
      showStatus(result.error, 'error');
    }
    
    syncBtn.disabled = false;
    restoreSyncButton();
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    syncBtn.disabled = false;
    restoreSyncButton();
  }
}

async function updateGitHubStatus() {
  const status = await GitHubSync.getSyncStatus();
  
  if (status.connected && status.username) {
    githubDisconnected.classList.add('hidden');
    githubConnected.classList.remove('hidden');
    githubUsername.textContent = `@${status.username}`;
    repoPath.textContent = status.branch ? `${status.repo}/${status.branch}` : status.repo;

    try {
      let avatarUrl = null;
      const cachedUser = await GitHubAuth.getUserInfo();
      if (cachedUser && typeof cachedUser.avatar_url === 'string') {
        avatarUrl = cachedUser.avatar_url;
      }

      if (!avatarUrl) {
        const token = await GitHubAuth.getAccessToken();
        if (token) {
          const response = await fetch('https://api.github.com/user', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
          if (response.ok) {
            const me = await response.json();
            if (me && typeof me.avatar_url === 'string') {
              avatarUrl = me.avatar_url;
            }
          }
        }
      }

      if (githubAvatar && avatarUrl) {
        githubAvatar.classList.add('hidden');
        githubAvatar.onload = () => {
          githubAvatar.classList.remove('hidden');
        };
        githubAvatar.onerror = () => {
          githubAvatar.removeAttribute('src');
          githubAvatar.classList.add('hidden');
        };
        githubAvatar.src = avatarUrl;
      } else if (githubAvatar) {
        githubAvatar.removeAttribute('src');
        githubAvatar.classList.add('hidden');
      }
    } catch {
      if (githubAvatar) {
        githubAvatar.removeAttribute('src');
        githubAvatar.classList.add('hidden');
      }
    }
    
    syncBtn.disabled = false;
  } else {
    githubDisconnected.classList.remove('hidden');
    githubConnected.classList.add('hidden');
    syncBtn.disabled = true;

    if (repoPath) {
      repoPath.textContent = '';
    }

    if (githubAvatar) {
      githubAvatar.removeAttribute('src');
      githubAvatar.classList.add('hidden');
    }
  }
}

async function connectToGitHub() {
  try {
    await GitHubAuth.startOAuthFlow();
    showStatus('Opening GitHub authentication...', 'info');
  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
  }
}

async function disconnectFromGitHub() {
  const confirmed = confirm('Are you sure you want to disconnect from GitHub?');
  if (!confirmed) return;
  
  const success = await GitHubAuth.logout();
  if (success) {
    await updateGitHubStatus();
    showStatus('Disconnected from GitHub', 'info');
  } else {
    showStatus('Error disconnecting', 'error');
  }
}

function showStatus(message, type) {
  statusDiv.replaceChildren();

  const iconName = type === 'success' ? ICONS.CHECK : type === 'error' ? ICONS.ERROR : ICONS.INFO;
  statusDiv.insertAdjacentHTML('beforeend', createIcon(iconName, { size: 'inline' }));
  statusDiv.appendChild(document.createTextNode(' ' + message));

  statusDiv.className = `status ${type}`;
}

downloadBtn.addEventListener('click', downloadMarkdown);
syncBtn.addEventListener('click', syncToGitHub);
connectGitHubBtn.addEventListener('click', connectToGitHub);
disconnectBtn.addEventListener('click', disconnectFromGitHub);

init();
