import { cloudFunctionUrl } from '../utils/cloud-function-url.js';
import { getAuth } from './firebase-service.js';

async function getIdToken() {
  const auth = getAuth();
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken();
}

async function callFunction(name, payload, { token } = {}) {
  const bearer = token || await getIdToken();
  const response = await fetch(cloudFunctionUrl(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`
    },
    body: JSON.stringify(payload || {})
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const err = new Error(data.error || `HTTP ${response.status}`);
    err.statusCode = response.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

// In-memory caches — cleared on mutations, valid for the session lifetime.
let tenantsCache = null;
const sddListCache = new Map(); // tenantId → { data, ts }
const sddCache = new Map();     // `${tenantId}/${slug}` → data
const SDD_LIST_TTL = 60_000;

export async function listTenants() {
  if (tenantsCache) return tenantsCache;
  tenantsCache = await callFunction('listTenants', {});
  return tenantsCache;
}

export async function listSdds(tenantId) {
  const cached = sddListCache.get(tenantId);
  if (cached && Date.now() - cached.ts < SDD_LIST_TTL) return cached.data;
  const data = await callFunction('listSdds', { tenantId });
  sddListCache.set(tenantId, { data, ts: Date.now() });
  return data;
}

export async function getSdd(input) {
  const key = `${input.tenantId}/${input.slug}`;
  // Versioned lookups are not cached (rare, always fresh needed).
  if (!input.version && sddCache.has(key)) return sddCache.get(key);
  const data = await callFunction('getSdd', input);
  if (!input.version) sddCache.set(key, data);
  return data;
}

function invalidateTenant(tenantId) {
  tenantsCache = null;
  if (tenantId) sddListCache.delete(tenantId);
}

function invalidateSdd(tenantId, slug) {
  if (tenantId && slug) sddCache.delete(`${tenantId}/${slug}`);
  if (tenantId) sddListCache.delete(tenantId);
}

export async function createTenant(input) {
  const result = await callFunction('createTenant', input);
  tenantsCache = null;
  return result;
}

export async function updateTenant(input) {
  const result = await callFunction('updateTenant', input);
  invalidateTenant(input?.slug);
  return result;
}

export async function deleteTenant(input) {
  const result = await callFunction('deleteTenant', input);
  invalidateTenant(input?.slug);
  return result;
}

export async function createSdd(input) {
  const result = await callFunction('createSdd', input);
  invalidateSdd(input?.tenantId, input?.slug);
  return result;
}

export async function updateSdd(input) {
  const result = await callFunction('updateSdd', input);
  invalidateSdd(input?.tenantId, input?.slug);
  return result;
}

export const listVersions = (input) => callFunction('listVersions', input);
export const restoreVersion = (input) => callFunction('restoreVersion', input);

export const authorizeDevice = (userCode) => callFunction('authorizeDevice', { userCode });
export const listSessions = () => callFunction('listSessions', {});
export const revokeSession = (input) => callFunction('revokeSession', input);
