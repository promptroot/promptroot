import { getDb } from './firebase-service.js';
import { addDoc, updateDoc, deleteDoc, queryCollection, setDoc, getDoc, getServerTimestamp, getFieldDelete } from '../utils/firestore-helpers.js';
import { CACHE_KEYS, PAGE_SIZES } from '../utils/constants.js';

export async function addToJulesQueue(uid, queueItem) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    const docId = await addDoc(collectionRef, {
      ...queueItem,
      autoOpen: queueItem.autoOpen !== false,
      createdAt: getServerTimestamp(),
      status: 'pending'
    }, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });

    return docId;
  } catch (err) {
    throw err;
  }
}

export async function updateJulesQueueItem(uid, docId, updates) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    await updateDoc(collectionRef, docId, updates, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return true;
  } catch (err) {
    throw err;
  }
}

export async function deleteFromJulesQueue(uid, docId) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    await deleteDoc(collectionRef, docId, { key: CACHE_KEYS.QUEUE_ITEMS, userId: uid });
    return true;
  } catch (err) {
    throw err;
  }
}

export async function listJulesQueue(uid, limitCount = PAGE_SIZES.queueItems) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  
  try {
    const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
    const results = await queryCollection(collectionRef, {
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: limitCount
    });
    return results;
  } catch (err) {
    throw err;
  }
}

export async function getUserTimeZone(uid) {
  try {
    const profileData = await getDoc('userProfiles', uid, { key: CACHE_KEYS.USER_PROFILE, userId: uid });
    if (profileData && profileData.preferredTimeZone) {
      return profileData.preferredTimeZone;
    }
  } catch (err) {
    // Silent failure - use default
  }
  
  return 'America/New_York';
}

export async function saveUserTimeZone(uid, timeZone) {
  try {
    await setDoc('userProfiles', uid, {
      preferredTimeZone: timeZone,
      updatedAt: getServerTimestamp()
    }, { merge: true }, { key: CACHE_KEYS.USER_PROFILE, userId: uid });
  } catch (err) {
    // Silent failure - non-critical
  }
}

export async function batchUnscheduleItems(uid, docIds) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  
  const batch = db.batch();
  
  for (const docId of docIds) {
    const docRef = db.collection('julesQueues').doc(uid).collection('items').doc(docId);
    batch.update(docRef, {
      status: 'pending',
      scheduledAt: getFieldDelete(),
      scheduledTimeZone: getFieldDelete(),
      activatedAt: getFieldDelete(),
      updatedAt: getServerTimestamp()
    });
  }
  
  await batch.commit();
}

export async function deleteSelectedSubtasks(uid, docId, indices, remaining) {
  const sortedIndices = indices.sort((a, b) => b - a);
  const newRemaining = remaining.slice();
  
  for (const index of sortedIndices) {
    if (index >= 0 && index < newRemaining.length) {
      newRemaining.splice(index, 1);
    }
  }

  if (newRemaining.length === 0) {
    await deleteFromJulesQueue(uid, docId);
  } else {
    await updateJulesQueueItem(uid, docId, {
      remaining: newRemaining,
      updatedAt: getServerTimestamp()
    });
  }
}

export function subscribeToQueueUpdates(uid, callback, limitCount = PAGE_SIZES.queueItems) {
  const db = getDb();
  if (!db) throw new Error('Firestore not initialized');
  
  const collectionRef = db.collection('julesQueues').doc(uid).collection('items');
  return collectionRef
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .onSnapshot((snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(items);
    }, (error) => {
      console.error('Queue subscription error:', error);
    });
}
