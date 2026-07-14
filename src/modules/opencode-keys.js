import { getDb } from './firebase-service.js';
import { getDoc, deleteDoc, setDoc, getServerTimestamp } from '../utils/firestore-helpers.js';
import { OPENCODE } from '../utils/constants.js';

// ===== OpenCode Key Management Module =====
// Handles encryption, storage, and retrieval of the OpenCode server endpoint and token/password.
// Mirroring the security scheme in openclaw-keys.js.

const CACHE_KEY = 'opencode_key_data';

export async function checkOpencodeKey(uid) {
  try {
    const db = getDb();
    if (!db) return false;
    const doc = await getDoc(OPENCODE.KEY_COLLECTION, uid, CACHE_KEY);
    return !!(doc && (doc.key || doc.gatewayUrl));
  } catch {
    return false;
  }
}

export async function getOpencodeConfig(uid) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await getDoc(OPENCODE.KEY_COLLECTION, uid, CACHE_KEY);
    if (!doc) return null;
    return {
      gatewayUrl: doc.gatewayUrl || OPENCODE.DEFAULT_ENDPOINT,
      hasToken: !!doc.key,
    };
  } catch {
    return null;
  }
}

export async function setOpencodeRelay(uid, tokenHash, tokenLabel) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  await setDoc(OPENCODE.KEY_COLLECTION, uid, {
    gatewayUrl: OPENCODE.DEFAULT_ENDPOINT,
    tokenHash,
    tokenLabel,
    storedAt: getServerTimestamp()
  }, { merge: false }, CACHE_KEY);
  return true;
}

export async function encryptAndStoreOpencodeKey(token, uid, { gatewayUrl = null } = {}) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');

  const data = {
    gatewayUrl: gatewayUrl || OPENCODE.DEFAULT_ENDPOINT,
    storedAt: getServerTimestamp()
  };

  if (token) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(uid), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(token)
    );

    data.key = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    data.iv = btoa(String.fromCharCode(...iv));
    data.salt = btoa(String.fromCharCode(...salt));
  } else {
    data.key = null;
    data.iv = null;
    data.salt = null;
  }

  await setDoc(OPENCODE.KEY_COLLECTION, uid, data, { merge: true }, CACHE_KEY);
  return true;
}

export async function deleteStoredOpencodeKey(uid) {
  try {
    const db = getDb();
    if (!db) return false;
    await deleteDoc(OPENCODE.KEY_COLLECTION, uid, CACHE_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function decryptOpencodeKey(uid) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await getDoc(OPENCODE.KEY_COLLECTION, uid, CACHE_KEY);
    if (!doc || !doc.key || !doc.iv || !doc.salt) return null;

    const ciphertext = Uint8Array.from(atob(doc.key), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(doc.iv), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(doc.salt), c => c.charCodeAt(0));

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(uid), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const key = await window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
