/**
 * Agentic Queue Module
 * Thin wrapper over jules-queue-service that adds destination field.
 */

import {
  addToJulesQueue as serviceAdd,
  updateJulesQueueItem as serviceUpdate,
  deleteFromJulesQueue as serviceDelete,
  listJulesQueue as serviceList,
  subscribeToQueueUpdates as serviceSubscribe,
} from './jules-queue-service.js';

export async function addToAgenticQueue(uid, item) {
  return serviceAdd(uid, { ...item, destination: item.destination || 'jules' });
}

export async function updateAgenticQueueItem(uid, docId, updates) {
  return serviceUpdate(uid, docId, updates);
}

export async function deleteFromAgenticQueue(uid, docId) {
  return serviceDelete(uid, docId);
}

export async function listAgenticQueue(uid) {
  return serviceList(uid);
}

export function subscribeToAgenticQueueUpdates(uid, callback) {
  return serviceSubscribe(uid, callback);
}
