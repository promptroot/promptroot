/**
 * Authentication Manager
 * 
 * Handles GitHub OAuth authentication via Firebase Auth and manages auth state
 */

import * as vscode from 'vscode';
import {
	Auth,
	User,
	signInWithCredential,
	signOut as firebaseSignOut,
	onAuthStateChanged,
	GithubAuthProvider,
	UserCredential
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase-config';

// Secret storage keys
const GITHUB_TOKEN_KEY = 'promptroot.github.token';
const AUTH_STATE_KEY = 'promptroot.auth.lastUser';

export class AuthManager {
	private auth: Auth;
	private currentUser: User | null = null;
	private authStateChangeEmitter = new vscode.EventEmitter<User | null>();
	private disposables: vscode.Disposable[] = [];

	// Event that fires when auth state changes
	public readonly onAuthStateChanged = this.authStateChangeEmitter.event;

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel
	) {
		this.auth = getFirebaseAuth();
		this.setupAuthStateListener();
		this.tryRestoreSession();
	}

	/**
	 * Set up Firebase auth state listener
	 */
	private setupAuthStateListener(): void {
		const unsubscribe = onAuthStateChanged(this.auth, (user) => {
			this.currentUser = user;
			this.authStateChangeEmitter.fire(user);
			
			if (user) {
				this.outputChannel.appendLine(`Auth state changed: ${user.email} signed in`);
				// Save last user info
				this.context.globalState.update(AUTH_STATE_KEY, {
					uid: user.uid,
					email: user.email,
					displayName: user.displayName
				});
			} else {
				this.outputChannel.appendLine('Auth state changed: User signed out');
				this.context.globalState.update(AUTH_STATE_KEY, undefined);
			}
		});

		this.disposables.push({ dispose: unsubscribe });
	}

	/**
	 * Try to restore authentication session from VS Code
	 */
	private async tryRestoreSession(): Promise<void> {
		try {
			// Try to get GitHub token from VS Code's built-in auth provider
			const session = await vscode.authentication.getSession('github', ['repo', 'user:email'], {
				createIfNone: false
			});

			if (session) {
				this.outputChannel.appendLine('Found existing GitHub session, attempting to authenticate with Firebase...');
				await this.signInWithGitHubToken(session.accessToken);
			}
		} catch (error) {
			this.outputChannel.appendLine(`Failed to restore session: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Sign in with GitHub OAuth
	 */
	public async signIn(): Promise<User> {
		try {
			this.outputChannel.appendLine('Starting GitHub sign-in flow...');

			// Request GitHub authentication from VS Code
			const session = await vscode.authentication.getSession('github', ['repo', 'user:email'], {
				createIfNone: true
			});

			if (!session) {
				throw new Error('GitHub authentication cancelled');
			}

			this.outputChannel.appendLine('GitHub session obtained, authenticating with Firebase...');

			// Sign in to Firebase with GitHub token
			const user = await this.signInWithGitHubToken(session.accessToken);

			// Store token securely
			await this.context.secrets.store(GITHUB_TOKEN_KEY, session.accessToken);

			vscode.window.showInformationMessage(`Signed in as ${user.displayName || user.email}`);
			this.outputChannel.appendLine(`Successfully signed in: ${user.email}`);

			return user;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.outputChannel.appendLine(`Sign-in error: ${message}`);
			vscode.window.showErrorMessage(`Sign-in failed: ${message}`);
			throw error;
		}
	}

	/**
	 * Sign in to Firebase with GitHub access token
	 */
	private async signInWithGitHubToken(accessToken: string): Promise<User> {
		const credential = GithubAuthProvider.credential(accessToken);
		const userCredential: UserCredential = await signInWithCredential(this.auth, credential);
		return userCredential.user;
	}

	/**
	 * Sign out
	 */
	public async signOut(): Promise<void> {
		try {
			this.outputChannel.appendLine('Signing out...');
			
			await firebaseSignOut(this.auth);
			
			// Clear stored token
			await this.context.secrets.delete(GITHUB_TOKEN_KEY);
			
			vscode.window.showInformationMessage('Signed out successfully');
			this.outputChannel.appendLine('Signed out successfully');
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.outputChannel.appendLine(`Sign-out error: ${message}`);
			vscode.window.showErrorMessage(`Sign-out failed: ${message}`);
			throw error;
		}
	}

	/**
	 * Get current user
	 */
	public getCurrentUser(): User | null {
		return this.currentUser || this.auth.currentUser;
	}

	/**
	 * Check if user is signed in
	 */
	public isSignedIn(): boolean {
		return this.getCurrentUser() !== null;
	}

	/**
	 * Get GitHub access token from storage
	 */
	public async getGitHubToken(): Promise<string | undefined> {
		return await this.context.secrets.get(GITHUB_TOKEN_KEY);
	}

	/**
	 * Get current user's ID token for API calls
	 */
	public async getIdToken(forceRefresh = false): Promise<string | null> {
		const user = this.getCurrentUser();
		if (!user) {
			return null;
		}

		try {
			return await user.getIdToken(forceRefresh);
		} catch (error) {
			this.outputChannel.appendLine(`Failed to get ID token: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return null;
		}
	}

	/**
	 * Wait for auth to be ready
	 */
	public async waitForAuth(timeoutMs = 5000): Promise<User | null> {
		if (this.currentUser) {
			return this.currentUser;
		}

		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				resolve(null);
				disposable.dispose();
			}, timeoutMs);

			const disposable = this.onAuthStateChanged((user) => {
				clearTimeout(timeout);
				resolve(user);
				disposable.dispose();
			});
		});
	}

	/**
	 * Dispose resources
	 */
	public dispose(): void {
		this.disposables.forEach(d => d.dispose());
		this.authStateChangeEmitter.dispose();
	}
}
