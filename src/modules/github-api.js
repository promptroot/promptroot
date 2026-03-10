import { getAuth } from './firebase-service.js';
import { GIST_POINTER_REGEX, GIST_URL_REGEX, CACHE_DURATIONS } from '../utils/constants.js';

let rateLimitInfo = {
  remaining: null,
  limit: null,
  reset: null,
  lastUpdated: null
};

const inFlightRequests = new Map();

// Directory cache for Contents API with shared TTL
const directoryCache = new Map();

// Export function to clear caches (mainly for testing)
export function clearCaches() {
  directoryCache.clear();
  inFlightRequests.clear();
}

export function getRateLimitInfo() {
  return { ...rateLimitInfo };
}

function updateRateLimitInfo(headers) {
  if (!headers) return;
  
  const remaining = headers.get('X-RateLimit-Remaining');
  const limit = headers.get('X-RateLimit-Limit');
  const reset = headers.get('X-RateLimit-Reset');
  
  if (remaining !== null) {
    rateLimitInfo.remaining = parseInt(remaining, 10);
  }
  if (limit !== null) {
    rateLimitInfo.limit = parseInt(limit, 10);
  }
  if (reset !== null) {
    rateLimitInfo.reset = parseInt(reset, 10) * 1000;
  }
  rateLimitInfo.lastUpdated = Date.now();
  rateLimitInfo.lastUpdated = Date.now();
}

function checkRateLimitError(res) {
  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (remaining === '0') {
      const reset = res.headers.get('X-RateLimit-Reset');
      const resetTime = reset ? parseInt(reset, 10) * 1000 : Date.now() + 3600000;
      const error = new Error('GitHub API rate limit exceeded');
      error.isRateLimit = true;
      error.resetTime = resetTime;
      error.status = 403;
      throw error;
    }
  }
}

async function fetchWithHeaders(url, headers) {
  const res = await fetch(url, {
    cache: 'no-store',
    headers
  });
  
  // Update rate limit tracking
  updateRateLimitInfo(res.headers);
  
  // Check for rate limit error
  checkRateLimitError(res);
  
  return res;
}

const TOKEN_MAX_AGE = 60 * 24 * 60 * 60 * 1000; // 60 days

async function getGitHubAccessToken() {
  try {
    const user = getAuth()?.currentUser;
    if (!user) return null;

    const isGitHubAuth = user.providerData.some(p => p.providerId === 'github.com');
    if (!isGitHubAuth) return null;

    const tokenDataStr = sessionStorage.getItem('github_access_token');
    if (!tokenDataStr) return null;

    const parsed = JSON.parse(tokenDataStr);
    const isObject = parsed !== null && typeof parsed === 'object';
    const token = isObject ? parsed.token : undefined;
    const timestamp = isObject ? parsed.timestamp : undefined;
    
    // Validate token is a non-empty string and timestamp is valid
    if (typeof token !== 'string' || !token || !Number.isFinite(timestamp)) {
      sessionStorage.removeItem('github_access_token');
      return null;
    }
    
    // Validate timestamp is not in the future and not expired
    const now = Date.now();
    if (timestamp > now || now - timestamp > TOKEN_MAX_AGE) {
      sessionStorage.removeItem('github_access_token');
      return null;
    }

    return token;
  } catch (error) {
    console.error('GitHub API token retrieval failed:', error);
    return null;
  }
}

export async function fetchJSON(url) {
  try {
    const headers = { 'Accept': 'application/vnd.github+json' };
    
    const token = await getGitHubAccessToken();
    if (token && typeof token === 'string' && token.length > 0) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetchWithHeaders(url, headers);
    
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    // Re-throw rate limit errors for better handling upstream
    if (e.isRateLimit) {
      throw e;
    }
    console.error('GitHub API fetch failed:', e);
    return null;
  }
}

export async function fetchJSONWithETag(url, etag = null) {
  try {
    const headers = { 'Accept': 'application/vnd.github+json' };
    
    const token = await getGitHubAccessToken();
    if (token && typeof token === 'string' && token.length > 0) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    
    const res = await fetchWithHeaders(url, headers);
    
    if (res.status === 304) {
      return { notModified: true, etag };
    }
    
    if (!res.ok) {
      const error = new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
      error.status = res.status;
      return { data: null, etag: null, error };
    }
    
    const data = await res.json();
    const newEtag = res.headers.get('ETag');
    
    return { data, etag: newEtag, notModified: false };
  } catch (e) {
    // Re-throw rate limit errors
    if (e.isRateLimit) {
      return { data: null, etag: null, error: e };
    }
    console.error('GitHub API fetch with ETag failed:', e);
    return { data: null, etag: null, error: e };
  }
}

function encodePathPreservingSlashes(path) {
  return String(path)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export async function listPromptsViaContents(owner, repo, branch, path = 'prompts') {
  const encodedPath = encodePathPreservingSlashes(path);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}&ts=${Date.now()}`;
  
  // Check cache first
  const cacheKey = `${owner}/${repo}@${branch}:${path}`;
  const cached = directoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATIONS.short) {
    return cached.data;
  }
  
  const entries = await fetchJSON(url);
  if (!Array.isArray(entries)) return [];

  const files = [];
  const directories = [];
  
  // Separate files and directories
  for (const entry of entries) {
    if (entry.type === 'file' && /\.md$/i.test(entry.name)) {
      files.push({
        type: 'file',
        name: entry.name,
        path: entry.path,
        sha: entry.sha,
        download_url: entry.download_url
      });
    } else if (entry.type === 'dir') {
      directories.push(entry.path);
    }
  }
  
  // Process directories in batches of 3 for controlled concurrency
  const BATCH_SIZE = 3;
  const allChildren = [];
  
  for (let i = 0; i < directories.length; i += BATCH_SIZE) {
    const batch = directories.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(dirPath => listPromptsViaContents(owner, repo, branch, dirPath))
    );
    allChildren.push(...batchResults.flat());
  }
  
  const results = [...files, ...allChildren];
  
  // Cache the results
  directoryCache.set(cacheKey, {
    data: results,
    timestamp: Date.now()
  });
  
  return results;
}

export async function listPromptsViaTrees(owner, repo, branch, path = 'prompts', etag = null) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  
  const requestKey = `trees:${owner}/${repo}@${branch}`;
  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }
  
  const requestPromise = (async () => {
    try {
      const result = await fetchJSONWithETag(url, etag);
      
      if (result.notModified) {
        return { notModified: true, etag: result.etag };
      }
      
      if (!result.data) {
        if (result.error) {
          throw result.error;
        }
        throw new Error('Failed to fetch tree data');
      }
      
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pathRegex = new RegExp(`^${escapedPath}/.+\\.md$`, 'i');
      const items = (result.data.tree || []).filter(n => n.type === 'blob' && pathRegex.test(n.path));
      const files = items.map(n => ({
        type: 'file',
        name: n.path.split('/').pop(),
        path: n.path,
        sha: n.sha
      }));
      
      return { files, etag: result.etag };
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();
  
  inFlightRequests.set(requestKey, requestPromise);
  
  return requestPromise;
}

export async function fetchRawFile(owner, repo, branch, path) {
  const encodedPath = encodePathPreservingSlashes(path);
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.text();
}

export async function resolveGistRawUrl(gistUrl) {
  if (GIST_POINTER_REGEX.test(gistUrl)) {
    return gistUrl;
  }

  const match = gistUrl.match(/^https:\/\/gist\.github\.com\/([\w-]+)\/([a-f0-9]+)\/?(?:#file-([\w.-]+))?(?:\?file=([\w.-]+))?$/i);
  if (!match) {
    throw new Error('Invalid gist URL format');
  }

  const [, user, gistId, fragmentFile, queryFile] = match;
  const targetFile = fragmentFile || queryFile;

  if (targetFile) {
    return `https://gist.githubusercontent.com/${user}/${gistId}/raw/${targetFile}`;
  } else {
    const apiUrl = `https://api.github.com/gists/${gistId}`;
    const res = await fetch(apiUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch gist metadata: ${res.status}`);
    }
    const gistData = await res.json();
    const files = Object.keys(gistData.files);

    let bestFile = files.find(f => f.endsWith('.md')) || files[0];

    if (!bestFile) {
      throw new Error('No files found in gist');
    }

    return `https://gist.githubusercontent.com/${user}/${gistId}/raw/${bestFile}`;
  }
}

export async function fetchGistContent(gistUrl, cache = new Map()) {
  const cacheKey = `gist:${gistUrl}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const url = gistUrl.includes('?')
    ? `${gistUrl}&ts=${Date.now()}`
    : `${gistUrl}?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Gist fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  cache.set(cacheKey, text);
  return text;
}

export function isGistPointer(text) {
  const trimmed = text.trim();
  return GIST_POINTER_REGEX.test(trimmed) || GIST_URL_REGEX.test(trimmed);
}

export function isGistUrl(url) {
  return GIST_POINTER_REGEX.test(url) || GIST_URL_REGEX.test(url);
}

export async function getBranches(owner, repo) {
  const requestKey = `branches:${owner}/${repo}`;
  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }
  
  const requestPromise = (async () => {
    try {
      const perPage = 100;
      const maxPages = 10;
      const branches = [];

      for (let page = 1; page <= maxPages; page++) {
        const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=${perPage}&page=${page}&ts=${Date.now()}`;
        const batch = await fetchJSON(url);

        if (!Array.isArray(batch) || batch.length === 0) {
          break;
        }

        branches.push(...batch);

        if (batch.length < perPage) {
          break;
        }
      }

      return branches;
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();
  
  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
}
