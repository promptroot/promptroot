import { getDb } from './firebase-service.js';
import { getDoc, setDoc, getServerTimestamp } from '../utils/firestore-helpers.js';

// ===== OpenHands Key and Configuration Management Module =====
// Handles encryption, storage, and retrieval of OpenHands configurations.
// Stored under users/{userId}.openhandsConfig to avoid permission errors on production.

const CACHE_KEY = 'openhands_key_data';

// Configuration cache for memoization
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearOpenHandsKeyCache(uid = null) {
  if (uid) {
    configCache.delete(uid);
  } else {
    configCache.clear();
  }
}

export async function checkOpenHandsConfig(uid) {
  try {
    const db = getDb();
    if (!db) {
      return false;
    }
    const doc = await getDoc('users', uid, CACHE_KEY);
    return !!(doc && doc.openhandsConfig && doc.openhandsConfig.baseUrl);
  } catch (error) {
    return false;
  }
}

export async function deleteStoredOpenHandsConfig(uid) {
  try {
    const db = getDb();
    if (!db) return false;
    
    clearOpenHandsKeyCache(uid);
    // Remove settings by setting field to null inside the users doc
    await setDoc('users', uid, {
      openhandsConfig: null
    }, { merge: true }, CACHE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

export async function encryptAndStoreOpenHandsConfig(baseUrl, apiKey, uid) {
  try {
    clearOpenHandsKeyCache(uid);
    
    let encrypted = null;
    let ivStr = null;
    let saltStr = null;

    if (apiKey) {
      // Generate random salt and IV
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Import password (uid) as key material
      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(uid),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      // Derive key using PBKDF2
      const key = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );

      // Encrypt
      const plaintextData = enc.encode(apiKey);
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        plaintextData
      );

      // Convert binary to base64 strings for storage
      encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
      ivStr = btoa(String.fromCharCode(...iv));
      saltStr = btoa(String.fromCharCode(...salt));
    }

    const db = getDb();
    if (!db) throw new Error('Firestore not initialized');

    const cleanBaseUrl = (baseUrl || 'http://localhost:3000').trim().replace(/\/$/, '');

    await setDoc('users', uid, {
      openhandsConfig: {
        baseUrl: cleanBaseUrl,
        key: encrypted,
        iv: ivStr,
        salt: saltStr,
        storedAt: getServerTimestamp()
      }
    }, { merge: true }, CACHE_KEY);

    return true;
  } catch (error) {
    throw error;
  }
}

export async function getDecryptedOpenHandsConfig(uid) {
  const cached = configCache.get(uid);
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.config;
    }
    configCache.delete(uid);
  }

  try {
    const db = getDb();
    if (!db) {
      return null;
    }

    const docData = await getDoc('users', uid, CACHE_KEY);
    if (!docData || !docData.openhandsConfig) {
      return null;
    }

    const { baseUrl, key: encrypted, iv: ivBase64, salt: saltBase64 } = docData.openhandsConfig;
    if (!baseUrl) return null;

    let decryptedKey = null;

    if (encrypted && ivBase64 && saltBase64) {
      const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
      const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
      const ciphertextData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(uid),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const plaintext = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertextData
      );

      decryptedKey = new TextDecoder().decode(plaintext);
    }

    const config = {
      baseUrl,
      apiKey: decryptedKey
    };

    configCache.set(uid, { config, timestamp: Date.now() });
    return config;
  } catch (error) {
    console.error('Error decrypting OpenHands config:', error);
    return null;
  }
}
