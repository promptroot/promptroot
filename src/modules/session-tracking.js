// ===== Session Tracking Module =====
// Tracks Jules sessions in Firestore for analytics and history

import { getAuth, getDb } from './firebase-service.js';
import { getServerTimestamp } from '../utils/firestore-helpers.js';
import { handleError } from '../utils/error-handler.js';
import { getJulesSession, getJulesSessionActivities, getDecryptedJulesKey, listJulesSessions } from './jules-api.js';

/**
 * Track a new session in Firestore
 * @param {Object} sessionData - Session data to track
 * @param {string} sessionData.sessionId - Jules session ID
 * @param {string} sessionData.sessionName - Full session name (e.g., "sessions/123")
 * @param {string} sessionData.promptPath - Path to prompt file
 * @param {string} sessionData.promptContent - Full prompt text
 * @param {string} sessionData.sourceId - GitHub source ID
 * @param {string} sessionData.branch - Git branch
 * @param {string} sessionData.title - Session title
 * @param {string} sessionData.status - Session state
 * @param {string} [sessionData.queueItemId] - Optional queue item ID
 */
export async function trackSessionCreation(sessionData) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    // Calculate prompt hash for change detection
    const promptHash = await calculateHash(sessionData.promptContent || '');

    const sessionDoc = {
      // Identity
      sessionId: sessionData.sessionId,
      sessionName: sessionData.sessionName,
      
      // Source
      promptPath: sessionData.promptPath || null,
      promptHash: promptHash,
      promptContent: sessionData.promptContent || '',
      sourceId: sessionData.sourceId,
      branch: sessionData.branch,
      title: sessionData.title || '',
      
      // Status
      status: sessionData.status || 'STATE_UNSPECIFIED',
      
      // Outcomes (initial state)
      hasPR: false,
      prUrl: null,
      prTitle: null,
      prDescription: null,
      
      // Plan tracking
      hasPlan: false,
      planStepCount: 0,
      
      // Failure tracking
      failureStep: null,
      failureReason: null,
      
      // Timestamps
      createdAt: getServerTimestamp(),
      completedAt: null,
      lastSyncedAt: getServerTimestamp(),
      
      // Linkage
      queueItemId: sessionData.queueItemId || null,
      
      // Metadata
      userId: user.uid
    };

    await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionData.sessionId)
      .set(sessionDoc);

    return sessionData.sessionId;
  } catch (error) {
    handleError(error, { source: 'trackSessionCreation' });
    throw error;
  }
}

/**
 * Update session status and metadata
 * @param {string} sessionId - Jules session ID
 * @param {Object} updates - Fields to update
 */
export async function updateSessionStatus(sessionId, updates) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    const updateData = {
      ...updates,
      lastSyncedAt: getServerTimestamp()
    };

    await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionId)
      .update(updateData);
  } catch (error) {
    handleError(error, { source: 'updateSessionStatus' });
    throw error;
  }
}

/**
 * Sync session status from Jules API
 * @param {string} sessionId - Jules session ID
 * @param {string} [apiKey] - Optional API key (will fetch if not provided)
 */
export async function syncSessionFromAPI(sessionId, apiKey = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Get API key if not provided
    if (!apiKey) {
      apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        throw new Error('Jules API key not found');
      }
    }

    // Fetch latest session data from Jules API
    const session = await getJulesSession(apiKey, sessionId);
    
    // Find PR data in outputs array (could be at any index)
    const prOutput = session.outputs?.find(output => output.pullRequest);
    const pullRequest = prOutput?.pullRequest;

    // Parse API update time
    const apiUpdateTime = session.updateTime ? new Date(session.updateTime) : null;

    const updates = {
      status: session.state || 'UNKNOWN',
      hasPR: !!pullRequest?.url,
      prUrl: pullRequest?.url || null,
      prTitle: pullRequest?.title || null,
      prDescription: pullRequest?.description || null,
      apiUpdateTime
    };

    // Set completion time from API updateTime if completed or failed
    if ((session.state === 'COMPLETED' || session.state === 'FAILED') && session.updateTime) {
      updates.completedAt = new Date(session.updateTime);
    }

    await updateSessionStatus(sessionId, updates);

    // If completed/failed and we haven't analyzed activities yet, do it now
    const db = getDb();
    const sessionDoc = await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionId)
      .get();

    const data = sessionDoc.data();
    if ((session.state === 'COMPLETED' || session.state === 'FAILED') && !data?.hasPlan) {
      await analyzeSessionActivities(sessionId, apiKey);
    }

    return session;
  } catch (error) {
    handleError(error, { source: 'syncSessionFromAPI' });
    throw error;
  }
}

/**
 * Analyze session activities and extract metrics
 * @param {string} sessionId - Jules session ID
 * @param {string} [apiKey] - Optional API key
 */
export async function analyzeSessionActivities(sessionId, apiKey = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    // Get API key if not provided
    if (!apiKey) {
      apiKey = await getDecryptedJulesKey(user.uid);
      if (!apiKey) {
        throw new Error('Jules API key not found');
      }
    }

    // Fetch activities
    const activitiesData = await getJulesSessionActivities(apiKey, sessionId);
    const activities = activitiesData.activities || [];

    let hasPlan = false;
    let planStepCount = 0;
    let failureStep = null;
    let failureReason = null;

    // Analyze each activity
    for (const activity of activities) {
      // Check for plan generation
      if (activity.planGenerated) {
        hasPlan = true;
        planStepCount = activity.planGenerated.plan?.steps?.length || 0;
      }

      // Check for failures
      if (activity.artifacts) {
        for (const artifact of activity.artifacts) {
          if (artifact.bashOutput && artifact.bashOutput.exitCode !== 0) {
            failureStep = activity.progressUpdated?.title || 'Unknown step';
            failureReason = 'bash_error';
          }
        }
      }

      // Check for session completion failure
      if (activity.sessionCompleted && !activity.artifacts?.[0]?.changeSet) {
        failureReason = failureReason || 'no_changes_generated';
      }
    }

    const updates = {
      hasPlan,
      planStepCount,
      failureStep,
      failureReason,
      activitiesAnalyzed: true
    };

    await updateSessionStatus(sessionId, updates);
  } catch (error) {
    handleError(error, { source: 'analyzeSessionActivities' });
    throw error;
  }
}

/**
 * Get all sessions for the current user
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date filter
 * @param {Date} [options.endDate] - End date filter
 * @param {string} [options.status] - Status filter
 * @returns {Promise<Array>} Array of session documents
 */
export async function getUserSessions(options = {}) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    let query = db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .orderBy('createdAt', 'desc');

    if (options.status) {
      query = query.where('status', '==', options.status);
    }

    if (options.startDate) {
      query = query.where('createdAt', '>=', options.startDate);
    }

    if (options.endDate) {
      query = query.where('createdAt', '<=', options.endDate);
    }

    const snapshot = await query.get();
    const sessions = [];

    snapshot.forEach(doc => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return sessions;
  } catch (error) {
    handleError(error, { source: 'getUserSessions' });
    throw error;
  }
}

/**
 * Sync all active (non-terminal) sessions
 * @param {Function} progressCallback - Optional callback (synced, total)
 */
export async function syncActiveSessions(progressCallback = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    return;
  }

  try {
    const db = getDb();
    const apiKey = await getDecryptedJulesKey(user.uid);
    if (!apiKey) {
      console.warn('[Session Tracking] No API key found for sync');
      throw new Error('Jules API key not configured');
    }

    // Fetch ALL sessions from Jules API (bulk operation)
    const apiSessions = new Map();
    const stateCounts = {};
    let pageToken = null;
    
    do {
      const response = await listJulesSessions(apiKey, 100, pageToken);
      const sessions = response.sessions || [];
      
      sessions.forEach(session => {
        apiSessions.set(session.id, session);
        // Track state distribution
        const state = session.state || 'NO_STATE';
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      });
      
      pageToken = response.nextPageToken;
    } while (pageToken);

    // Get all local sessions
    const allSessionsSnapshot = await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .get();
    
    const localSessions = new Map();
    allSessionsSnapshot.docs.forEach(doc => {
      localSessions.set(doc.id, { docRef: doc.ref, ...doc.data() });
    });

    // Find sessions that need updating
    const toUpdate = [];
    
    apiSessions.forEach((apiSession, sessionId) => {
      const localSession = localSessions.get(sessionId);
      
      if (!localSession) {
        // New session not in local DB
        toUpdate.push(apiSession);
      } else if (shouldUpdateSession(localSession, apiSession)) {
        // Update if timestamp is newer or local data is invalid
        toUpdate.push(apiSession);
      }
    });

    // Track sync statistics
    const syncStats = {
      completed: 0,
      failed: 0,
      inProgress: 0,
      queued: 0,
      awaiting: 0,
      paused: 0,
      unspecified: 0,
      withPR: 0,
      total: toUpdate.length
    };

    // Update changed sessions
    for (let i = 0; i < toUpdate.length; i++) {
      const session = toUpdate[i];
      
      try {
        const sessionId = session.id;
        const sessionRef = db
          .collection('juleSessions')
          .doc(user.uid)
          .collection('sessions')
          .doc(sessionId);

        // Find PR data in outputs
        const prOutput = session.outputs?.find(output => output.pullRequest);
        const pullRequest = prOutput?.pullRequest;

        // Extract source and branch
        const sourceId = session.sourceContext?.source || null;
        const branch = session.sourceContext?.githubRepoContext?.startingBranch || null;
        const apiUpdateTime = session.updateTime ? new Date(session.updateTime) : null;

        const completedAt = (session.state === 'COMPLETED' || session.state === 'FAILED') && session.updateTime 
          ? new Date(session.updateTime) 
          : null;

        // Debug logging for sessions that should have proper timestamps
        if (completedAt && session.state === 'COMPLETED') {
          const created = session.createTime ? new Date(session.createTime) : null;
          if (created) {
            const durationMinutes = (completedAt.getTime() - created.getTime()) / (1000 * 60);
            if (durationMinutes > 1440) {
              console.warn(`[Session Tracking] Setting completedAt from updateTime for session ${sessionId}:`, {
                createTime: session.createTime,
                updateTime: session.updateTime,
                calculatedDuration: Math.round(durationMinutes),
                state: session.state
              });
            }
          }
        }

        // Log sessions with STATE_UNSPECIFIED status for debugging
        if (!session.state) {
          console.warn(`[Session Tracking] Session ${sessionId} has no state field:`, {
            name: session.name,
            title: session.title,
            createTime: session.createTime,
            updateTime: session.updateTime
          });
        }

        const sessionData = {
          sessionId,
          sessionName: session.name,
          title: session.title || 'Untitled Session',
          promptContent: session.prompt || '',
          sourceId,
          branch,
          status: session.state || 'STATE_UNSPECIFIED',
          sessionUrl: session.url || `https://jules.google.com/session/${sessionId}`,
          createdAt: session.createTime ? new Date(session.createTime) : getServerTimestamp(),
          completedAt,
          hasPR: !!pullRequest?.url,
          prUrl: pullRequest?.url || null,
          prTitle: pullRequest?.title || null,
          prDescription: pullRequest?.description || null,
          apiUpdateTime
        };

        await sessionRef.set(sessionData, { merge: true });

        // Update sync statistics
        const status = sessionData.status;
        if (status === 'COMPLETED') syncStats.completed++;
        else if (status === 'FAILED') syncStats.failed++;
        else if (status === 'IN_PROGRESS' || status === 'PLANNING') syncStats.inProgress++;
        else if (status === 'QUEUED') syncStats.queued++;
        else if (status === 'AWAITING_USER_FEEDBACK' || status === 'AWAITING_PLAN_APPROVAL') syncStats.awaiting++;
        else if (status === 'PAUSED') syncStats.paused++;
        else syncStats.unspecified++;
        
        if (sessionData.hasPR) syncStats.withPR++;

        if (progressCallback) {
          progressCallback(i + 1, toUpdate.length);
        }
      } catch (err) {
        console.error(`[Session Tracking] Failed to sync session ${session.id}:`, err);
      }
    }
  } catch (error) {
    handleError(error, { source: 'syncActiveSessions' });
    throw error; // Re-throw to ensure finally block runs
  }
}

/**
 * Check if a session needs to be updated based on updateTime
 * @param {Object} localSession - Session data from Firestore
 * @param {Object} apiSession - Session data from API
 * @returns {boolean} True if update is needed
 */
function shouldUpdateSession(localSession, apiSession) {
  // If local session doesn't exist or is missing timestamp, update
  if (!localSession || !localSession.apiUpdateTime) {
    return true;
  }

  // If API session is missing timestamp (unlikely), default to update to be safe
  if (!apiSession.updateTime) {
    return true;
  }

  try {
    // Parse local timestamp
    // Handle Firestore Timestamp (has .toDate()) or Date object or string/number
    let localDate;
    if (localSession.apiUpdateTime && typeof localSession.apiUpdateTime.toDate === 'function') {
      localDate = localSession.apiUpdateTime.toDate();
    } else {
      localDate = new Date(localSession.apiUpdateTime);
    }

    // Parse API timestamp
    const apiDate = new Date(apiSession.updateTime);

    // If local date is invalid, update
    if (isNaN(localDate.getTime())) {
      return true;
    }

    // Update if API date is newer than local date
    return apiDate > localDate;
  } catch (err) {
    console.warn('[Session Tracking] Error comparing timestamps, forcing update:', err);
    return true;
  }
}

/**
 * Calculate SHA-256 hash of a string
 * @param {string} text - Text to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function calculateHash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Delete a session from tracking
 * @param {string} sessionId - Jules session ID
 */
export async function deleteTrackedSession(sessionId) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .doc(sessionId)
      .delete();
  } catch (error) {
    handleError(error, { source: 'deleteTrackedSession' });
    throw error;
  }
}

/**
 * Import all historical Jules sessions from API into Firestore
 * @param {Function} progressCallback - Optional callback (processed, total)
 * @returns {Promise<{imported: number, skipped: number, errors: number}>} Import stats
 */
export async function importJulesHistory(progressCallback = null) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const apiKey = await getDecryptedJulesKey(user.uid);
  if (!apiKey) {
    throw new Error('Jules API key not found. Please add your API key in settings.');
  }

  const stats = { imported: 0, skipped: 0, errors: 0 };
  let pageToken = null;
  const allApiSessions = [];

  try {
    // First, fetch all sessions from API
    do {
      const response = await listJulesSessions(apiKey, 100, pageToken);
      const sessions = response.sessions || [];
      allApiSessions.push(...sessions);
      pageToken = response.nextPageToken;
    } while (pageToken);

    const totalSessions = allApiSessions.length;

    // Fetch all local sessions in a single batch query for efficient comparison
    const allSessionsSnapshot = await db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .get();

    const localSessionsMap = new Map();
    allSessionsSnapshot.docs.forEach(doc => {
      localSessionsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    // Process all sessions in parallel for improved performance
    const importPromises = allApiSessions.map(async (session, i) => {
      try {
        const sessionId = session.id;
        const localSession = localSessionsMap.get(sessionId);
        
        // Check if session already exists and if an update is needed
        if (localSession) {
          const existingUpdateTime = localSession.apiUpdateTime?.toDate?.() || new Date(localSession.apiUpdateTime || 0);
          const apiUpdateTime = session.updateTime ? new Date(session.updateTime) : new Date();
          
          if (apiUpdateTime <= existingUpdateTime) {
            stats.skipped++;
            if (progressCallback) {
              progressCallback(i + 1, totalSessions);
            }
            return;
          }
        }

        // Find PR data in outputs
        const prOutput = session.outputs?.find(output => output.pullRequest);
        const pullRequest = prOutput?.pullRequest;

        // Extract source and branch
        const sourceId = session.sourceContext?.source || null;
        const branch = session.sourceContext?.githubRepoContext?.startingBranch || null;
        
        const apiUpdateTime = session.updateTime ? new Date(session.updateTime) : null;

        // Create session document
        const sessionData = {
          sessionId,
          sessionName: session.name,
          title: session.title || 'Untitled Session',
          promptContent: session.prompt || '',
          promptPath: null, // Historical sessions don't have this
          sourceId,
          branch,
          status: session.state || 'UNKNOWN',
          sessionUrl: session.url || `https://jules.google.com/session/${sessionId}`,
          createdAt: session.createTime ? new Date(session.createTime) : getServerTimestamp(),
          completedAt: (session.state === 'COMPLETED' || session.state === 'FAILED') && session.updateTime 
            ? new Date(session.updateTime) 
            : null,
          hasPR: !!pullRequest?.url,
          prUrl: pullRequest?.url || null,
          prTitle: pullRequest?.title || null,
          prDescription: pullRequest?.description || null,
          apiUpdateTime,
          imported: true,
          importedAt: getServerTimestamp()
        };

        const sessionRef = db
          .collection('juleSessions')
          .doc(user.uid)
          .collection('sessions')
          .doc(sessionId);

        await sessionRef.set(sessionData);
        stats.imported++;
        
        if (progressCallback) {
          progressCallback(i + 1, totalSessions);
        }
      } catch (err) {
        console.error(`[Session Tracking] Failed to import session ${session.id}:`, err);
        stats.errors++;
        
        if (progressCallback) {
          progressCallback(i + 1, totalSessions);
        }
      }
    });

    // Wait for all imports to complete (with error handling for individual items already managed)
    await Promise.allSettled(importPromises);

    return stats;
  } catch (error) {
    console.error('[Session Tracking] History import failed:', error);
    handleError(error, { source: 'importJulesHistory' });
    throw error;
  }
}
