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

export const createTenant = (input) => callFunction('createTenant', input);
export const listTenants = () => callFunction('listTenants', {});
export const updateTenant = (input) => callFunction('updateTenant', input);
export const deleteTenant = (input) => callFunction('deleteTenant', input);
export const createSdd = (input) => callFunction('createSdd', input);
export const updateSdd = (input) => callFunction('updateSdd', input);
export const listSdds = (tenantId) => callFunction('listSdds', { tenantId });
export const getSdd = (input) => callFunction('getSdd', input);
export const listVersions = (input) => callFunction('listVersions', input);
export const restoreVersion = (input) => callFunction('restoreVersion', input);

export const authorizeDevice = (userCode) => callFunction('authorizeDevice', { userCode });
export const listSessions = () => callFunction('listSessions', {});
export const revokeSession = (input) => callFunction('revokeSession', input);
