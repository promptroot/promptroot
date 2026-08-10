/**
 * Firebase Configuration and Initialization
 * 
 * This module handles Firebase SDK initialization with support for both
 * production and emulator environments.
 */

import * as vscode from 'vscode';
import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore as initFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';

// Single source of truth for the default project. authDomain and storageBucket
// follow the standard Firebase naming derived from the project id, so overriding
// the `promptroot.firebase.projectId` setting repoints them too.
// See docs/DEPLOYMENT_CONFIG.md.
const DEFAULT_PROJECT_ID = "promptroot-b02a2";

// Firebase production configuration
const FIREBASE_CONFIG: FirebaseOptions = {
	apiKey: "AIzaSyD_NzQlgmcUfgrqpgTl3Q3pCkfBrO8PcoA",
	authDomain: `${DEFAULT_PROJECT_ID}.firebaseapp.com`,
	projectId: DEFAULT_PROJECT_ID,
	storageBucket: `${DEFAULT_PROJECT_ID}.firebasestorage.app`,
	messagingSenderId: "494845853842",
	appId: "1:494845853842:web:6c97aec4822be003fc264b"
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let isEmulatorMode = false;

/**
 * Initialize Firebase with configuration from VS Code settings
 */
export function initializeFirebase(_context: vscode.ExtensionContext, outputChannel?: vscode.OutputChannel): void {
	const config = vscode.workspace.getConfiguration('promptroot.firebase');
	const useEmulator = config.get<boolean>('useEmulator', false);
	const projectId = config.get<string>('projectId', DEFAULT_PROJECT_ID);

	try {
		// Initialize Firebase app. authDomain/storageBucket are derived from the
		// effective projectId so a custom projectId setting repoints them too.
		const appConfig: FirebaseOptions = {
			...FIREBASE_CONFIG,
			projectId,
			authDomain: `${projectId}.firebaseapp.com`,
			storageBucket: `${projectId}.firebasestorage.app`
		};
		firebaseApp = initializeApp(appConfig);
		
		// Initialize Auth
		firebaseAuth = getAuth(firebaseApp);
		
		// Initialize Firestore
		firebaseDb = initFirestore(firebaseApp);

		// Connect to emulators if enabled
		if (useEmulator) {
			const emulatorHost = config.get<string>('emulatorHost', 'localhost');
			const authPort = config.get<number>('emulatorAuthPort', 9099);
			const firestorePort = config.get<number>('emulatorFirestorePort', 8080);

			connectAuthEmulator(firebaseAuth, `http://${emulatorHost}:${authPort}`, {
				disableWarnings: true
			});
			
			connectFirestoreEmulator(firebaseDb, emulatorHost, firestorePort);
			
			isEmulatorMode = true;
			outputChannel?.appendLine(`Firebase emulators connected: Auth=${authPort}, Firestore=${firestorePort}`);
		}

		outputChannel?.appendLine(`Firebase initialized in ${useEmulator ? 'EMULATOR' : 'PRODUCTION'} mode`);
	} catch (error) {
		const errorMessage = `Failed to initialize Firebase: ${error instanceof Error ? (error.stack || error.message) : String(error)}`;
		if (outputChannel) {
			outputChannel.appendLine(errorMessage);
		} else {
			console.error(errorMessage);
		}
		vscode.window.showErrorMessage(
			`Failed to initialize Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
		throw error;
	}
}

/**
 * Get the Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
	if (!firebaseAuth) {
		throw new Error('Firebase Auth not initialized. Call initializeFirebase() first.');
	}
	return firebaseAuth;
}

/**
 * Get the Firestore instance
 */
export function getFirestoreDb(): Firestore {
	if (!firebaseDb) {
		throw new Error('Firestore not initialized. Call initializeFirebase() first.');
	}
	return firebaseDb;
}

/**
 * Get the Firebase App instance
 */
export function getFirebaseApp(): FirebaseApp {
	if (!firebaseApp) {
		throw new Error('Firebase App not initialized. Call initializeFirebase() first.');
	}
	return firebaseApp;
}

/**
 * Check if running in emulator mode
 */
export function isUsingEmulator(): boolean {
	return isEmulatorMode;
}

/**
 * Dispose Firebase resources
 */
export async function disposeFirebase(): Promise<void> {
	// Firebase SDK handles cleanup automatically
	firebaseApp = null;
	firebaseAuth = null;
	firebaseDb = null;
	isEmulatorMode = false;
}
