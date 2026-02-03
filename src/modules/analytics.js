// ===== Analytics Module =====
// Calculate and aggregate analytics data from tracked sessions

import { getAuth, getDb } from './firebase-service.js';
import { handleError } from '../utils/error-handler.js';
import { SESSION_TRACKING } from '../utils/constants.js';

/**
 * Calculate analytics for a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Analytics data
 */
export async function calculateAnalytics(startDate, endDate) {
  const user = getAuth()?.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const db = getDb();
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  try {
    // Query sessions in date range
    let query = db
      .collection('juleSessions')
      .doc(user.uid)
      .collection('sessions')
      .orderBy('createdAt', 'desc');

    if (startDate) {
      query = query.where('createdAt', '>=', startDate);
    }

    if (endDate) {
      query = query.where('createdAt', '<=', endDate);
    }

    const snapshot = await query.get();
    const sessions = [];
    const allDocs = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      allDocs.push({ id: doc.id, status: data.status, createdAt: data.createdAt });
      sessions.push({
        id: doc.id,
        ...data
      });
    });

    console.log(`[Analytics] Query returned ${snapshot.size} documents, processing ${sessions.length} sessions`);
    console.log('[Analytics] Date range:', { startDate, endDate });
    
    // Sample first few sessions to verify data
    if (sessions.length > 0) {
      console.log('[Analytics] Sample sessions (first 3):', allDocs.slice(0, 3));
    }

    return aggregateSessionData(sessions);
  } catch (error) {
    handleError(error, { source: 'calculateAnalytics' });
    throw error;
  }
}

/**
 * Aggregate raw session data into analytics metrics
 * @param {Array} sessions - Array of session documents
 * @returns {Object} Aggregated analytics
 */
function aggregateSessionData(sessions) {
  // First, collect all unique statuses to identify unexpected values
  const allStatuses = {};
  sessions.forEach(session => {
    const status = session.status || 'NULL_STATUS';
    allStatuses[status] = (allStatuses[status] || 0) + 1;
  });
  console.log('[Analytics] Raw status counts from all sessions:', allStatuses);

  const analytics = {
    // Core metrics
    totalSessions: sessions.length,
    completedSessions: 0,
    failedSessions: 0,
    inProgressSessions: 0,
    
    // PR metrics
    sessionsWithPRs: 0,
    prUrls: [],
    prCreationRate: 0,
    
    // Success metrics
    successRate: 0,
    
    // Plan metrics
    sessionsWithPlans: 0,
    totalPlanSteps: 0,
    avgPlanSteps: 0,
    
    // Failure analysis
    failures: [],
    failureReasons: {},
    failureSteps: {},
    
    // Prompt performance
    promptMetrics: {},
    uniquePromptsUsed: 0,
    mostUsedPrompt: null,
    bestPerformingPrompt: null,
    
    // Repository performance
    repoMetrics: {},
    uniqueReposUsed: 0,
    
    // Branch metrics
    branchMetrics: {},
    
    // Timing metrics
    completionTimes: [],
    
    // Raw data for charts
    sessionsOverTime: [],
    statusDistribution: {
      COMPLETED: 0,
      FAILED: 0,
      IN_PROGRESS: 0,
      PLANNING: 0,
      AWAITING_PLAN_APPROVAL: 0,
      AWAITING_USER_FEEDBACK: 0,
      PAUSED: 0,
      QUEUED: 0,
      STATE_UNSPECIFIED: 0
    }
  };

  sessions.forEach(session => {
    // Status counts
    const status = session.status || 'STATE_UNSPECIFIED';
    // Map legacy UNKNOWN to STATE_UNSPECIFIED
    const normalizedStatus = status === 'UNKNOWN' ? 'STATE_UNSPECIFIED' : status;
    
    if (analytics.statusDistribution[normalizedStatus] !== undefined) {
      analytics.statusDistribution[normalizedStatus]++;
    } else {
      // Unrecognized status - log it and count as STATE_UNSPECIFIED
      console.warn('[Analytics] Unrecognized session status:', {
        sessionId: session.sessionId || session.id,
        status: status,
        title: session.title
      });
      analytics.statusDistribution.STATE_UNSPECIFIED++;
    }

    if (status === 'COMPLETED') {
      analytics.completedSessions++;
    } else if (status === 'FAILED') {
      analytics.failedSessions++;
    } else if (SESSION_TRACKING.ACTIVE_STATES.includes(status)) {
      analytics.inProgressSessions++;
    }

    // PR metrics
    if (session.hasPR && session.prUrl) {
      analytics.sessionsWithPRs++;
      analytics.prUrls.push({
        url: session.prUrl,
        title: session.prTitle || 'Untitled PR',
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl || `https://jules.google.com/session/${session.sessionId}`,
        promptPath: session.promptPath,
        promptContent: session.promptContent || ''
      });
    }

    // Plan metrics
    if (session.hasPlan) {
      analytics.sessionsWithPlans++;
      analytics.totalPlanSteps += session.planStepCount || 0;
    }

    // Failure analysis
    if (status === 'FAILED') {
      analytics.failures.push({
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl || `https://jules.google.com/session/${session.sessionId}`,
        title: session.title || 'Untitled Session',
        reason: session.failureReason,
        step: session.failureStep,
        prompt: session.promptPath,
        promptContent: session.promptContent || ''
      });

      if (session.failureReason) {
        analytics.failureReasons[session.failureReason] = 
          (analytics.failureReasons[session.failureReason] || 0) + 1;
      }

      if (session.failureStep) {
        analytics.failureSteps[session.failureStep] = 
          (analytics.failureSteps[session.failureStep] || 0) + 1;
      }
    }

    // Prompt metrics
    if (session.promptPath) {
      if (!analytics.promptMetrics[session.promptPath]) {
        analytics.promptMetrics[session.promptPath] = {
          total: 0,
          completed: 0,
          failed: 0,
          withPRs: 0,
          successRate: 0,
          prRate: 0
        };
      }

      const promptMetric = analytics.promptMetrics[session.promptPath];
      promptMetric.total++;
      if (status === 'COMPLETED') promptMetric.completed++;
      if (status === 'FAILED') promptMetric.failed++;
      if (session.hasPR) promptMetric.withPRs++;
    }

    // Repository metrics
    if (session.sourceId) {
      if (!analytics.repoMetrics[session.sourceId]) {
        analytics.repoMetrics[session.sourceId] = {
          total: 0,
          completed: 0,
          failed: 0,
          withPRs: 0
        };
      }

      const repoMetric = analytics.repoMetrics[session.sourceId];
      repoMetric.total++;
      if (status === 'COMPLETED') repoMetric.completed++;
      if (status === 'FAILED') repoMetric.failed++;
      if (session.hasPR) repoMetric.withPRs++;
    }

    // Branch metrics
    if (session.branch) {
      if (!analytics.branchMetrics[session.branch]) {
        analytics.branchMetrics[session.branch] = 0;
      }
      analytics.branchMetrics[session.branch]++;
    }

    // Timing metrics
    if (session.createdAt && session.completedAt) {
      // Session completed within time period
    }

    // Timeline data
    if (session.createdAt) {
      const created = session.createdAt.toDate?.() || new Date(session.createdAt.seconds * 1000);
      analytics.sessionsOverTime.push({
        date: created,
        status: status,
        hasPR: session.hasPR
      });
    }
  });

  // Calculate derived metrics
  if (analytics.totalSessions > 0) {
    analytics.prCreationRate = analytics.sessionsWithPRs / analytics.totalSessions;
  }

  // Completion rate: completed / (completed + failed)
  const finishedSessions = analytics.completedSessions + analytics.failedSessions;
  if (finishedSessions > 0) {
    analytics.successRate = analytics.completedSessions / finishedSessions;
  }

  if (analytics.sessionsWithPlans > 0) {
    analytics.avgPlanSteps = analytics.totalPlanSteps / analytics.sessionsWithPlans;
  }

  // Session duration calculation removed due to data quality issues

  // Calculate prompt-level metrics
  Object.keys(analytics.promptMetrics).forEach(promptPath => {
    const metric = analytics.promptMetrics[promptPath];
    if (metric.total > 0) {
      metric.successRate = metric.completed / metric.total;
      metric.prRate = metric.withPRs / metric.total;
    }
  });

  // Calculate repo-level metrics
  Object.keys(analytics.repoMetrics).forEach(repoId => {
    const metric = analytics.repoMetrics[repoId];
    if (metric.total > 0) {
      metric.successRate = metric.completed / metric.total;
      metric.prRate = metric.withPRs / metric.total;
    }

  });

  // Find most used and best performing prompts
  const promptsArray = Object.entries(analytics.promptMetrics)
    .map(([path, metric]) => ({ path, ...metric }));

  if (promptsArray.length > 0) {
    analytics.uniquePromptsUsed = promptsArray.length;
    
    // Most used
    promptsArray.sort((a, b) => b.total - a.total);
    analytics.mostUsedPrompt = {
      path: promptsArray[0].path,
      uses: promptsArray[0].total,
      successRate: promptsArray[0].successRate
    };

    // Best performing (by success rate, minimum 3 uses)
    const qualifiedPrompts = promptsArray.filter(p => p.total >= 3);
    if (qualifiedPrompts.length > 0) {
      qualifiedPrompts.sort((a, b) => b.successRate - a.successRate);
      analytics.bestPerformingPrompt = {
        path: qualifiedPrompts[0].path,
        uses: qualifiedPrompts[0].total,
        successRate: qualifiedPrompts[0].successRate
      };
    }
  }

  analytics.uniqueReposUsed = Object.keys(analytics.repoMetrics).length;
  
  // Add recent failures for display
  analytics.recentFailures = analytics.failures.slice(0, 10);

  return analytics;
}

/**
 * Get quick stats (for dashboard widgets)
 * @returns {Promise<Object>} Quick stats
 */
export async function getQuickStats() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return await calculateAnalytics(thirtyDaysAgo, new Date());
}

/**
 * Get top performing prompts
 * @param {number} limit - Number of prompts to return
 * @returns {Promise<Array>} Top prompts
 */
export async function getTopPrompts(limit = 10) {
  const analytics = await calculateAnalytics(null, null);
  
  const prompts = Object.entries(analytics.promptMetrics)
    .map(([path, metric]) => ({ path, ...metric }))
    .sort((a, b) => {
      // Sort by success rate first, then by total uses
      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate;
      }
      return b.total - a.total;
    })
    .slice(0, limit);

  return prompts;
}

/**
 * Get failure insights
 * @returns {Promise<Object>} Failure analysis
 */
export async function getFailureInsights() {
  const analytics = await calculateAnalytics(null, null);
  
  return {
    totalFailures: analytics.failedSessions,
    failureRate: analytics.totalSessions > 0 ? analytics.failedSessions / analytics.totalSessions : 0,
    failureReasons: analytics.failureReasons,
    failureSteps: analytics.failureSteps,
    recentFailures: analytics.failures.slice(0, 10)
  };
}
