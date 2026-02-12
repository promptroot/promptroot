/**
 * Firestore Service
 * 
 * Handles all Firestore database operations with retry logic and caching
 */

import * as vscode from 'vscode';
import {
	Firestore,
	collection,
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	limit,
	onSnapshot,
	Timestamp,
	QuerySnapshot,
	Unsubscribe,
	serverTimestamp,
	writeBatch
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase-config';
import {
	UserProfile,
	JulesQueueItem,
	JulesSession,
	SessionStatus,
	COLLECTIONS,
	getUserCollectionPath
} from './models';

// Cache duration in milliseconds
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

export class FirestoreService {
	private db: Firestore;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private cache: Map<string, CacheEntry<any>> = new Map();
	private listeners: Map<string, Unsubscribe> = new Map();

	constructor(
		private outputChannel: vscode.OutputChannel
	) {
		this.db = getFirestoreDb();
	}

	/**
	 * Get user profile
	 */
	public async getUserProfile(uid: string, useCache = true): Promise<UserProfile | null> {
		const cacheKey = `user:${uid}`;

		// Check cache first
		if (useCache) {
			const cached = this.getFromCache<UserProfile>(cacheKey);
			if (cached) {
				return cached;
			}
		}

		try {
			const docRef = doc(this.db, COLLECTIONS.USERS, uid);
			const docSnap = await getDoc(docRef);

			if (!docSnap.exists()) {
				return null;
			}

			const profile = docSnap.data() as UserProfile;
			this.setCache(cacheKey, profile);
			return profile;
		} catch (error) {
			this.outputChannel.appendLine(`Error fetching user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Create or update user profile
	 */
	public async saveUserProfile(profile: Partial<UserProfile> & { uid: string }): Promise<void> {
		try {
			const docRef = doc(this.db, COLLECTIONS.USERS, profile.uid);
			const existingDoc = await getDoc(docRef);

			if (existingDoc.exists()) {
				// Update existing profile
				await updateDoc(docRef, {
					...profile,
					lastLoginAt: serverTimestamp()
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any);
			} else {
				// Create new profile
				await setDoc(docRef, {
					...profile,
					createdAt: serverTimestamp(),
					lastLoginAt: serverTimestamp()
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any);
			}

			// Invalidate cache
			this.clearCache(`user:${profile.uid}`);
			this.outputChannel.appendLine(`User profile saved: ${profile.uid}`);
		} catch (error) {
			this.outputChannel.appendLine(`Error saving user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Get queue items for a user
	 */
	public async getQueueItems(uid: string, limitCount: number = 100): Promise<JulesQueueItem[]> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'queue');
			const q = query(
				collection(this.db, collectionPath),
				orderBy('createdAt', 'desc'),
				limit(limitCount)
			);

			const snapshot = await getDocs(q);
			const items: JulesQueueItem[] = [];

			snapshot.forEach((doc) => {
				items.push({ id: doc.id, ...doc.data() } as JulesQueueItem);
			});

			this.outputChannel.appendLine(`Fetched ${items.length} queue items for user ${uid}`);
			return items;
		} catch (error) {
			this.outputChannel.appendLine(`Error fetching queue items: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Add item to queue
	 */
	public async addQueueItem(uid: string, item: Omit<JulesQueueItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'queue');
			const collectionRef = collection(this.db, collectionPath);
			const newDocRef = doc(collectionRef);

			const queueItem = {
				...item,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp()
			};

			await setDoc(newDocRef, queueItem);
			
			this.outputChannel.appendLine(`Queue item added: ${newDocRef.id}`);
			return newDocRef.id;
		} catch (error) {
			this.outputChannel.appendLine(`Error adding queue item: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Update queue item
	 */
	public async updateQueueItem(uid: string, itemId: string, updates: Partial<JulesQueueItem>): Promise<void> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'queue');
			const docRef = doc(this.db, collectionPath, itemId);

			await updateDoc(docRef, {
				...updates,
				updatedAt: serverTimestamp()
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any);

			this.outputChannel.appendLine(`Queue item updated: ${itemId}`);
		} catch (error) {
			this.outputChannel.appendLine(`Error updating queue item: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Delete queue item
	 */
	public async deleteQueueItem(uid: string, itemId: string): Promise<void> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'queue');
			const docRef = doc(this.db, collectionPath, itemId);
			await deleteDoc(docRef);
			
			this.outputChannel.appendLine(`Queue item deleted: ${itemId}`);
		} catch (error) {
			this.outputChannel.appendLine(`Error deleting queue item: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Listen to queue updates in real-time
	 */
	public subscribeToQueue(
		uid: string,
		onUpdate: (items: JulesQueueItem[]) => void,
		onError?: (error: Error) => void,
		limitCount: number = 100
	): Unsubscribe {
		const listenerId = `queue:${uid}`;
		
		// Unsubscribe existing listener if any
		this.unsubscribe(listenerId);

		const collectionPath = getUserCollectionPath(uid, 'queue');
		const q = query(
			collection(this.db, collectionPath),
			orderBy('createdAt', 'desc'),
			limit(limitCount)
		);

		const unsubscribe = onSnapshot(
			q,
			(snapshot: QuerySnapshot) => {
				const items: JulesQueueItem[] = [];
				snapshot.forEach((doc) => {
					items.push({ id: doc.id, ...doc.data() } as JulesQueueItem);
				});
				this.outputChannel.appendLine(`Firestore snapshot received: ${items.length} items from ${collectionPath}`);
				onUpdate(items);
			},
			(error) => {
				this.outputChannel.appendLine(`Queue subscription error: ${error.message}`);
				if (onError) {
					onError(error);
				}
			}
		);

		this.listeners.set(listenerId, unsubscribe);
		this.outputChannel.appendLine(`Subscribed to queue updates: ${uid}`);

		return unsubscribe;
	}

	/**
	 * Listen to session updates in real-time
	 */
	public subscribeToSessions(
		uid: string,
		onUpdate: (sessions: JulesSession[]) => void,
		onError?: (error: Error) => void,
		limitCount: number = 50
	): Unsubscribe {
		const listenerId = `sessions:${uid}`;
		
		// Unsubscribe existing listener if any
		this.unsubscribe(listenerId);

		const collectionPath = getUserCollectionPath(uid, 'sessions');
		const q = query(
			collection(this.db, collectionPath),
			orderBy('createdAt', 'desc'),
			limit(limitCount)
		);

		const unsubscribe = onSnapshot(
			q,
			(snapshot: QuerySnapshot) => {
				const sessions: JulesSession[] = [];
				snapshot.forEach((doc) => {
					const data = doc.data();
					// Map Firestore field names to model and generate julesUrl
					sessions.push({
						...data,
						name: data.title || data.sessionName || data.name,  // Prefer title, fallback to sessionName
						julesUrl: `https://jules.google.com/session/${data.sessionId}`
					} as JulesSession);
				});
				onUpdate(sessions);
			},
			(error) => {
				this.outputChannel.appendLine(`Sessions subscription error: ${error.message}`);
				if (onError) {
					onError(error);
				}
				}
			);

		this.listeners.set(listenerId, unsubscribe);
		this.outputChannel.appendLine(`Subscribed to session updates: ${uid}`);

		return unsubscribe;
	}

	/**
	 * Get sessions with pagination and filtering
	 */
	public async getSessions(
		uid: string,
		options?: {
			limitCount?: number;
			status?: SessionStatus;
			startAfterDate?: Date;
		}
	): Promise<JulesSession[]> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'sessions');
			let q = query(
				collection(this.db, collectionPath),
				orderBy('createdAt', 'desc')
			);

			// Add status filter if provided
			if (options?.status) {
				q = query(q, where('status', '==', options.status));
			}

			// Add limit
			if (options?.limitCount) {
				q = query(q, limit(options.limitCount));
			}

			const snapshot = await getDocs(q);
			const sessions: JulesSession[] = [];

			snapshot.forEach((doc) => {
				sessions.push(doc.data() as JulesSession);
			});

			this.outputChannel.appendLine(`Fetched ${sessions.length} sessions for user ${uid}`);
			return sessions;
		} catch (error) {
			this.outputChannel.appendLine(`Error fetching sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Delete sessions older than specified date
	 */
	public async deleteOldSessions(uid: string, beforeDate: Date): Promise<number> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'sessions');
			const q = query(
				collection(this.db, collectionPath),
				where('createdAt', '<', Timestamp.fromDate(beforeDate))
			);

			const snapshot = await getDocs(q);
			const batch = writeBatch(this.db);
			let deleteCount = 0;

			snapshot.forEach((docSnapshot) => {
				batch.delete(docSnapshot.ref);
				deleteCount++;
			});

			if (deleteCount > 0) {
				await batch.commit();
				this.outputChannel.appendLine(`Deleted ${deleteCount} old sessions for user ${uid}`);
			}

			return deleteCount;
		} catch (error) {
			this.outputChannel.appendLine(`Error deleting old sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Delete specific sessions by IDs
	 */
	public async deleteSessions(uid: string, sessionIds: string[]): Promise<void> {
		try {
			const collectionPath = getUserCollectionPath(uid, 'sessions');
			const batch = writeBatch(this.db);

			for (const sessionId of sessionIds) {
				const docRef = doc(this.db, collectionPath, sessionId);
				batch.delete(docRef);
			}

			await batch.commit();
			this.outputChannel.appendLine(`Deleted ${sessionIds.length} sessions for user ${uid}`);
		} catch (error) {
			this.outputChannel.appendLine(`Error deleting sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
			throw error;
		}
	}

	/**
	 * Unsubscribe from a real-time listener
	 */
	public unsubscribe(listenerId: string): void {
		const unsubscribe = this.listeners.get(listenerId);
		if (unsubscribe) {
			unsubscribe();
			this.listeners.delete(listenerId);
			this.outputChannel.appendLine(`Unsubscribed: ${listenerId}`);
		}
	}

	/**
	 * Unsubscribe from all listeners
	 */
	public unsubscribeAll(): void {
		this.listeners.forEach((unsubscribe) => unsubscribe());
		this.listeners.clear();
		this.outputChannel.appendLine('Unsubscribed from all listeners');
	}

	/**
	 * Get from cache
	 */
	private getFromCache<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) {
			return null;
		}

		const now = Date.now();
		if (now - entry.timestamp > CACHE_DURATION) {
			this.cache.delete(key);
			return null;
		}

		return entry.data as T;
	}

	/**
	 * Set cache
	 */
	private setCache<T>(key: string, data: T): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now()
		});
	}

	/**
	 * Clear cache entry
	 */
	private clearCache(key: string): void {
		this.cache.delete(key);
	}

	/**
	 * Clear all cache
	 */
	public clearAllCache(): void {
		this.cache.clear();
		this.outputChannel.appendLine('Cache cleared');
	}

	/**
	 * Dispose resources
	 */
	public dispose(): void {
		this.unsubscribeAll();
		this.clearAllCache();
	}
}
