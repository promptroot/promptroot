/**
 * Copen Manager
 * Manages user's custom copens in Firestore
 */

import { getDb } from './firebase-service.js';

const DEFAULT_COPENS = [
  { id: 'allhands', label: 'All Hands', icon: 'front_hand', url: 'https://app.all-hands.dev', isDefault: true },
  { id: 'claude', label: 'Claude', icon: 'smart_toy', url: 'https://claude.ai/code', isDefault: true },
  { id: 'codex', label: 'Codex', icon: 'forum', url: 'https://chatgpt.com/codex/cloud', isDefault: true },
  { id: 'copilot', label: 'Copilot', icon: 'code', url: 'https://github.com/copilot/agents', isDefault: true },
  { id: 'qwen', label: 'Qwen', icon: 'terminal', url: 'https://coder.qwen.ai', isDefault: true },
  { id: 'blank', label: 'Blank', icon: 'public', url: 'about:blank', isDefault: true },
  { id: 'gemini', label: 'Gemini', icon: 'auto_awesome', url: 'https://gemini.google.com/app', isDefault: true },
  { id: 'chatgpt', label: 'ChatGPT', icon: 'chat', url: 'https://chatgpt.com', isDefault: true }
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
    const savedOrder = data.order || [];

    // Mark disabled defaults
    const allDefaults = DEFAULT_COPENS.map(c => ({
      ...c,
      disabled: disabledDefaults.includes(c.id)
    }));

    // Combine defaults with custom copens
    let allCopens = [...allDefaults, ...customCopens];

    // Apply saved order if it exists
    if (savedOrder.length > 0) {
      const orderedCopens = [];
      const copenMap = new Map(allCopens.map(c => [c.id, c]));
      
      // Add copens in saved order
      savedOrder.forEach(id => {
        if (copenMap.has(id)) {
          orderedCopens.push(copenMap.get(id));
          copenMap.delete(id);
        }
      });
      
      // Add any new copens that weren't in the saved order
      copenMap.forEach(copen => orderedCopens.push(copen));
      
      allCopens = orderedCopens;
    }

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
    id: `custom_${Date.now()}_${crypto.randomUUID()}`,
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
 * Save reordered copens
 * @param {string} userId - User ID
 * @param {Array} copens - All copens in desired order
 * @returns {Promise<void>}
 */
export async function saveCopenOrder(userId, copens) {
  if (!userId) throw new Error('User ID required');

  const db = getDb();
  const docRef = db.collection('userCopens').doc(userId);
  
  try {
    // Separate custom copens from defaults
    const customCopens = copens.filter(c => !c.isDefault);
    const disabledDefaults = copens.filter(c => c.isDefault && c.disabled).map(c => c.id);

    await docRef.set({
      customCopens,
      disabledDefaults,
      order: copens.map(c => c.id) // Save the full order
    }, { merge: true });
  } catch (error) {
    console.error('Error saving copen order:', error);
    throw error;
  }
}

/**
 * Reset to default copens (remove all custom copens and enable all defaults)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function resetToDefaultCopens(userId) {
  if (!userId) throw new Error('User ID required');

  const db = getDb();
  const docRef = db.collection('userCopens').doc(userId);
  
  try {
    await docRef.set({
      customCopens: [],
      disabledDefaults: [],
      order: DEFAULT_COPENS.map(c => c.id)
    }, { merge: true });
  } catch (error) {
    console.error('Error resetting to default copens:', error);
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
