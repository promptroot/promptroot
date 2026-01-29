/**
 * Copen Manager
 * Manages user's custom copens in Firestore
 */

import { getDb } from './firebase-service.js';

const DEFAULT_COPENS = [
  { id: 'blank', label: 'Blank', icon: 'public', url: 'about:blank', isDefault: true },
  { id: 'claude', label: 'Claude', icon: 'smart_toy', url: 'https://claude.ai/code', isDefault: true },
  { id: 'codex', label: 'Codex', icon: 'forum', url: 'https://chatgpt.com/codex', isDefault: true },
  { id: 'copilot', label: 'Copilot', icon: 'code', url: 'https://github.com/copilot/agents', isDefault: true },
  { id: 'gemini', label: 'Gemini', icon: 'auto_awesome', url: 'https://gemini.google.com/app', isDefault: true },
  { id: 'chatgpt', label: 'ChatGPT', icon: 'chat', url: 'https://chatgpt.com/', isDefault: true }
];

const CUSTOM_COPEN_ICON = 'extension'; // Material icon to indicate custom copen

/**
 * Get all copens for a user (defaults + custom)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of copen objects
 */
export async function getUserCopens(userId) {
  if (!userId) {
    return [...DEFAULT_COPENS];
  }

  try {
    const db = getDb();
    const docRef = db.collection('userCopens').doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // Initialize with defaults
      return [...DEFAULT_COPENS];
    }

    const data = doc.data();
    const customCopens = data.customCopens || [];
    const disabledDefaults = data.disabledDefaults || [];

    // Mark disabled defaults
    const allDefaults = DEFAULT_COPENS.map(c => ({
      ...c,
      disabled: disabledDefaults.includes(c.id)
    }));

    // Combine defaults with custom copens
    const allCopens = [...allDefaults, ...customCopens];

    return allCopens;
  } catch (error) {
    console.error('Error fetching user copens:', error);
    return [...DEFAULT_COPENS];
  }
}

/**
 * Add a copen link
 * @param {string} userId - User ID
 * @param {object} copen - Copen object {label, url, icon}
 * @returns {Promise<string>} ID of the new copen
 */
export async function addCustomCopen(userId, copen) {
  if (!userId) throw new Error('User ID required');
  if (!copen.label || !copen.url) throw new Error('Label and URL required');

  const db = getDb();
  const docRef = db.collection('userCopens').doc(userId);
  
  const newCopen = {
    id: `custom_${Date.now()}`,
    label: copen.label,
    url: copen.url,
    icon: copen.icon || CUSTOM_COPEN_ICON,
    isDefault: false,
    createdAt: new Date().toISOString()
  };

  try {
    await docRef.set({
      customCopens: firebase.firestore.FieldValue.arrayUnion(newCopen)
    }, { merge: true });

    return newCopen.id;
  } catch (error) {
    console.error('Error adding custom copen:', error);
    throw error;
  }
}

/**
 * Update a copen link
 * @param {string} userId - User ID
 * @param {string} copenId - Copen ID
 * @param {object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateCustomCopen(userId, copenId, updates) {
  if (!userId) throw new Error('User ID required');

  const db = getDb();
  const docRef = db.collection('userCopens').doc(userId);
  
  try {
    const doc = await docRef.get();
    if (!doc.exists) return;

    const data = doc.data();
    const customCopens = data.customCopens || [];
    
    const index = customCopens.findIndex(c => c.id === copenId);
    if (index === -1) throw new Error('Copen not found');

    customCopens[index] = {
      ...customCopens[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await docRef.update({ customCopens });
  } catch (error) {
    console.error('Error updating Copen link:', error);
    throw error;
  }
}

/**
 * Delete a copen link
 * @param {string} userId - User ID
 * @param {string} copenId - Copen ID
 * @returns {Promise<void>}
 */
export async function deleteCustomCopen(userId, copenId) {
  if (!userId) throw new Error('User ID required');

  const db = getDb();
  const docRef = db.collection('userCopens').doc(userId);
  
  try {
    const doc = await docRef.get();
    if (!doc.exists) return;

    const data = doc.data();
    const customCopens = data.customCopens || [];
    
    const filtered = customCopens.filter(c => c.id !== copenId);
    await docRef.update({ customCopens: filtered });
  } catch (error) {
    console.error('Error deleting copen link:', error);
    throw error;
  }
}

/**
 * Toggle default copen enabled/disabled
 * @param {string} userId - User ID
 * @param {string} copenId - Default copen ID
 * @param {boolean} enabled - Enable or disable
 * @returns {Promise<void>}
 */
export async function toggleDefaultCopen(userId, copenId, enabled) {
  if (!userId) throw new Error('User ID required');

  const db = getDb();
  const docRef = db.collection('userCopens').doc(userId);
  
  try {
    if (enabled) {
      await docRef.set({
        disabledDefaults: firebase.firestore.FieldValue.arrayRemove(copenId)
      }, { merge: true });
    } else {
      await docRef.set({
        disabledDefaults: firebase.firestore.FieldValue.arrayUnion(copenId)
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error toggling default copen:', error);
    throw error;
  }
}

/**
 * Get icon for custom copens
 * @returns {string} Material icon name
 */
export function getCustomCopenIcon() {
  return CUSTOM_COPEN_ICON;
}

export { DEFAULT_COPENS };
