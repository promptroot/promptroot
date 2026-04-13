import { getDb } from './firebase-service.js';
import { getDoc, deleteDoc, setDoc, getServerTimestamp } from '../utils/firestore-helpers.js';
import { OPENCLAW } from '../utils/constants.js';

// ===== OpenClaw Key Management Module =====
// Handles encryption, storage, and retrieval of the OpenClaw gateway token.
// Also stores gatewayUrl (plaintext) and useRelay (boolean).

const CACHE_KEY = 'openclaw_key_data';

export async function checkOpenclawKey(uid) {
  try {
    const db = getDb();
    if (!db) return false;
    const doc = await getDoc(OPENCLAW.KEY_COLLECTION, uid, CACHE_KEY);
    return !!(doc && doc.key);
  } catch {
    return false;
  }
}

export async function getOpenclawConfig(uid) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await getDoc(OPENCLAW.KEY_COLLECTION, uid, CACHE_KEY);
    if (!doc) return null;
    return {
      useRelay: !!doc.useRelay,
      gatewayUrl: doc.gatewayUrl || null,
      hasToken: !!doc.key
    };
  } catch {
    return null;
  }
}

export async function encryptAndStoreOpenclawKey(token, uid, { gatewayUrl = null, useRelay = true } = {}) {
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

  const encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  const ivStr = btoa(String.fromCharCode(...iv));
  const saltStr = btoa(String.fromCharCode(...salt));

  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');

  const data = {
    key: encrypted,
    iv: ivStr,
    salt: saltStr,
    useRelay,
    storedAt: getServerTimestamp()
  };
  if (!useRelay && gatewayUrl) {
    data.gatewayUrl = gatewayUrl;
  }

  await setDoc(OPENCLAW.KEY_COLLECTION, uid, data, { merge: false }, CACHE_KEY);
  return true;
}

export async function deleteStoredOpenclawKey(uid) {
  try {
    const db = getDb();
    if (!db) return false;
    await deleteDoc(OPENCLAW.KEY_COLLECTION, uid, CACHE_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function decryptOpenclawKey(uid) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await getDoc(OPENCLAW.KEY_COLLECTION, uid, CACHE_KEY);
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
