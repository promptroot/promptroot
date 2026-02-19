/**
 * TypeScript interfaces for Firestore data models
 * 
 * These interfaces match the data structures used in the main Promptroot app
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Queue item status types
 */
export type QueueStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'scheduled';

/**
 * Queue item type
 */
export type QueueType = 'single' | 'subtasks';

/**
 * Session status from Jules API
 */
export type SessionStatus = 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'PLANNING' | 'QUEUED' | 'PAUSED';

/**
 * Base queue item structure
 */
interface BaseQueueItem {
	id: string;
	type: QueueType;
	status: QueueStatus;
	sourceId: string;
	branch: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	lastError?: {
		message: string;
		timestamp: Timestamp;
		itemIndex?: number; // For batch items
	};
}

/**
 * Single prompt queue item
 */
export interface SingleQueueItem extends BaseQueueItem {
	type: 'single';
	prompt: string;
	promptPath?: string; // Optional to match web app
	scheduledAt?: Timestamp;
	scheduledTimeZone?: string;
	activatedAt?: Timestamp;
	sessionId?: string;
}

/**
 * Batch queue item subtask
 */
export interface BatchSubtask {
	fullContent: string; // Changed from promptPath to match web app
	status?: QueueStatus; // Made optional
	sessionId?: string;
	error?: string;
}

/**
 * Batch prompt queue item
 */
export interface BatchQueueItem extends BaseQueueItem {
	type: 'subtasks'; // Changed from 'batch' to match web app
	prompt?: string; // Added to match web app
	remaining: BatchSubtask[]; // Changed from subtasks to remaining
	totalCount?: number; // Added to match web app
	completedCount?: number;
	failedCount?: number;
}

/**
 * Union type for all queue items
 */
export type JulesQueueItem = SingleQueueItem | BatchQueueItem;

/**
 * User profile data
 */
export interface UserProfile {
	uid: string;
	email: string | null;
	displayName: string | null;
	photoURL: string | null;
	timezone?: string;
	defaultRepo?: string;
	defaultBranch?: string;
	favoriteRepos?: Array<{
		branch: string;
		id: string;
		name: string;
	}>;
	createdAt: Timestamp;
	lastLoginAt: Timestamp;
}

/**
 * Encrypted API key storage
 */
export interface ApiKeyDoc {
	encryptedKey: string;
	iv: string;
	algorithm: string;
	updatedAt: Timestamp;
}

/**
 * Jules session data
 */
export interface JulesSession {
	sessionId: string;
	name: string;
	promptPath: string;
	promptContentHash?: string;
	sourceId: string;
	branch: string;
	status: SessionStatus;
	pr?: {
		url: string;
		title: string;
		description: string;
		number?: number;
	};
	plan?: {
		generated: boolean;
		stepCount?: number;
	};
	failure?: {
		reason: string;
		failedStep?: string;
	};
	createdAt: Timestamp;
	completedAt?: Timestamp;
	lastSyncedAt?: Timestamp;
	julesUrl: string;
}

/**
 * Analytics aggregation data
 */
export interface SessionAnalytics {
	totalSessions: number;
	completedCount: number;
	failedCount: number;
	inProgressCount: number;
	successRate: number;
	prsCreated: number;
	averageCompletionTime?: number;
	statusCounts: Record<SessionStatus, number>;
	sessionsByDate: Record<string, number>;
	sessionsByPrompt: Record<string, {
		total: number;
		completed: number;
		failed: number;
	}>;
}

/**
 * Repository preferences
 */
export interface RepoPreference {
	repoId: string;
	repoName: string;
	defaultBranch?: string;
	isPinned: boolean;
	lastUsed: Timestamp;
}

/**
 * Helper type guards
 */
export function isSingleQueueItem(item: JulesQueueItem): item is SingleQueueItem {
	return item.type === 'single';
}

export function isBatchQueueItem(item: JulesQueueItem): item is BatchQueueItem {
	return item.type === 'subtasks';
}

/**
 * Firestore collection paths
 */
export const COLLECTIONS = {
	USERS: 'users',
	API_KEYS: 'apiKeys',
	JULES_QUEUES: 'julesQueues',
	QUEUE_ITEMS: 'items',
	JULES_SESSIONS: 'juleSessions',
	SESSIONS: 'sessions',
	REPO_PREFERENCES: 'repoPreferences'
} as const;

/**
 * Helper to build collection paths
 */
export function getUserCollectionPath(uid: string, collection: string): string {
	switch (collection) {
		case 'queue':
			return `${COLLECTIONS.JULES_QUEUES}/${uid}/${COLLECTIONS.QUEUE_ITEMS}`;
		case 'sessions':
			return `${COLLECTIONS.JULES_SESSIONS}/${uid}/${COLLECTIONS.SESSIONS}`;
		default:
			return `${collection}/${uid}`;
	}
}
