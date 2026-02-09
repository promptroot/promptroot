import { getDb } from './firebase-service.js';
import { getDoc, deleteDoc, setDoc, getServerTimestamp } from '../utils/firestore-helpers.js';

// ===== Jules Key Management Module =====
// Handles encryption, storage, and retrieval of Jules API keys

const CACHE_KEY = 'jules_key_data';

// API key cache for memoization
const keyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearJulesKeyCache(uid = null) {
  if (uid) {
    keyCache.delete(uid);
  } else {
    keyCache.clear();
  }
}

export async function checkJulesKey(uid) {
  try {
    const db = getDb();
    if (!db) {
      return false;
    }
    const doc = await getDoc('julesKeys', uid, CACHE_KEY);
    return !!doc;
  } catch (error) {
    return false;
  }
}

export async function deleteStoredJulesKey(uid) {
  try {
    const db = getDb();
    if (!db) return false;
    await deleteDoc('julesKeys', uid, CACHE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

export async function encryptAndStoreKey(plaintext, uid) {
  try {
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
    const plaintextData = enc.encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      plaintextData
    );

    // Convert binary to base64 strings for storage
    const encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    const ivStr = btoa(String.fromCharCode(...iv));
    const saltStr = btoa(String.fromCharCode(...salt));

    const db = getDb();
    if (!db) throw new Error('Firestore not initialized');

    await setDoc('julesKeys', uid, {
      key: encrypted,
      iv: ivStr,
      salt: saltStr,
      storedAt: getServerTimestamp()
    }, { merge: false }, CACHE_KEY);

    return true;
  } catch (error) {
    throw error;
  }
}

export async function getDecryptedJulesKey(uid) {
  const cached = keyCache.get(uid);
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.key;
    }
    // Remove expired cache entry to avoid unbounded memory growth
    keyCache.delete(uid);
  }

  try {
    const db = getDb();
    if (!db) {
      return null;
    }

    const docData = await getDoc('julesKeys', uid, CACHE_KEY);
    if (!docData) {
      return null;
    }

    const { key: encrypted, iv: ivBase64, salt: saltBase64 } = docData;
    if (!encrypted) return null;

    let decryptedKey;

    if (ivBase64 && saltBase64) {
      // New Secure Scheme
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

    } else {
      // Legacy Scheme
      const paddedUid = (uid + '\0'.repeat(32)).slice(0, 32);
      const keyData = new TextEncoder().encode(paddedUid);
      const key = await window.crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);

      const ivString = uid.slice(0, 12).padEnd(12, '0');
      const iv = new TextEncoder().encode(ivString).slice(0, 12);

      const ciphertextData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
      const plaintext = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextData);

      decryptedKey = new TextDecoder().decode(plaintext);

      // Migration: Re-encrypt with new scheme
      await encryptAndStoreKey(decryptedKey, uid);
    }

    keyCache.set(uid, { key: decryptedKey, timestamp: Date.now() });
    return decryptedKey;
  } catch (error) {
    console.error('Error decrypting Jules key:', error);
    return null;
  }
}
